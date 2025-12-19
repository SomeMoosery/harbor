import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { getDb } from '../store/index.js';
import { UserResource } from '../resources/user.resource.js';
import { AgentResource } from '../resources/agent.resource.js';
import { ApiKeyResource } from '../resources/apiKey.resource.js';
import { UserManager } from '../managers/user.manager.js';
import { ApiKeyManager } from '../managers/apiKey.manager.js';
import { UserController } from '../controllers/user.controller.js';
import { ApiKeyController } from '../controllers/apiKey.controller.js';
import { createUserSchema, createAgentSchema } from '../validators/user.validator.js';
import { handleError } from '../utils/errorHandler.js';

export function createRoutes(env: Environment, connectionString: string, useLocalPostgres: boolean, logger: Logger) {
  const app = new Hono();

  // Enable CORS for local development
  app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  const db = getDb(env, connectionString, useLocalPostgres, logger);

  // Initialize layers
  const userResource = new UserResource(db, logger);
  const agentResource = new AgentResource(db, logger);
  const apiKeyResource = new ApiKeyResource(db, logger);

  const userManager = new UserManager(userResource, agentResource, logger);
  const apiKeyManager = new ApiKeyManager(apiKeyResource, userResource, logger);

  const userController = new UserController(userManager, logger);
  const apiKeyController = new ApiKeyController(apiKeyManager, logger);

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // User routes
  app.post('/users', zValidator('json', createUserSchema), async (c) => {
    try {
      const body = c.req.valid('json');
      const user = await userManager.createUser(body);
      return c.json(user, 201);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  app.get('/users/:id', (c) => userController.getUser(c));

  // Agent routes
  app.get('/agents/:id', (c) => userController.getAgent(c));

  app.post('/users/:userId/agents', zValidator('json', createAgentSchema), async (c) => {
    try {
      const userId = c.req.param('userId');
      const body = c.req.valid('json');
      const agent = await userManager.createAgent({
        userId,
        ...body,
      });
      return c.json(agent, 201);
    } catch (error) {
      return handleError(c, error, logger);
    }
  });

  app.get('/users/:userId/agents', (c) => userController.getAgentsForUser(c));

  // API Key routes
  app.post('/api-keys', (c) => apiKeyController.createApiKey(c));
  app.get('/users/:userId/api-keys', (c) => apiKeyController.listApiKeys(c));
  app.delete('/users/:userId/api-keys/:apiKeyId', (c) => apiKeyController.deleteApiKey(c));
  app.post('/api-keys/validate', (c) => apiKeyController.validateApiKey(c));

  return app;
}
