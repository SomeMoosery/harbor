import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { Temporal } from 'temporal-polyfill';
import { LedgerEntry, LedgerEntryType, LedgerEntryStatus } from '../../public/model/ledgerEntry.js';
import { LedgerEntryRecord } from '../records/ledgerEntryRecord.js';
import { Money } from '../../public/model/money.js';

interface LedgerEntryRow {
  id: string;
  agent_id: string;
  wallet_id: string;
  type: string;
  status: string;
  external_provider: string | null;
  external_transaction_id: string | null;
  external_amount: number | null;
  external_currency: string | null;
  external_status: string | null;
  external_completed_at: Date | null;
  internal_transaction_id: string | null;
  internal_amount: number;
  internal_currency: string;
  internal_status: string | null;
  internal_completed_at: Date | null;
  reconciled_at: Date | null;
  reconciliation_notes: string | null;
  platform_fee: number | null;
  external_provider_fee: number | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export class LedgerEntryResource {
  constructor(
    private readonly sql: Sql,
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
    externalAmount: Money;
    externalCurrency: string;
    internalAmount: Money;
    internalCurrency: string;
    platformFee?: Money;
    externalProviderFee?: Money;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntry> {
    this.logger.debug({ data }, 'Creating onramp ledger entry');

    const [ledgerEntryRow] = await this.sql<LedgerEntryRow[]>`
      INSERT INTO ledger_entries (
        agent_id, wallet_id, type, status,
        external_provider, external_transaction_id, external_amount, external_currency,
        internal_amount, internal_currency,
        platform_fee, external_provider_fee,
        description, metadata
      )
      VALUES (
        ${data.agentId}, ${data.walletId}, 'ONRAMP', 'PENDING',
        ${data.externalProvider}, ${data.externalTransactionId},
        ${data.externalAmount.amount}, ${data.externalCurrency},
        ${data.internalAmount.amount}, ${data.internalCurrency},
        ${data.platformFee?.amount ?? 0}, ${data.externalProviderFee?.amount ?? 0},
        ${data.description}, ${(data.metadata ?? null) as any}
      )
      RETURNING *
    `;

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

    const completedAt = externalCompletedAt
      ? new Date(externalCompletedAt.epochMilliseconds)
      : new Date();

    const [updatedRow] = await this.sql<LedgerEntryRow[]>`
      UPDATE ledger_entries
      SET external_status = ${externalStatus},
          external_completed_at = ${completedAt},
          status = 'EXTERNAL_COMPLETED',
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

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

    const completedAt = internalCompletedAt
      ? new Date(internalCompletedAt.epochMilliseconds)
      : new Date();

    const [updatedRow] = await this.sql<LedgerEntryRow[]>`
      UPDATE ledger_entries
      SET internal_transaction_id = ${internalTransactionId},
          internal_status = ${internalStatus},
          internal_completed_at = ${completedAt},
          status = 'INTERNAL_COMPLETED',
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

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

    const [updatedRow] = await this.sql<LedgerEntryRow[]>`
      UPDATE ledger_entries
      SET status = 'RECONCILED',
          reconciled_at = NOW(),
          reconciliation_notes = ${notes || null},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

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

    const [updatedRow] = await this.sql<LedgerEntryRow[]>`
      UPDATE ledger_entries
      SET status = 'FAILED',
          reconciliation_notes = ${notes},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

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

    const [updatedRow] = await this.sql<LedgerEntryRow[]>`
      UPDATE ledger_entries
      SET status = 'REQUIRES_MANUAL_REVIEW',
          reconciliation_notes = ${notes},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

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
    const ledgerEntryRows = await this.sql<LedgerEntryRow[]>`
      SELECT * FROM ledger_entries
      WHERE agent_id = ${agentId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return ledgerEntryRows.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToLedgerEntry(record);
    });
  }

  /**
   * Find entry by external transaction ID (to avoid duplicates)
   */
  async findByExternalTransactionId(externalTransactionId: string): Promise<LedgerEntry | null> {
    const [ledgerEntryRow] = await this.sql<LedgerEntryRow[]>`
      SELECT * FROM ledger_entries
      WHERE external_transaction_id = ${externalTransactionId}
      LIMIT 1
    `;

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
    const ledgerEntryRows = await this.sql<LedgerEntryRow[]>`
      SELECT * FROM ledger_entries
      WHERE status IN ('PENDING', 'EXTERNAL_COMPLETED', 'INTERNAL_COMPLETED')
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return ledgerEntryRows.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToLedgerEntry(record);
    });
  }

  /**
   * Find entries requiring manual review
   */
  async findEntriesForManualReview(limit = 100): Promise<LedgerEntry[]> {
    const ledgerEntryRows = await this.sql<LedgerEntryRow[]>`
      SELECT * FROM ledger_entries
      WHERE status = 'REQUIRES_MANUAL_REVIEW'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return ledgerEntryRows.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToLedgerEntry(record);
    });
  }

  /**
   * Find entry by ID
   */
  async findById(id: string): Promise<LedgerEntry> {
    const [ledgerEntryRow] = await this.sql<LedgerEntryRow[]>`
      SELECT * FROM ledger_entries
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!ledgerEntryRow) {
      throw new Error('Ledger entry not found');
    }

    const record = this.rowToRecord(ledgerEntryRow);
    return this.recordToLedgerEntry(record);
  }

  private rowToRecord(row: LedgerEntryRow): LedgerEntryRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      walletId: row.wallet_id,
      type: row.type as LedgerEntryType,
      status: row.status as LedgerEntryStatus,
      externalProvider: row.external_provider ?? null,
      externalTransactionId: row.external_transaction_id ?? null,
      externalAmount: row.external_amount ?? null,
      externalCurrency: row.external_currency ?? null,
      externalStatus: row.external_status ?? null,
      externalCompletedAt: row.external_completed_at
        ? Temporal.Instant.fromEpochMilliseconds(row.external_completed_at.getTime()).toZonedDateTimeISO('UTC')
        : null,
      internalTransactionId: row.internal_transaction_id ?? null,
      internalAmount: row.internal_amount,
      internalCurrency: row.internal_currency,
      internalStatus: row.internal_status ?? null,
      internalCompletedAt: row.internal_completed_at
        ? Temporal.Instant.fromEpochMilliseconds(row.internal_completed_at.getTime()).toZonedDateTimeISO('UTC')
        : null,
      reconciledAt: row.reconciled_at
        ? Temporal.Instant.fromEpochMilliseconds(row.reconciled_at.getTime()).toZonedDateTimeISO('UTC')
        : null,
      reconciliationNotes: row.reconciliation_notes ?? null,
      platformFee: row.platform_fee ?? 0,
      externalProviderFee: row.external_provider_fee ?? 0,
      description: row.description,
      metadata: row.metadata || undefined,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
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
