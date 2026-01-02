import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import { Settlement, SettlementStatus } from '../../public/model/settlement.js';
import { SettlementRecord } from '../records/settlementRecord.js';
import { Temporal } from 'temporal-polyfill';

interface SettlementRow {
  id: string;
  escrow_lock_id: string;
  seller_wallet_id: string;
  seller_agent_id: string;
  payout_amount: number;
  seller_fee: number;
  platform_revenue: number;
  currency: string;
  status: string;
  release_transaction_id: string | null;
  fee_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export class SettlementResource {
  constructor(
    private readonly sql: Sql,
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

    const [settlementRow] = await this.sql<SettlementRow[]>`
      INSERT INTO settlements (
        escrow_lock_id, seller_wallet_id, seller_agent_id,
        payout_amount, seller_fee, platform_revenue, currency,
        status, release_transaction_id, fee_transaction_id, metadata
      )
      VALUES (
        ${data.escrowLockId},
        ${data.sellerWalletId},
        ${data.sellerAgentId},
        ${data.payoutAmount},
        ${data.sellerFee},
        ${data.platformRevenue},
        ${data.currency},
        'PENDING',
        ${data.releaseTransactionId || null},
        ${data.feeTransactionId || null},
        ${(data.metadata ?? null) as any}
      )
      RETURNING *
    `;

    if (!settlementRow) {
      throw new Error('Failed to create settlement');
    }

    const record = this.rowToRecord(settlementRow);
    return this.recordToSettlement(record);
  }

  async findById(id: string): Promise<Settlement> {
    const [settlementRow] = await this.sql<SettlementRow[]>`
      SELECT * FROM settlements
      WHERE id = ${id}
    `;

    if (!settlementRow) {
      throw new NotFoundError('Settlement', id);
    }

    const record = this.rowToRecord(settlementRow);
    return this.recordToSettlement(record);
  }

  async updateStatus(id: string, status: SettlementStatus): Promise<Settlement> {
    this.logger.info({ settlementId: id, status }, 'Updating settlement status');

    const [settlementRow] = await this.sql<SettlementRow[]>`
      UPDATE settlements
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!settlementRow) {
      throw new NotFoundError('Settlement', id);
    }

    const record = this.rowToRecord(settlementRow);
    return this.recordToSettlement(record);
  }

  private rowToRecord(row: SettlementRow): SettlementRecord {
    return {
      id: row.id,
      escrowLockId: row.escrow_lock_id,
      sellerWalletId: row.seller_wallet_id,
      sellerAgentId: row.seller_agent_id,
      payoutAmount: row.payout_amount,
      sellerFee: row.seller_fee,
      platformRevenue: row.platform_revenue,
      currency: row.currency,
      status: row.status as SettlementStatus,
      releaseTransactionId: row.release_transaction_id || undefined,
      feeTransactionId: row.fee_transaction_id || undefined,
      metadata: row.metadata || undefined,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
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
