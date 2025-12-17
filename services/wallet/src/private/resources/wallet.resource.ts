import { eq, and, isNull } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, wallets, type WalletRow } from '../store/index.js';
import { Wallet, WalletStatus } from '../../public/model/wallet.js';
import { WalletRecord } from '../records/walletRecord.js';
import { Temporal } from 'temporal-polyfill';

export class WalletResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    agentId: string;
    circleWalletId?: string;
    status?: WalletStatus;
  }): Promise<Wallet> {
    this.logger.info({ data }, 'Creating wallet');

    const [walletRow] = await this.db
      .insert(wallets)
      .values({
        agentId: data.agentId,
        circleWalletId: data.circleWalletId,
        status: data.status || 'ACTIVE',
      })
      .returning();

    if (!walletRow) {
      throw new Error('Failed to create wallet');
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async findById(id: string): Promise<Wallet> {
    const [walletRow] = await this.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), isNull(wallets.deletedAt)));

    if (!walletRow) {
      throw new NotFoundError('Wallet', id);
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async findByAgentId(agentId: string): Promise<Wallet | null> {
    const [walletRow] = await this.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.agentId, agentId), isNull(wallets.deletedAt)));

    if (!walletRow) {
      return null;
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async updateCircleWalletId(id: string, circleWalletId: string): Promise<Wallet> {
    this.logger.info({ walletId: id, circleWalletId }, 'Updating Circle wallet ID');

    const [walletRow] = await this.db
      .update(wallets)
      .set({
        circleWalletId,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(and(eq(wallets.id, id), isNull(wallets.deletedAt)))
      .returning();

    if (!walletRow) {
      throw new NotFoundError('Wallet', id);
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async updateStatus(id: string, status: WalletStatus): Promise<Wallet> {
    this.logger.info({ walletId: id, status }, 'Updating wallet status');

    const [walletRow] = await this.db
      .update(wallets)
      .set({
        status,
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(and(eq(wallets.id, id), isNull(wallets.deletedAt)))
      .returning();

    if (!walletRow) {
      throw new NotFoundError('Wallet', id);
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  private rowToRecord(row: WalletRow): WalletRecord {
    return {
      id: row.id,
      agentId: row.agentId,
      circleWalletId: row.circleWalletId || undefined,
      status: row.status as WalletStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt || undefined,
    };
  }

  private recordToWallet(record: WalletRecord): Wallet {
    return {
      id: record.id,
      agentId: record.agentId,
      circleWalletId: record.circleWalletId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
}
