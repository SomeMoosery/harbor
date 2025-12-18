import type { Logger } from '@harbor/logger';
import { ApiKeyResource } from '../resources/apiKey.resource.js';
import { UserResource } from '../resources/user.resource.js';
import { NotFoundError } from '@harbor/errors';
import type { ApiKey } from '../../public/model/apiKey.js';

export class ApiKeyManager {
  constructor(
    private readonly apiKeyResource: ApiKeyResource,
    private readonly userResource: UserResource,
    private readonly logger: Logger
  ) {}

  async createApiKey(userId: string, name?: string): Promise<ApiKey> {
    // Verify user exists
    await this.userResource.findById(userId);

    return this.apiKeyResource.create({ userId, name });
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyResource.findByUserId(userId);
  }

  async deleteApiKey(apiKeyId: string, userId: string): Promise<void> {
    await this.apiKeyResource.delete(apiKeyId, userId);
  }

  async validateApiKey(key: string): Promise<{ userId: string } | null> {
    const apiKey = await this.apiKeyResource.findByKey(key);

    if (!apiKey) {
      return null;
    }

    // Update last used timestamp (don't await to avoid blocking)
    this.apiKeyResource.updateLastUsed(key).catch(error => {
      this.logger.warn({ error, key: key.substring(0, 12) + '...' }, 'Failed to update API key last used timestamp');
    });

    return { userId: apiKey.userId };
  }
}
