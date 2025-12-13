import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { HarborError } from '@harbor/errors';
import { TenderingManager } from '../managers/tendering.manager.js';
import { CreateAskRequest } from '../../public/request/createAskRequest.js';

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
      return this.handleError(c, error);
    }
  }

  async getAsk(c: Context) {
    try {
      const id = c.req.param('id');
      const ask = await this.manager.getAsk(id);

      return c.json(ask);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  async listAsks(c: Context) {
    try {
      const status = c.req.query('status');
      const createdBy = c.req.query('createdBy');

      const asks = await this.manager.listAsks({ status, createdBy });

      return c.json(asks);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  async createBid(c: Context) {
    try {
      const agentId = c.req.header('X-Agent-Id') ?? 'anonymous';

      const body = await c.req.json();
      const bid = await this.manager.createBid(agentId, body);

      return c.json(bid, 201);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  async getBidsForAsk(c: Context) {
    try {
      const askId = c.req.param('askId');
      const bids = await this.manager.getBidsForAsk(askId);

      return c.json(bids);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  async acceptBid(c: Context) {
    try {
      const userId = c.req.header('X-User-Id') ?? 'anonymous';
      const { bidId } = await c.req.json();

      const result = await this.manager.acceptBid(userId, bidId);

      return c.json(result);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  private handleError(c: Context, error: unknown) {
    if (error instanceof HarborError) {
      this.logger.warn({ error: error.toJSON() }, 'Request error');
      return c.json(error.toJSON(), error.statusCode as 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500);
    }

    this.logger.error({ error }, 'Unexpected error');
    return c.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      500
    );
  }
}
