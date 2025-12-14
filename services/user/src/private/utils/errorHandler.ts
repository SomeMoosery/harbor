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

  // Extract error details for better logging
  const errorDetails = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    name: error instanceof Error ? error.name : undefined,
    // Try to get more details if it's a database error
    ...(error && typeof error === 'object' && 'code' in error ? { code: (error as any).code } : {}),
    ...(error && typeof error === 'object' && 'detail' in error ? { detail: (error as any).detail } : {}),
  };

  logger.error({ error: errorDetails }, 'Unexpected error');
  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    500
  );
}
