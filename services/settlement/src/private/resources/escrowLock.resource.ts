import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import { EscrowLock, EscrowLockStatus } from '../../public/model/escrowLock.js';
import { EscrowLockRecord } from '../records/escrowLockRecord.js';
import { Temporal } from 'temporal-polyfill';

interface EscrowLockRow {
  id: string;
  ask_id: string;
  bid_id: string;
  buyer_wallet_id: string;
  buyer_agent_id: string;
  total_amount: number;
  base_amount: number;
  buyer_fee: number;
  currency: string;
  status: string;
  lock_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export class EscrowLockResource {
  constructor(
    private readonly sql: Sql,
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

    const [lockRow] = await this.sql<EscrowLockRow[]>`
      INSERT INTO escrow_locks (
        ask_id, bid_id, buyer_wallet_id, buyer_agent_id,
        total_amount, base_amount, buyer_fee, currency,
        status, lock_transaction_id, metadata
      )
      VALUES (
        ${data.askId},
        ${data.bidId},
        ${data.buyerWalletId},
        ${data.buyerAgentId},
        ${data.totalAmount},
        ${data.baseAmount},
        ${data.buyerFee},
        ${data.currency},
        'LOCKED',
        ${data.lockTransactionId || null},
        ${(data.metadata ?? null) as any}
      )
      RETURNING *
    `;

    if (!lockRow) {
      throw new Error('Failed to create escrow lock');
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  async findById(id: string): Promise<EscrowLock> {
    const [lockRow] = await this.sql<EscrowLockRow[]>`
      SELECT * FROM escrow_locks
      WHERE id = ${id}
    `;

    if (!lockRow) {
      throw new NotFoundError('EscrowLock', id);
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  async findByBidId(bidId: string): Promise<EscrowLock | null> {
    const [lockRow] = await this.sql<EscrowLockRow[]>`
      SELECT * FROM escrow_locks
      WHERE bid_id = ${bidId}
    `;

    if (!lockRow) {
      return null;
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  async updateStatus(id: string, status: EscrowLockStatus): Promise<EscrowLock> {
    this.logger.info({ escrowLockId: id, status }, 'Updating escrow lock status');

    const [lockRow] = await this.sql<EscrowLockRow[]>`
      UPDATE escrow_locks
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!lockRow) {
      throw new NotFoundError('EscrowLock', id);
    }

    const record = this.rowToRecord(lockRow);
    return this.recordToEscrowLock(record);
  }

  private rowToRecord(row: EscrowLockRow): EscrowLockRecord {
    return {
      id: row.id,
      askId: row.ask_id,
      bidId: row.bid_id,
      buyerWalletId: row.buyer_wallet_id,
      buyerAgentId: row.buyer_agent_id,
      totalAmount: row.total_amount,
      baseAmount: row.base_amount,
      buyerFee: row.buyer_fee,
      currency: row.currency,
      status: row.status as EscrowLockStatus,
      lockTransactionId: row.lock_transaction_id || undefined,
      metadata: row.metadata || undefined,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
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
