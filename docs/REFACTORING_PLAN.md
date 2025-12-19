# Refactoring Plan: Current Branch Changes

## Summary
Analysis of files changed in recent commits reveals significant code duplication and opportunities for improved testability through shared utilities and abstractions.

## Issues Identified

### 1. **Duplicated Database Connection Code**
**Files**: `services/*/src/private/store/production-db.ts` (wallet, settlement, tendering, user)

**Problem**: Identical code duplicated across 4+ services
```typescript
// This exact code exists in every service
export function createProductionDb(connectionString: string, logger: Logger) {
  if (productionDbInstance) return productionDbInstance;

  client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  productionDbInstance = drizzle(client, { schema });
  return productionDbInstance;
}
```

**Impact**:
- Hard to test (module-level singletons)
- Duplicated connection pool configuration
- Changes require updating 4+ files
- No dependency injection

### 2. **Duplicated Migration Runner Logic**
**Files**: `services/*/src/private/store/migrate.ts`

**Problem**: `runMigrations()` function is identical across services (except table schemas)
- Same error handling
- Same logging
- Same branching logic for local vs production

### 3. **Temporal Columns Fix Applied**
**File**: `libs/db/src/temporal-columns.ts`

**Changes Made**:
- Fixed `toDriver` to return ISO strings instead of Date objects
- This was a good fix, no refactoring needed

### 4. **MockWalletProvider Fixed**
**File**: `services/wallet/src/private/providers/mockWalletProvider.ts`

**Changes Made**:
- Removed in-memory state that caused test issues
- This improves testability, no refactoring needed

## Proposed Refactoring

### Phase 1: Shared Database Utilities (`libs/db`)

#### 1.1 Create `libs/db/src/connection.ts`
Extract common connection logic with dependency injection:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Logger } from '@harbor/logger';

export interface ConnectionConfig {
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
}

export interface DatabaseConnection<T> {
  db: ReturnType<typeof drizzle<T>>;
  close: () => Promise<void>;
}

/**
 * Create a PostgreSQL database connection with Drizzle ORM
 *
 * Benefits:
 * - No module-level singletons (easier to test)
 * - Configurable connection pool settings
 * - Explicit cleanup via close()
 * - Type-safe schema
 */
export function createDatabaseConnection<T extends Record<string, unknown>>(
  connectionString: string,
  schema: T,
  logger: Logger,
  config: ConnectionConfig = {}
): DatabaseConnection<T> {
  const {
    max = 10,
    idle_timeout = 20,
    connect_timeout = 10,
  } = config;

  logger.info({
    host: new URL(connectionString).hostname,
    database: new URL(connectionString).pathname.slice(1),
    poolSize: max,
  }, 'Creating database connection');

  const client = postgres(connectionString, {
    max,
    idle_timeout,
    connect_timeout,
  });

  const db = drizzle(client, { schema });

  const close = async () => {
    logger.info('Closing database connection');
    await client.end();
  };

  logger.info('Database connection established');

  return { db, close };
}
```

**Usage in services**:
```typescript
// services/wallet/src/private/store/index.ts
import { createDatabaseConnection } from '@harbor/db/connection';
import * as schema from './schema.js';

let connection: DatabaseConnection<typeof schema> | null = null;

export function getDb(/* ... */) {
  if (!connection) {
    connection = createDatabaseConnection(
      connectionString,
      schema,
      logger,
      { max: 10 } // Can customize per service
    );
  }
  return connection.db;
}

export async function closeDb() {
  if (connection) {
    await connection.close();
    connection = null;
  }
}
```

#### 1.2 Create `libs/db/src/migrations.ts`
Extract common migration runner:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';

export interface MigrationOptions {
  env: Environment;
  useLocalPostgres: boolean;
  migrationsFolder?: string;
  createLocalSchema?: (db: any, logger: Logger) => Promise<void>;
}

/**
 * Run database migrations
 *
 * For PostgreSQL (local & deployed): Uses file-based migrations
 * For pg-mem (local only): Uses provided schema creation function
 */
export async function runDatabaseMigrations(
  db: ReturnType<typeof drizzle>,
  logger: Logger,
  options: MigrationOptions
): Promise<void> {
  const { env, useLocalPostgres, migrationsFolder = './drizzle', createLocalSchema } = options;

  logger.info({ env, useLocalPostgres }, 'Running database migrations');

  try {
    if (env === 'local' && !useLocalPostgres) {
      if (!createLocalSchema) {
        throw new Error('createLocalSchema function required for local pg-mem database');
      }
      await createLocalSchema(db, logger);
    } else {
      await migrate(db as any, { migrationsFolder });
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    }, 'Failed to run migrations');
    throw error;
  }
}
```

**Usage in services**:
```typescript
// services/wallet/src/private/store/migrate.ts
import { runDatabaseMigrations } from '@harbor/db/migrations';
import { createWalletSchema } from './schema-creator.js';

export async function runMigrations(/* ... */) {
  const db = getDb(env, connectionString, useLocalPostgres, logger);

  await runDatabaseMigrations(db, logger, {
    env,
    useLocalPostgres,
    migrationsFolder: './drizzle',
    createLocalSchema: createWalletSchema, // Service-specific
  });
}
```

#### 1.3 Create Service-Specific Schema Creators
Each service keeps its own schema creation (since tables differ):

