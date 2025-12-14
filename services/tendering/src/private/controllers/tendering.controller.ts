import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { HarborError } from '@harbor/errors';
import { TenderingManager } from '../managers/tendering.manager.js';
import { CreateAskRequest } from '../../public/request/createAskRequest.js';
import { askStatusValues, type AskStatus } from '../../public/model/askStatus.js';

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
      const statusParam = c.req.query('status');
      const createdBy = c.req.query('createdBy');

      // Validate status is a valid AskStatus value
      const status: AskStatus | undefined = statusParam && askStatusValues.includes(statusParam as AskStatus)
        ? (statusParam as AskStatus)
        : undefined;

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

    // Extract error details for better logging
    // TODO should we extract this to a shared lib?
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      ...(error && typeof error === 'object' && 'code' in error ? { code: (error as any).code } : {}),
      ...(error && typeof error === 'object' && 'detail' in error ? { detail: (error as any).detail } : {}),
    };

    this.logger.error({ error: errorDetails }, 'Unexpected error');
    return c.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      500
    );
  }
}
