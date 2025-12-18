import { eq, desc, or } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, transactions, type TransactionRow } from '../store/index.js';
import { Transaction, TransactionType, TransactionStatus } from '../../public/model/transaction.js';
import { TransactionRecord } from '../records/transactionRecord.js';
import { Temporal } from 'temporal-polyfill';

export class TransactionResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    type: TransactionType;
    fromWalletId?: string;
    toWalletId?: string;
    amount: number;
    currency: string;
    status?: TransactionStatus;
    externalId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Transaction> {
    this.logger.info({ data }, 'Creating transaction');

    const [transactionRow] = await this.db
      .insert(transactions)
      .values({
        ...data,
        status: data.status || 'PENDING',
      })
      .returning();

    if (!transactionRow) {
      throw new Error('Failed to create transaction');
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  async findById(id: string): Promise<Transaction> {
    const [transactionRow] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    if (!transactionRow) {
      throw new NotFoundError('Transaction', id);
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  async findByWalletId(walletId: string, limit = 50): Promise<Transaction[]> {
    const transactionRows = await this.db
      .select()
      .from(transactions)
      .where(
        or(
          eq(transactions.fromWalletId, walletId),
          eq(transactions.toWalletId, walletId)
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(limit);

    return transactionRows.map(row => {
      const record = this.rowToRecord(row);
      return this.recordToTransaction(record);
    });
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    this.logger.info({ transactionId: id, status }, 'Updating transaction status');

    const [transactionRow] = await this.db
      .update(transactions)
      .set({
        status,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(eq(transactions.id, id))
      .returning();

    if (!transactionRow) {
      throw new NotFoundError('Transaction', id);
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
  }

  private rowToRecord(row: TransactionRow): TransactionRecord {
    return {
      id: row.id,
      type: row.type as TransactionType,
      fromWalletId: row.fromWalletId || undefined,
      toWalletId: row.toWalletId || undefined,
      amount: row.amount,
      currency: row.currency,
      status: row.status as TransactionStatus,
      externalId: row.externalId || undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private recordToTransaction(record: TransactionRecord): Transaction {
    return {
      id: record.id,
      type: record.type,
      fromWalletId: record.fromWalletId,
      toWalletId: record.toWalletId,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      externalId: record.externalId,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
