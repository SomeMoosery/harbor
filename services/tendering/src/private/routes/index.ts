import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import { getDb } from '../store/index.js';
import { AskResource } from '../resources/ask.resource.js';
import { BidResource } from '../resources/bid.resource.js';
import { TenderingManager } from '../managers/tendering.manager.js';
import { TenderingController } from '../controllers/tendering.controller.js';
import { acceptBidSchema, createAskSchema, createBidSchema } from '../validators/ask.validator.js';
import { handleError } from '../utils/errorHandler.js';

export function createRoutes(connectionString: string, logger: Logger) {
  const app = new Hono();
  const db = getDb(connectionString);

  // Initialize layers
  const askResource = new AskResource(db, logger);
  const bidResource = new BidResource(db, logger);
  const manager = new TenderingManager(askResource, bidResource, logger);
  const controller = new TenderingController(manager, logger);

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Ask routes
  app.post('/asks', zValidator('json', createAskSchema), async (c) => {
    try {
      const userId = c.req.header('X-User-Id') ?? 'anonymous';
      const body = c.req.valid('json');
      const ask = await manager.createAsk(userId, body);
      return c.json(ask, 201);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  app.get('/asks', (c) => controller.listAsks(c));
  app.get('/asks/:id', (c) => controller.getAsk(c));
  app.get('/asks/:askId/bids', (c) => controller.getBidsForAsk(c));

  // Bid routes
  app.post('/bids', zValidator('json', createBidSchema), async (c) => {
    try {
      const agentId = c.req.header('X-Agent-Id') ?? 'anonymous';
      const body = c.req.valid('json');
      const bid = await manager.createBid(agentId, body);
      return c.json(bid, 201);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  app.post('/bids/accept', zValidator('json', acceptBidSchema), async (c) => {
    try {
      const userId = c.req.header('X-User-Id') ?? 'anonymous';
      const { bidId } = c.req.valid('json');
      const result = await manager.acceptBid(userId, bidId);
      return c.json(result);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  return app;
}