```typescript
// services/wallet/src/private/store/schema-creator.ts
import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';

export async function createWalletSchema(db: any, logger: Logger): Promise<void> {
  logger.info('Creating wallet service schema for local environment');

  await db.execute(sql`CREATE TABLE IF NOT EXISTS wallets (...)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS transactions (...)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ledger_entries (...)`);

  // Indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wallets_agent_id ON wallets(agent_id)`);
  // ... more indexes

  logger.info('Wallet schema created successfully');
}
```

### Phase 2: Shared Types & Interfaces

#### 2.1 Create `libs/db/src/types.ts`
Common database-related types:

```typescript
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

export interface MigrationResult {
  success: boolean;
  tablesCreated: number;
  migrationsRun: number;
  error?: Error;
}
```

### Phase 3: Error Handling Utilities

#### 3.1 Create `libs/errors/src/database-errors.ts`
Standardized database error handling:

```typescript
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
```

## Benefits of Refactoring

### Improved Testability
1. **No module-level singletons**: Functions return connections instead of caching globally
2. **Dependency injection**: Pass logger, config as parameters
3. **Mockable**: Easy to mock `createDatabaseConnection` in tests
4. **Isolated**: Each test can create its own connection

### Reduced Duplication
- `production-db.ts` reduced from ~50 lines × 4 files = 200 lines to ~20 lines in shared lib
- `runMigrations` logic shared across all services
- Connection pool config centralized

### Easier Maintenance
- Database changes in one place
- Consistent error handling
- Type-safe configuration

### Better Testing Example

**Before** (hard to test):
```typescript
// Module-level singleton makes this hard to test
let productionDbInstance: ReturnType<typeof drizzle> | null = null;

export function createProductionDb(connectionString: string, logger: Logger) {
  if (productionDbInstance) return productionDbInstance;
  // ...
}

// Test has to deal with shared state
test('database operations', () => {
  // Can't easily reset productionDbInstance
  // Can't test with different configs in parallel
});
```

**After** (easy to test):
```typescript
// Factory function with no shared state
import { createDatabaseConnection } from '@harbor/db/connection';

test('database operations', () => {
  const mockLogger = createMockLogger();
  const conn = createDatabaseConnection(
    'postgresql://test',
    schema,
    mockLogger
  );

  // Test with conn.db
  // Each test gets fresh connection

  await conn.close();
});
```

## Implementation Checklist

- [ ] Create `libs/db/src/connection.ts` with `createDatabaseConnection()`
- [ ] Create `libs/db/src/migrations.ts` with `runDatabaseMigrations()`
- [ ] Create `libs/db/src/types.ts` with shared types
- [ ] Create `libs/errors/src/database-errors.ts` with error classes
- [ ] Refactor `services/wallet/src/private/store/`:
  - [ ] Update `production-db.ts` to use shared utilities
  - [ ] Update `migrate.ts` to use shared migration runner
  - [ ] Create `schema-creator.ts` for wallet-specific tables
- [ ] Refactor `services/settlement/src/private/store/` (same pattern)
- [ ] Refactor `services/tendering/src/private/store/` (same pattern)
- [ ] Refactor `services/user/src/private/store/` (same pattern)
- [ ] Add unit tests for shared utilities
- [ ] Add integration tests for database connection/migration
- [ ] Update documentation

## Files to Change

### New Files
- `libs/db/src/connection.ts`
- `libs/db/src/migrations.ts`
- `libs/db/src/types.ts`
- `libs/errors/src/database-errors.ts`
- `services/wallet/src/private/store/schema-creator.ts`
- `services/settlement/src/private/store/schema-creator.ts`
- `services/tendering/src/private/store/schema-creator.ts`
- `services/user/src/private/store/schema-creator.ts`

### Modified Files
- `services/wallet/src/private/store/production-db.ts` (simplified)
- `services/wallet/src/private/store/migrate.ts` (simplified)
- `services/wallet/src/private/store/index.ts` (use new connection)
- `services/settlement/src/private/store/production-db.ts` (simplified)
- `services/settlement/src/private/store/migrate.ts` (simplified)
- `services/settlement/src/private/store/index.ts` (use new connection)
- `services/tendering/src/private/store/production-db.ts` (simplified)
- `services/tendering/src/private/store/migrate.ts` (simplified)
- `services/tendering/src/private/store/index.ts` (use new connection)
- `services/user/src/private/store/production-db.ts` (simplified)
- `services/user/src/private/store/migrate.ts` (simplified)
- `services/user/src/private/store/index.ts` (use new connection)

## Testing Strategy

### Unit Tests
- `libs/db/src/connection.test.ts`: Test connection creation, config, cleanup
- `libs/db/src/migrations.test.ts`: Test migration runner with mocks
- `libs/errors/src/database-errors.test.ts`: Test error classes

### Integration Tests
- `libs/db/integration/connection.test.ts`: Test real PostgreSQL connection
- `services/wallet/src/private/store/integration.test.ts`: Test wallet DB operations

## Estimated Impact
- **Lines of code removed**: ~150-200 lines of duplication
- **Files simplified**: 12 files across 4 services
- **New shared utilities**: 4 files (~300 lines, but reusable)
- **Net reduction**: ~100-150 lines
- **Testability**: Significant improvement (no more singletons)
- **Maintainability**: Single source of truth for DB logic

## Notes
- This refactoring is scoped to only the database layer changes from this branch
- Does not touch business logic or API layer
- Maintains backward compatibility (same external interfaces)
- Can be done incrementally (one service at a time)
