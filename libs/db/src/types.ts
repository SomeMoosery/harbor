import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';

export interface DbConfig {
  env: Environment;
  connectionString: string;
  useLocalPostgres: boolean;
  logger: Logger;
}

export interface ConnectionPoolConfig {
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
}

export interface DatabaseConnection<TSchema extends Record<string, unknown>> {
  db: any; // drizzle instance
  close: () => Promise<void>;
}
