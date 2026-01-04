import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { ApiKeyManager } from '../managers/apiKey.manager.js';
import { handleError } from '../utils/errorHandler.js';

export class ApiKeyController {
  constructor(
    private readonly manager: ApiKeyManager,
    private readonly logger: Logger
  ) {}

  async createApiKey(c: Context) {
    try {
      const { userId, name } = await c.req.json();
      const apiKey = await this.manager.createApiKey(userId, name);

      return c.json(apiKey, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async listApiKeys(c: Context) {
    try {
      const userId = c.req.param('userId');
      const apiKeys = await this.manager.listApiKeys(userId);

      return c.json(apiKeys);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async deleteApiKey(c: Context) {
    try {
      const userId = c.req.param('userId');
      const apiKeyId = c.req.param('apiKeyId');

      await this.manager.deleteApiKey(apiKeyId, userId);

      return c.json({ success: true }, 200);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async validateApiKey(c: Context) {
    try {
      const { apiKey } = await c.req.json();
      const result = await this.manager.validateApiKey(apiKey);

      if (!result) {
        return c.json({ valid: false }, 401);
      }

      return c.json({ valid: true, userId: result.userId });
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }
}
