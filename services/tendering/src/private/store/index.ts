import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

let db: ReturnType<typeof drizzle> | null = null;

export function getDb(connectionString: string) {
  if (!db) {
    const client = postgres(connectionString);
    db = drizzle(client, { schema });
  }
  return db;
}

export * from './schema.js';
