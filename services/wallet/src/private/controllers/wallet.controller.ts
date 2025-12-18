import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { WalletManager } from '../managers/wallet.manager.js';
import type { CreateWalletRequest } from '../../public/request/createWalletRequest.js';
import type { DepositRequest } from '../../public/request/depositRequest.js';
import type { TransferRequest } from '../../public/request/transferRequest.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * Controller handles HTTP request/response formatting for wallet operations
 */
export class WalletController {
  constructor(
    private readonly manager: WalletManager,
    private readonly logger: Logger
  ) {}

  async createWallet(c: Context) {
    try {
      const body: CreateWalletRequest = await c.req.json();
      const wallet = await this.manager.createWallet(body.agentId);

      return c.json(wallet, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getWallet(c: Context) {
    try {
      const id = c.req.param('id');
      const wallet = await this.manager.getWallet(id);

      return c.json(wallet);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getWalletByAgentId(c: Context) {
    try {
      const agentId = c.req.param('agentId');
      const wallet = await this.manager.getWalletByAgentId(agentId);

      return c.json(wallet);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getBalance(c: Context) {
    try {
      const id = c.req.param('id');
      const balance = await this.manager.getBalance(id);

      return c.json(balance);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getBalanceByAgentId(c: Context) {
    try {
      const agentId = c.req.param('agentId');
      const wallet = await this.manager.getWalletByAgentId(agentId);
      const balance = await this.manager.getBalance(wallet.id);

      return c.json(balance);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async deposit(c: Context) {
    try {
      const body: DepositRequest = await c.req.json();
      const transaction = await this.manager.deposit(
        body.walletId,
        body.amount,
        body.paymentMethodId
      );

      return c.json(transaction, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async transfer(c: Context) {
    try {
      const body: TransferRequest = await c.req.json();
      const transaction = await this.manager.transfer(
        body.fromWalletId,
        body.toWalletId,
        body.amount
      );

      return c.json(transaction, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getTransactions(c: Context) {
    try {
      const id = c.req.param('id');
      const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
      const transactions = await this.manager.getTransactions(id, limit);

      return c.json(transactions);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async health(c: Context) {
    return c.json({ status: 'ok', service: 'wallet' });
  }
}
