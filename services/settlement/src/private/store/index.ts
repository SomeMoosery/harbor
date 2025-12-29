import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { createLocalDb } from './local-db.js';
import { createProductionDb, closeProductionDb } from './production-db.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(env: Environment, connectionString: string, useLocalPostgres: boolean, logger: Logger): any {
  if (db) {
    return db;
  }

  if (env === 'local' && !useLocalPostgres) {
    db = createLocalDb(logger);
  } else {
    db = createProductionDb(connectionString, logger);
  }

  return db;
}

export async function closeDb(env: Environment, useLocalPostgres: boolean, logger: Logger) {
  if (env !== 'local' || useLocalPostgres) {
    await closeProductionDb(logger);
  }
  db = null;
}

export * from './schema.js';
