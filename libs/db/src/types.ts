import type { Sql } from 'postgres';

/**
 * Database connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Maximum number of connections in the pool (default: 10) */
  max?: number;
  /** Idle timeout in seconds (default: 20) */
  idle_timeout?: number;
  /** Connection timeout in seconds (default: 10) */
  connect_timeout?: number;
}

/**
 * Database connection object returned by createDatabaseConnection
 */
export interface DatabaseConnection {
  /** postgres.js SQL instance for executing queries */
  sql: Sql;
  /** Close the database connection and clean up resources */
  close: () => Promise<void>;
}

/**
 * Generic database configuration
 */
export interface DbConfig {
  connectionString: string;
  poolConfig?: ConnectionPoolConfig;
}
