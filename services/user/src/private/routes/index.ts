import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { getDb } from '../store/index.js';
import { UserResource } from '../resources/user.resource.js';
import { AgentResource } from '../resources/agent.resource.js';
import { UserManager } from '../managers/user.manager.js';
import { UserController } from '../controllers/user.controller.js';
import { createUserSchema, createAgentSchema } from '../validators/user.validator.js';
import { handleError } from '../utils/errorHandler.js';

export function createRoutes(env: Environment, connectionString: string, logger: Logger) {
  const app = new Hono();
  const db = getDb(env, connectionString, logger);

  // Initialize layers
  const userResource = new UserResource(db, logger);
  const agentResource = new AgentResource(db, logger);
  const manager = new UserManager(userResource, agentResource, logger);
  const controller = new UserController(manager, logger);

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // User routes
  app.post('/users', zValidator('json', createUserSchema), async (c) => {
    try {
      const body = c.req.valid('json');
      const user = await manager.createUser(body);
      return c.json(user, 201);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  app.get('/users/:id', (c) => controller.getUser(c));

  // Agent routes
  app.get('/agents/:id', (c) => controller.getAgent(c));

  app.post('/users/:userId/agents', zValidator('json', createAgentSchema), async (c) => {
    try {
      const userId = c.req.param('userId');
      const body = c.req.valid('json');
      const agent = await manager.createAgent({
        userId,
        ...body,
      });
      return c.json(agent, 201);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  app.get('/users/:userId/agents', (c) => controller.getAgentsForUser(c));

  return app;
}
