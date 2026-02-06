import type { Logger } from '@harbor/logger';
import postgres from 'postgres';
import type { Sql } from 'postgres';

let sql: Sql | null = null;

export function getDb(connectionString: string, logger: Logger): Sql {
  if (sql) {
    return sql;
  }

  logger.info('Initializing database connection');

  sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });

  return sql;
}

export async function closeDb(logger: Logger): Promise<void> {
  if (sql) {
    logger.info('Closing database connection');
    await sql.end();
    sql = null;
  }
}
