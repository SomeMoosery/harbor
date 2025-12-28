import { eq, desc, or } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, transactions, type TransactionRow } from '../store/index.js';
import { Transaction, TransactionType, TransactionStatus } from '../../public/model/transaction.js';
import { TransactionRecord } from '../records/transactionRecord.js';
import { Temporal } from 'temporal-polyfill';
import { Money } from '../../public/model/money.js';

export class TransactionResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
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

    const [transactionRow] = await this.db
      .insert(transactions)
      .values({
        type: data.type,
        fromWalletId: data.fromWalletId,
        toWalletId: data.toWalletId,
        amount: data.amount.amount,
        currency: data.currency,
        status: data.status || 'PENDING',
        externalId: data.externalId,
        metadata: data.metadata,
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

    return transactionRows.map((row: any) => {
      const record = this.rowToRecord(row);
      return this.recordToTransaction(record);
    });
  }

  async findByExternalId(externalId: string): Promise<Transaction | null> {
    const [transactionRow] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.externalId, externalId));

    if (!transactionRow) {
      return null;
    }

    const record = this.rowToRecord(transactionRow);
    return this.recordToTransaction(record);
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
    const amount: number = row.amount;
    const currency: string = row.currency;
    return {
      id: row.id,
      type: row.type as TransactionType,
      fromWalletId: row.fromWalletId || undefined,
      toWalletId: row.toWalletId || undefined,
      amount: {amount, currency},
      currency: row.currency,
      status: row.status as TransactionStatus,
      externalId: row.externalId || undefined,
      metadata: row.metadata ? (row.metadata as Record<string, unknown>) : undefined,
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
