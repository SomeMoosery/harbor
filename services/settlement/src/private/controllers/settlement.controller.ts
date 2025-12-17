import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { SettlementManager } from '../managers/settlement.manager.js';
import type { LockEscrowRequest } from '../../public/request/lockEscrowRequest.js';
import type { ReleaseEscrowRequest } from '../../public/request/releaseEscrowRequest.js';
import { handleError } from '../utils/errorHandler.js';

export class SettlementController {
  constructor(
    private readonly manager: SettlementManager,
    private readonly logger: Logger
  ) {}

  async lockEscrow(c: Context) {
    try {
      const body: LockEscrowRequest = await c.req.json();
      const escrowLock = await this.manager.lockEscrow(body);

      return c.json(escrowLock, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async releaseEscrow(c: Context) {
    try {
      const body: ReleaseEscrowRequest = await c.req.json();
      const settlement = await this.manager.releaseEscrow(body);

      return c.json(settlement, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getEscrowLock(c: Context) {
    try {
      const id = c.req.param('id');
      const escrowLock = await this.manager.getEscrowLock(id);

      return c.json(escrowLock);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getEscrowLockByBidId(c: Context) {
    try {
      const bidId = c.req.param('bidId');
      const escrowLock = await this.manager.getEscrowLockByBidId(bidId);

      if (!escrowLock) {
        return c.json({ error: 'Escrow lock not found' }, 404);
      }

      return c.json(escrowLock);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getSettlement(c: Context) {
    try {
      const id = c.req.param('id');
      const settlement = await this.manager.getSettlement(id);

      return c.json(settlement);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async health(c: Context) {
    return c.json({ status: 'ok', service: 'settlement' });
  }
}
