import { eq, desc, inArray } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { Temporal } from 'temporal-polyfill';
import { getDb, ledgerEntries, type LedgerEntryRow } from '../store/index.js';
import { LedgerEntry, LedgerEntryType, LedgerEntryStatus } from '../../public/model/ledgerEntry.js';
import { LedgerEntryRecord } from '../records/ledgerEntryRecord.js';

export class LedgerEntryResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new onramp ledger entry when Stripe payment is initiated
   */
  async createOnrampEntry(data: {
    agentId: string;
    walletId: string;
    externalProvider: string;
    externalTransactionId: string;
    externalAmount: number;
    externalCurrency: string;
    internalAmount: number;
    internalCurrency: string;
    platformFee?: number;
    externalProviderFee?: number;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntry> {
    this.logger.debug({ data }, 'Creating onramp ledger entry');

    const [ledgerEntryRow] = await this.db
      .insert(ledgerEntries)
      .values({
        agentId: data.agentId,
        walletId: data.walletId,
        type: 'ONRAMP',
        status: 'PENDING',
        externalProvider: data.externalProvider,
        externalTransactionId: data.externalTransactionId,
        externalAmount: data.externalAmount,
        externalCurrency: data.externalCurrency,
        internalAmount: data.internalAmount,
        internalCurrency: data.internalCurrency,
        platformFee: data.platformFee ?? 0,
        externalProviderFee: data.externalProviderFee ?? 0,
        description: data.description,
        metadata: data.metadata,
      })
      .returning();

    if (!ledgerEntryRow) {
      throw new Error('Failed to create ledger entry');
    }

    const record = this.rowToRecord(ledgerEntryRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Update external status when Stripe payment completes
   */
  async updateExternalStatus(
    id: string,
    externalStatus: string,
    externalCompletedAt?: Temporal.ZonedDateTime
  ): Promise<LedgerEntry> {
    this.logger.debug({ id, externalStatus }, 'Updating external status');

    const [updatedRow] = await this.db
      .update(ledgerEntries)
      .set({
        externalStatus,
        externalCompletedAt: externalCompletedAt ?? Temporal.Now.zonedDateTimeISO(),
        status: 'EXTERNAL_COMPLETED',
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(ledgerEntries.id, id))
      .returning();

    if (!updatedRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(updatedRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Update internal status when USDC is credited to wallet
   */
  async updateInternalStatus(
    id: string,
    internalTransactionId: string,
    internalStatus: string,
    internalCompletedAt?: Temporal.ZonedDateTime
  ): Promise<LedgerEntry> {
    this.logger.debug({ id, internalTransactionId, internalStatus }, 'Updating internal status');

    const [updatedRow] = await this.db
      .update(ledgerEntries)
      .set({
        internalTransactionId,
        internalStatus,
        internalCompletedAt: internalCompletedAt ?? Temporal.Now.zonedDateTimeISO(),
        status: 'INTERNAL_COMPLETED',
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(ledgerEntries.id, id))
      .returning();

    if (!updatedRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(updatedRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Mark entry as reconciled when both external and internal are completed
   */
  async reconcile(id: string, notes?: string): Promise<LedgerEntry> {
    this.logger.debug({ id, notes }, 'Reconciling ledger entry');

    const [updatedRow] = await this.db
      .update(ledgerEntries)
      .set({
        status: 'RECONCILED',
        reconciledAt: Temporal.Now.zonedDateTimeISO(),
        reconciliationNotes: notes,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(ledgerEntries.id, id))
      .returning();

    if (!updatedRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(updatedRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Mark entry as failed
   */
  async markFailed(id: string, notes: string): Promise<LedgerEntry> {
    this.logger.debug({ id, notes }, 'Marking ledger entry as failed');

    const [updatedRow] = await this.db
      .update(ledgerEntries)
      .set({
        status: 'FAILED',
        reconciliationNotes: notes,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(ledgerEntries.id, id))
      .returning();

    if (!updatedRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(updatedRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Mark entry for manual review (edge cases)
   */
  async markForManualReview(id: string, notes: string): Promise<LedgerEntry> {
    this.logger.debug({ id, notes }, 'Marking ledger entry for manual review');

    const [updatedRow] = await this.db
      .update(ledgerEntries)
      .set({
        status: 'REQUIRES_MANUAL_REVIEW',
        reconciliationNotes: notes,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(ledgerEntries.id, id))
      .returning();

    if (!updatedRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(updatedRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Find entries by agent ID
   */
  async findByAgentId(agentId: string, limit = 100): Promise<LedgerEntry[]> {
    const ledgerEntryRows = await this.db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.agentId, agentId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit);

    return ledgerEntryRows.map((row: any) => {
      const record = this.rowToRecord(row);
      return this.recordToLedgerEntry(record);
    });
  }

  /**
   * Find entry by external transaction ID (to avoid duplicates)
   */
  async findByExternalTransactionId(externalTransactionId: string): Promise<LedgerEntry | null> {
    const [ledgerEntryRow] = await this.db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.externalTransactionId, externalTransactionId))
      .limit(1);

    if (!ledgerEntryRow) {
      return null;
    }

    const record = this.rowToRecord(ledgerEntryRow);
    return this.recordToLedgerEntry(record);
  }

  /**
   * Find unreconciled entries for background reconciliation job
   */
  async findUnreconciledEntries(limit = 100): Promise<LedgerEntry[]> {
    const ledgerEntryRows = await this.db
      .select()
      .from(ledgerEntries)
      .where(
        inArray(ledgerEntries.status, [
          'PENDING',
          'EXTERNAL_COMPLETED',
          'INTERNAL_COMPLETED',
        ])
      )
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit);

    return ledgerEntryRows.map((row: any) => {
      const record = this.rowToRecord(row);
      return this.recordToLedgerEntry(record);
    });
  }

  /**
   * Find entries requiring manual review
   */
  async findEntriesForManualReview(limit = 100): Promise<LedgerEntry[]> {
    const ledgerEntryRows = await this.db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.status, 'REQUIRES_MANUAL_REVIEW'))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit);

    return ledgerEntryRows.map((row: any) => {
      const record = this.rowToRecord(row);
      return this.recordToLedgerEntry(record);
    });
  }

  /**
   * Find entry by ID
   */
  async findById(id: string): Promise<LedgerEntry> {
    const [ledgerEntryRow] = await this.db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.id, id))
      .limit(1);

    if (!ledgerEntryRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(ledgerEntryRow);
    return this.recordToLedgerEntry(record);
  }

  private rowToRecord(row: LedgerEntryRow): LedgerEntryRecord {
    return {
      id: row.id,
      agentId: row.agentId,
      walletId: row.walletId,
      type: row.type as LedgerEntryType,
      status: row.status as LedgerEntryStatus,
      externalProvider: row.externalProvider,
      externalTransactionId: row.externalTransactionId,
      externalAmount: row.externalAmount,
      externalCurrency: row.externalCurrency,
      externalStatus: row.externalStatus,
      externalCompletedAt: row.externalCompletedAt,
      internalTransactionId: row.internalTransactionId,
      internalAmount: row.internalAmount,
      internalCurrency: row.internalCurrency,
      internalStatus: row.internalStatus,
      internalCompletedAt: row.internalCompletedAt,
      reconciledAt: row.reconciledAt,
      reconciliationNotes: row.reconciliationNotes,
      platformFee: row.platformFee ?? 0,
      externalProviderFee: row.externalProviderFee ?? 0,
      description: row.description,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private recordToLedgerEntry(record: LedgerEntryRecord): LedgerEntry {
    return {
      id: record.id,
      agentId: record.agentId,
      walletId: record.walletId,
      type: record.type,
      status: record.status,
      externalProvider: record.externalProvider,
      externalTransactionId: record.externalTransactionId,
      externalAmount: record.externalAmount,
      externalCurrency: record.externalCurrency,
      externalStatus: record.externalStatus,
      externalCompletedAt: record.externalCompletedAt,
      internalTransactionId: record.internalTransactionId,
      internalAmount: record.internalAmount,
      internalCurrency: record.internalCurrency,
      internalStatus: record.internalStatus,
      internalCompletedAt: record.internalCompletedAt,
      reconciledAt: record.reconciledAt,
      reconciliationNotes: record.reconciliationNotes,
      platformFee: record.platformFee,
      externalProviderFee: record.externalProviderFee,
      description: record.description,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
