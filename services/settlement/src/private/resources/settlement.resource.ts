import { eq } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, settlements, type SettlementRow } from '../store/index.js';
import { Settlement, SettlementStatus } from '../../public/model/settlement.js';
import { SettlementRecord } from '../records/settlementRecord.js';
import { Temporal } from 'temporal-polyfill';

export class SettlementResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    escrowLockId: string;
    sellerWalletId: string;
    sellerAgentId: string;
    payoutAmount: number;
    sellerFee: number;
    platformRevenue: number;
    currency: string;
    releaseTransactionId?: string;
    feeTransactionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Settlement> {
    this.logger.info({ data }, 'Creating settlement');

    const [settlementRow] = await this.db
      .insert(settlements)
      .values({
        ...data,
        status: 'PENDING',
      })
      .returning();

    if (!settlementRow) {
      throw new Error('Failed to create settlement');
    }

    const record = this.rowToRecord(settlementRow);
    return this.recordToSettlement(record);
  }

  async findById(id: string): Promise<Settlement> {
    const [settlementRow] = await this.db
      .select()
      .from(settlements)
      .where(eq(settlements.id, id));

    if (!settlementRow) {
      throw new NotFoundError('Settlement', id);
    }

    const record = this.rowToRecord(settlementRow);
    return this.recordToSettlement(record);
  }

  async updateStatus(id: string, status: SettlementStatus): Promise<Settlement> {
    this.logger.info({ settlementId: id, status }, 'Updating settlement status');

    const [settlementRow] = await this.db
      .update(settlements)
      .set({
        status,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(settlements.id, id))
      .returning();

    if (!settlementRow) {
      throw new NotFoundError('Settlement', id);
    }

    const record = this.rowToRecord(settlementRow);
    return this.recordToSettlement(record);
  }

  private rowToRecord(row: SettlementRow): SettlementRecord {
    return {
      id: row.id,
      escrowLockId: row.escrowLockId,
      sellerWalletId: row.sellerWalletId,
      sellerAgentId: row.sellerAgentId,
      payoutAmount: row.payoutAmount,
      sellerFee: row.sellerFee,
      platformRevenue: row.platformRevenue,
      currency: row.currency,
      status: row.status as SettlementStatus,
      releaseTransactionId: row.releaseTransactionId || undefined,
      feeTransactionId: row.feeTransactionId || undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private recordToSettlement(record: SettlementRecord): Settlement {
    return {
      id: record.id,
      escrowLockId: record.escrowLockId,
      sellerWalletId: record.sellerWalletId,
      sellerAgentId: record.sellerAgentId,
      payoutAmount: record.payoutAmount,
      sellerFee: record.sellerFee,
      platformRevenue: record.platformRevenue,
      currency: record.currency,
      status: record.status,
      releaseTransactionId: record.releaseTransactionId,
      feeTransactionId: record.feeTransactionId,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
