import { eq } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, escrowLocks, type EscrowLockRow } from '../store/index.js';
import { EscrowLock, EscrowLockStatus } from '../../public/model/escrowLock.js';
import { EscrowLockRecord } from '../records/escrowLockRecord.js';
import { Temporal } from 'temporal-polyfill';

export class EscrowLockResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    askId: string;
    bidId: string;
    buyerWalletId: string;
    buyerAgentId: string;
    totalAmount: number;
    baseAmount: number;
    buyerFee: number;
    currency: string;
    lockTransactionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EscrowLock> {
    this.logger.info({ data }, 'Creating escrow lock');

    const [lockRow] = await this.db
      .insert(escrowLocks)
      .values({
        ...data,
        status: 'LOCKED',
      })
      .returning();

    if (!lockRow) {
      throw new Error('Failed to create escrow lock');
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  async findById(id: string): Promise<EscrowLock> {
    const [lockRow] = await this.db
      .select()
      .from(escrowLocks)
      .where(eq(escrowLocks.id, id));

    if (!lockRow) {
      throw new NotFoundError('EscrowLock', id);
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  async findByBidId(bidId: string): Promise<EscrowLock | null> {
    const [lockRow] = await this.db
      .select()
      .from(escrowLocks)
      .where(eq(escrowLocks.bidId, bidId));

    if (!lockRow) {
      return null;
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  async updateStatus(id: string, status: EscrowLockStatus): Promise<EscrowLock> {
    this.logger.info({ escrowLockId: id, status }, 'Updating escrow lock status');

    const [lockRow] = await this.db
      .update(escrowLocks)
      .set({
        status,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(escrowLocks.id, id))
      .returning();

    if (!lockRow) {
      throw new NotFoundError('EscrowLock', id);
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  private rowToRecord(row: EscrowLockRow): EscrowLockRecord {
    return {
      id: row.id,
      askId: row.askId,
      bidId: row.bidId,
      buyerWalletId: row.buyerWalletId,
      buyerAgentId: row.buyerAgentId,
      totalAmount: row.totalAmount,
      baseAmount: row.baseAmount,
      buyerFee: row.buyerFee,
      currency: row.currency,
      status: row.status as EscrowLockStatus,
      lockTransactionId: row.lockTransactionId || undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private recordToEscrowLock(record: EscrowLockRecord): EscrowLock {
    return {
      id: record.id,
      askId: record.askId,
      bidId: record.bidId,
      buyerWalletId: record.buyerWalletId,
      buyerAgentId: record.buyerAgentId,
      totalAmount: record.totalAmount,
      baseAmount: record.baseAmount,
      buyerFee: record.buyerFee,
      currency: record.currency,
      status: record.status,
      lockTransactionId: record.lockTransactionId,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
