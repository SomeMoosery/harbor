import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { HarborError } from '@harbor/errors';

export function handleError(c: Context, error: unknown, logger: Logger) {
  if (error instanceof HarborError) {
    logger.warn(
      {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      },
      'Request failed with Harbor error'
    );

    return c.json(
      {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error.statusCode as any
    );
  }

  logger.error(
    {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    },
    'Request failed with unexpected error'
  );

  return c.json(
    {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    500
  );
}
