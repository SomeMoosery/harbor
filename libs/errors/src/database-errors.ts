/**
 * Database-specific error classes
 */

export class DatabaseConnectionError extends Error {
  constructor(
    public readonly connectionString: string,
    public readonly cause: Error
  ) {
    super(`Failed to connect to database: ${cause.message}`);
    this.name = 'DatabaseConnectionError';
  }
}

export class MigrationError extends Error {
  constructor(
    public readonly migrationName: string,
    public readonly cause: Error
  ) {
    super(`Migration '${migrationName}' failed: ${cause.message}`);
    this.name = 'MigrationError';
  }
}

export function isDatabaseError(error: unknown): error is { code: string; detail?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
