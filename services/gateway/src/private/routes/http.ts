import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { SERVICE_PORTS } from '@harbor/config';
import { createAuthMiddleware } from '../middleware/auth.js';

/**
 * Create HTTP routes for the gateway
 * These endpoints proxy to downstream services
 */
export function createHttpRoutes(config: Config, logger: Logger, wsServer: { broadcast: (event: any) => void; sendToAgent: (agentId: string, event: any) => void }) {
  const app = new Hono();

  // Enable CORS for local development
  app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  const auth = createAuthMiddleware(config, logger);

  // Health check (no auth required)
  app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }));

  // Internal endpoint for services to publish events (no auth - internal only)
  app.post('/internal/events', async (c) => {
    try {
      const body = await c.req.json();
      const { type, data, targetAgentId } = body;

      if (targetAgentId) {
        // Send to specific agent
        wsServer.sendToAgent(targetAgentId, { type, data });
      } else {
        // Broadcast to all connected clients
        wsServer.broadcast({ type, data });
      }

      logger.info({ type, targetAgentId }, 'Event published');
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to publish event');
      return c.json({ error: 'Failed to publish event' }, 500 as any);
    }
  });

  // Protected routes (require authentication)
  app.use('/api/*', auth);

  // Proxy to tendering service
  app.post('/api/asks', async (c) => {
    // TODO: Get userId from context and verify agent belongs to user
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/asks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api/bids', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api/bids/accept', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/bids/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  app.post('/api/delivery', async (c) => {
    const body = await c.req.json();

    const tenderingUrl = `http://localhost:${SERVICE_PORTS.tendering}`;
    const response = await fetch(`${tenderingUrl}/delivery/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': body.agentId,
      },
      body: JSON.stringify(body),
    });

    return c.json(await response.json(), response.status as any);
  });

  return app;
}
