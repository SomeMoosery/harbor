import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import { getDb } from '../store/index.js';
import { UserResource } from '../resources/user.resource.js';
import { AgentResource } from '../resources/agent.resource.js';
import { ApiKeyResource } from '../resources/apiKey.resource.js';
import { SessionResource } from '../resources/session.resource.js';
import { UserManager } from '../managers/user.manager.js';
import { ApiKeyManager } from '../managers/apiKey.manager.js';
import { SessionManager } from '../managers/session.manager.js';
import { UserController } from '../controllers/user.controller.js';
import { ApiKeyController } from '../controllers/apiKey.controller.js';
import { SessionController } from '../controllers/session.controller.js';
import { createAgentSchema } from '../validators/user.validator.js';
import { handleError } from '../utils/errorHandler.js';

export function createRoutes(connectionString: string, logger: Logger) {
  const app = new Hono();

  // Enable CORS for local development
  app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Forwarded-For', 'X-Real-IP'],
  }));

  const { sql } = getDb(connectionString, logger);

  // Initialize layers
  const userResource = new UserResource(sql, logger);
  const agentResource = new AgentResource(sql, logger);
  const apiKeyResource = new ApiKeyResource(sql, logger);
  const sessionResource = new SessionResource(sql, logger);

  const userManager = new UserManager(userResource, agentResource, logger);
  const apiKeyManager = new ApiKeyManager(apiKeyResource, userResource, logger);
  const sessionManager = new SessionManager(sessionResource, userResource, logger);

  const userController = new UserController(userManager, logger);
  const apiKeyController = new ApiKeyController(apiKeyManager, logger);
  const sessionController = new SessionController(sessionManager, logger);

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ===================
  // Session routes (OAuth authentication)
  // ===================

  // Create session from OAuth (called by Gateway after Google OAuth exchange)
  app.post('/sessions/oauth', (c) => sessionController.createFromOAuth(c));

  // Validate session token (called by Gateway on each request)
  app.post('/sessions/validate', (c) => sessionController.validateSession(c));

  // Logout (delete session)
  app.post('/sessions/logout', (c) => sessionController.logout(c));

  // Complete onboarding (set user type)
  app.post('/onboarding/complete', (c) => sessionController.completeOnboarding(c));

  // ===================
  // User routes
  // ===================

  app.get('/users/:id', (c) => userController.getUser(c));

  // Change user type (from settings page)
  app.patch('/users/:userId/type', (c) => sessionController.changeUserType(c));

  // ===================
  // Agent routes
  // ===================

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

  // ===================
  // API Key routes
  // ===================

  app.post('/api-keys', (c) => apiKeyController.createApiKey(c));
  app.get('/users/:userId/api-keys', (c) => apiKeyController.listApiKeys(c));
  app.delete('/users/:userId/api-keys/:apiKeyId', (c) => apiKeyController.deleteApiKey(c));
  app.post('/api-keys/validate', (c) => apiKeyController.validateApiKey(c));

  return app;
}
