import type { Context, Next } from 'hono';
import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { SERVICE_PORTS } from '@harbor/config';

/**
 * Authentication middleware
 * Validates API key from Authorization header
 */
export function createAuthMiddleware(_config: Config, logger: Logger) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401 as any);
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Call user service to validate API key
      const userServiceUrl = `http://localhost:${SERVICE_PORTS.user}`;
      const response = await fetch(`${userServiceUrl}/api-keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey }),
      });

      if (!response.ok) {
        return c.json({ error: 'Invalid API key' }, 401 as any);
      }

      const data = (await response.json()) as { valid: boolean; userId: string };

      if (!data.valid) {
        return c.json({ error: 'Invalid API key' }, 401 as any);
      }

      // Store userId in context for downstream use
      c.set('userId', data.userId);

      await next();
    } catch (error) {
      logger.error({ error }, 'Failed to validate API key');
      return c.json({ error: 'Authentication failed' }, 500 as any);
    }
  };
}
