import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { HarborError } from '@harbor/errors';

/**
 * Handles errors and returns appropriate HTTP responses
 */
export function handleError(c: Context, error: unknown, logger: Logger) {
  if (error instanceof HarborError) {
    logger.warn({ error: error.toJSON() }, 'Request error');
    return c.json(error.toJSON(), error.statusCode as 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500);
  }

  logger.error({ error }, 'Unexpected error');
  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    500
  );
}
