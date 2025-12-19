/**
 * Base error class for all Harbor errors
 */
export abstract class HarborError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Resource not found (404)
 */
export class NotFoundError extends HarborError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends HarborError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * Unauthorized (401)
 */
export class UnauthorizedError extends HarborError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
  }
}

/**
 * Forbidden (403)
 */
export class ForbiddenError extends HarborError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
  }
}

/**
 * Conflict (409)
 */
export class ConflictError extends HarborError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends HarborError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * Insufficient funds for transaction
 */
export class InsufficientFundsError extends HarborError {
  readonly code = 'INSUFFICIENT_FUNDS';
  readonly statusCode = 400;

  constructor(required: number, available: number) {
    super('Insufficient funds', { required, available });
  }
}

// Database errors
export { DatabaseConnectionError, MigrationError, isDatabaseError } from './database-errors.js';
