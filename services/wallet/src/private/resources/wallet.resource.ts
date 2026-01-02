import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import { Wallet, WalletStatus } from '../../public/model/wallet.js';
import { WalletRecord } from '../records/walletRecord.js';
import { Temporal } from 'temporal-polyfill';

interface WalletRow {
  id: string;
  agent_id: string;
  circle_wallet_id: string | null;
  wallet_address: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class WalletResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  async create(data: {
    agentId: string;
    circleWalletId?: string;
    walletAddress?: string;
    status?: WalletStatus;
  }): Promise<Wallet> {
    this.logger.info({ data }, 'Creating wallet');

    const [walletRow] = await this.sql<WalletRow[]>`
      INSERT INTO wallets (agent_id, circle_wallet_id, wallet_address, status)
      VALUES (
        ${data.agentId},
        ${data.circleWalletId || null},
        ${data.walletAddress || null},
        ${data.status || 'ACTIVE'}
      )
      RETURNING *
    `;

    if (!walletRow) {
      throw new Error('Failed to create wallet');
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async findById(id: string): Promise<Wallet> {
    const [walletRow] = await this.sql<WalletRow[]>`
      SELECT * FROM wallets
      WHERE id = ${id}
        AND deleted_at IS NULL
    `;

    if (!walletRow) {
      throw new NotFoundError('Wallet', id);
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async findByAgentId(agentId: string): Promise<Wallet | null> {
    const [walletRow] = await this.sql<WalletRow[]>`
      SELECT * FROM wallets
      WHERE agent_id = ${agentId}
        AND deleted_at IS NULL
    `;

    if (!walletRow) {
      return null;
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async updateCircleWalletId(id: string, circleWalletId: string): Promise<Wallet> {
    this.logger.info({ walletId: id, circleWalletId }, 'Updating Circle wallet ID');

    const [walletRow] = await this.sql<WalletRow[]>`
      UPDATE wallets
      SET circle_wallet_id = ${circleWalletId},
          updated_at = NOW()
      WHERE id = ${id}
        AND deleted_at IS NULL
      RETURNING *
    `;

    if (!walletRow) {
      throw new NotFoundError('Wallet', id);
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  async updateStatus(id: string, status: WalletStatus): Promise<Wallet> {
    this.logger.info({ walletId: id, status }, 'Updating wallet status');

    const [walletRow] = await this.sql<WalletRow[]>`
      UPDATE wallets
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
        AND deleted_at IS NULL
      RETURNING *
    `;

    if (!walletRow) {
      throw new NotFoundError('Wallet', id);
    }

    const record = this.rowToRecord(walletRow);
    return this.recordToWallet(record);
  }

  private rowToRecord(row: WalletRow): WalletRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      circleWalletId: row.circle_wallet_id || undefined,
      walletAddress: row.wallet_address || undefined,
      status: row.status as WalletStatus,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
      deletedAt: row.deleted_at
        ? Temporal.Instant.fromEpochMilliseconds(row.deleted_at.getTime()).toZonedDateTimeISO('UTC')
        : undefined,
    };
  }

  private recordToWallet(record: WalletRecord): Wallet {
    return {
      id: record.id,
      agentId: record.agentId,
      circleWalletId: record.circleWalletId,
      walletAddress: record.walletAddress || '', // TODO shouldn't be nullable...
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
}
