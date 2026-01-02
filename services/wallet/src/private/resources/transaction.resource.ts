import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import { Transaction, TransactionType, TransactionStatus } from '../../public/model/transaction.js';
import { TransactionRecord } from '../records/transactionRecord.js';
import { Temporal } from 'temporal-polyfill';
import { Money } from '../../public/model/money.js';

interface TransactionRow {
  id: string;
  type: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  currency: string;
  status: string;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export class TransactionResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  async create(data: {
    type: TransactionType;
    fromWalletId?: string;
    toWalletId?: string;
    amount: Money;
    currency: string;
    status?: TransactionStatus;
    externalId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Transaction> {
    this.logger.info({ data }, 'Creating transaction');

    const [transactionRow] = await this.sql<TransactionRow[]>`
      INSERT INTO transactions (
        type, from_wallet_id, to_wallet_id, amount, currency, status, external_id, metadata
      )
      VALUES (
        ${data.type},
        ${data.fromWalletId || null},
        ${data.toWalletId || null},
        ${data.amount.amount},
        ${data.currency},
        ${data.status || 'PENDING'},
        ${data.externalId || null},
        ${(data.metadata ?? null) as any}
      )
      RETURNING *
    `;

    if (!transactionRow) {
      throw new Error('Failed to create transaction');
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  async findById(id: string): Promise<Transaction> {
    const [transactionRow] = await this.sql<TransactionRow[]>`
      SELECT * FROM transactions
      WHERE id = ${id}
    `;

    if (!transactionRow) {
      throw new NotFoundError('Transaction', id);
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  async findByWalletId(walletId: string, limit = 50): Promise<Transaction[]> {
    const transactionRows = await this.sql<TransactionRow[]>`
      SELECT * FROM transactions
      WHERE from_wallet_id = ${walletId}
         OR to_wallet_id = ${walletId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return transactionRows.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToTransaction(record);
    });
  }

  async findByExternalId(externalId: string): Promise<Transaction | null> {
    const [transactionRow] = await this.sql<TransactionRow[]>`
      SELECT * FROM transactions
      WHERE external_id = ${externalId}
    `;

    if (!transactionRow) {
      return null;
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    this.logger.info({ transactionId: id, status }, 'Updating transaction status');

    const [transactionRow] = await this.sql<TransactionRow[]>`
      UPDATE transactions
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!transactionRow) {
      throw new NotFoundError('Transaction', id);
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  private rowToRecord(row: TransactionRow): TransactionRecord {
    const amount: number = row.amount;
    const currency: string = row.currency;
    return {
      id: row.id,
      type: row.type as TransactionType,
      fromWalletId: row.from_wallet_id || undefined,
      toWalletId: row.to_wallet_id || undefined,
      amount: { amount, currency },
      currency: row.currency,
      status: row.status as TransactionStatus,
      externalId: row.external_id || undefined,
      metadata: row.metadata || undefined,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
    };
  }

  private recordToTransaction(record: TransactionRecord): Transaction {
    return {
      id: record.id,
      type: record.type,
      fromWalletId: record.fromWalletId,
      toWalletId: record.toWalletId,
      amount: record.amount.amount,
      currency: record.currency,
      status: record.status,
      externalId: record.externalId,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
