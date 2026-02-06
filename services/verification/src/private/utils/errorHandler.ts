import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';

export function handleError(c: Context, error: unknown, logger: Logger) {
  logger.error({ error }, 'Request failed');
  return c.json({ message: error instanceof Error ? error.message : 'Unknown error' }, 500);
}
