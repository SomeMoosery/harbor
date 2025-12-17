import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { TenderingManager } from '../managers/tendering.manager.js';
import { CreateAskRequest } from '../../public/request/createAskRequest.js';
import { askStatusValues, type AskStatus } from '../../public/model/askStatus.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * Controller handles HTTP request/response formatting
 */
export class TenderingController {
  constructor(
    private readonly manager: TenderingManager,
    private readonly logger: Logger
  ) {}

  async createAsk(c: Context) {
    try {
      // In production, extract from JWT or API key
      const userId = c.req.header('X-User-Id') ?? 'anonymous';

      const body: CreateAskRequest = await c.req.json();
      const ask = await this.manager.createAsk(userId, body);

      return c.json(ask, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getAsk(c: Context) {
    try {
      const id = c.req.param('id');
      const ask = await this.manager.getAsk(id);

      return c.json(ask);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async listAsks(c: Context) {
    try {
      const statusParam = c.req.query('status');
      const createdBy = c.req.query('createdBy');

      // Validate status is a valid AskStatus value
      const status: AskStatus | undefined = statusParam && askStatusValues.includes(statusParam as AskStatus)
        ? (statusParam as AskStatus)
        : undefined;

      const asks = await this.manager.listAsks({ status, createdBy });

      return c.json(asks);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async createBid(c: Context) {
    try {
      const agentId = c.req.header('X-Agent-Id') ?? 'anonymous';

      const body = await c.req.json();
      const bid = await this.manager.createBid(agentId, body);

      return c.json(bid, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getBidsForAsk(c: Context) {
    try {
      const askId = c.req.param('askId');
      const bids = await this.manager.getBidsForAsk(askId);

      return c.json(bids);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async acceptBid(c: Context) {
    try {
      const agentId = c.req.header('X-Agent-Id') ?? 'anonymous';
      const { bidId } = await c.req.json();

      const result = await this.manager.acceptBid(agentId, bidId);

      return c.json(result);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async submitDelivery(c: Context) {
    try {
      const agentId = c.req.header('X-Agent-Id') ?? 'anonymous';
      const { bidId, deliveryProof } = await c.req.json();

      const result = await this.manager.submitDelivery(agentId, bidId, deliveryProof);

      return c.json(result);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }
}
