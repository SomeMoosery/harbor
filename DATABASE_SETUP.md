# Database Setup Summary

This document explains the database architecture and how it works across different environments.

## Architecture Overview

Harbor uses an **environment-aware database system** that automatically switches between:

- **Local Development**: In-memory PostgreSQL (pg-mem) - no external database needed
- **Staging/Production**: Real PostgreSQL (Cloud SQL, RDS, etc.)

## How It Works

### Environment Detection

The system detects the environment using this priority:

```
1. HARBOR_ENV environment variable (local | staging | production)
2. NODE_ENV === 'development' → 'local'
3. NODE_ENV === 'production' → 'production'
4. Default to 'local'
```

### Database Switching

Based on the environment, the database factory (`services/*/src/private/store/index.ts`) returns:

| Environment | Database Type | Auto-Migrate | Persistence |
|------------|---------------|--------------|-------------|
| `local` | pg-mem (in-memory) | Yes (default) | No (fresh on restart) |
| `staging` | PostgreSQL | No (default) | Yes |
| `production` | PostgreSQL | No (default) | Yes |

### Migration System

The migration system works like Flyway:

- **Migration files** are generated from Drizzle schema (`src/private/store/schema.ts`)
- **Versioned migrations** in `drizzle/` directory (e.g., `0001_initial.sql`)
- **Migration history** tracked in database
- **Idempotent** - migrations run exactly once

#### Local Environment (In-Memory)

For `local`, migrations are created **programmatically** in `src/private/store/migrate.ts`:

```typescript
// Creates tables directly in memory from schema
await createSchemaForLocalDb(db, logger);
```

This executes CREATE TABLE statements based on your Drizzle schema.

#### Staging/Production

For `staging`/`production`, migrations are **file-based**:

```bash
pnpm db:generate  # Generate SQL migration files from schema changes
pnpm db:migrate   # Run migrations against real database
```

## Configuration

### Environment Variables

```bash
# .env

# Environment (local, staging, production)
HARBOR_ENV=local

# Database connection (only needed for staging/production)
DATABASE_URL=postgresql://user:password@host:5432/database

# Auto-migration (default: true for local, false for staging/prod)
DB_AUTO_MIGRATE=false
```

### Auto-Migration Behavior

| HARBOR_ENV | DB_AUTO_MIGRATE not set | DB_AUTO_MIGRATE=true | DB_AUTO_MIGRATE=false |
|-----------|-------------------------|----------------------|----------------------|
| local | ✅ Auto-run | ✅ Auto-run | ❌ Manual |
| staging | ❌ Manual | ✅ Auto-run | ❌ Manual |
| production | ❌ Manual | ✅ Auto-run | ❌ Manual |

**Recommendation**:
- Local: Auto-run (default) ✅
- Staging/Production: Manual ✅

## Local Development Workflow

### 1. Start the Server

```bash
cd services/tendering
pnpm dev
```

On startup:
1. ✅ Creates in-memory PostgreSQL database (pg-mem)
2. ✅ Runs migrations automatically
3. ✅ Starts HTTP server

You'll see logs like:
```
INFO: Creating in-memory PostgreSQL database (pg-mem)
INFO: Running database migrations
INFO: Creating database schema for local environment
INFO: Database migrations completed successfully
INFO: Tendering service ready
```

### 2. Make Schema Changes

Edit `src/private/store/schema.ts`:

```typescript
export const asks = pgTable('asks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  // Add new field:
  priority: text('priority').notNull().default('normal'),
  // ...
});
```

### 3. Restart the Server

```bash
# Ctrl+C to stop
pnpm dev
```

The migration system will automatically create the new field!

### No Need To:
- ❌ Install PostgreSQL
- ❌ Create databases
- ❌ Run migration commands
- ❌ Worry about leftover data

## Staging/Production Workflow

### 1. Set Environment

```bash
# .env
HARBOR_ENV=staging
DATABASE_URL=postgresql://user:password@35.123.45.67:5432/harbor_tendering
DB_AUTO_MIGRATE=false
```

### 2. Generate Migrations (After Schema Changes)

```bash
cd services/tendering
pnpm db:generate
```

This creates a new migration file in `drizzle/`:
```
drizzle/
├── 0001_initial_schema.sql
├── 0002_add_priority_field.sql  # New!
└── meta/
    └── _journal.json
```

### 3. Review Migration SQL

Check the generated SQL in `drizzle/0002_add_priority_field.sql`:

```sql
ALTER TABLE "asks" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;
```

### 4. Run Migrations

```bash
pnpm db:migrate
```

This applies the migration to the real database.

### 5. Start the Server

```bash
pnpm dev
# or
pnpm start  # production
```

The server will start WITHOUT running migrations (since `DB_AUTO_MIGRATE=false`).

## Database Schema

Current schema for the Tendering service:

### `asks` table
- `id` - UUID primary key
- `title` - Text, required
- `description` - Text, required
- `requirements` - JSONB, required
- `min_budget` - Real (float), required
- `max_budget` - Real (float), required
- `budget_flexibility_amount` - Real (float), optional
- `created_by` - Text, required
- `status` - Enum: OPEN, IN_PROGRESS, COMPLETED, CANCELLED
- `created_at` - Timestamp, default now()
- `updated_at` - Timestamp, default now()
- `deleted_at` - Timestamp, nullable (soft delete)

### `bids` table
- `id` - UUID primary key
- `ask_id` - UUID, foreign key to asks.id
- `agent_id` - Text, required
- `proposed_price` - Real (float), required
- `estimated_duration` - Integer (milliseconds), required
- `proposal` - Text, required
- `status` - Enum: PENDING, ACCEPTED, REJECTED
- `created_at` - Timestamp, default now()
- `updated_at` - Timestamp, default now()
- `deleted_at` - Timestamp, nullable (soft delete)

### Indexes
- `asks.status` - For filtering by status
- `asks.created_by` - For filtering by user
- `bids.ask_id` - For getting all bids for an ask
- `bids.agent_id` - For getting all bids by an agent

## Implementation Files

### Config Library
- `libs/config/src/environment.ts` - Environment detection
- `libs/config/src/index.ts` - Config with auto-migrate logic

### Tendering Service
- `src/private/store/index.ts` - Database factory (environment-aware)
- `src/private/store/local-db.ts` - In-memory PostgreSQL (pg-mem)
- `src/private/store/production-db.ts` - Real PostgreSQL connection
- `src/private/store/migrate.ts` - Migration runner
- `src/private/store/schema.ts` - Drizzle schema definition
- `src/main.ts` - Server startup with migration execution

## Benefits of This Approach

### For Local Development
✅ **No setup required** - Just `pnpm dev` and you're running
✅ **Fast** - In-memory database is instant
✅ **Clean** - Fresh database on every restart
✅ **Reliable** - No "forgot to run migrations" issues
✅ **Portable** - Works on any machine without PostgreSQL

### For Staging/Production
✅ **Safe** - Migrations don't auto-run (you review first)
✅ **Versioned** - Migration history is tracked
✅ **Rollback-able** - Can revert migrations if needed
✅ **Auditable** - Clear migration files in git history

## Future Enhancements

### Seed Data (Coming Soon)

Add seed data for local development:

```typescript
// src/private/store/seed.ts
export async function seedLocalDb(db, logger) {
  await db.insert(asks).values([
    { title: 'Sample Ask 1', ... },
    { title: 'Sample Ask 2', ... },
  ]);
}
```

### Migration Rollback

Add rollback capability:

```bash
pnpm db:rollback  # Undo last migration
```

### Cross-Service Transactions

For operations that span multiple services, consider:
- Saga pattern
- Two-phase commit
- Event sourcing

## Troubleshooting

### "Failed to run migrations"

Check the error message. Common causes:
- Syntax error in schema.ts
- Conflicting migration
- Database permissions (staging/prod)

### "Database connection failed" (Staging/Production)

Check:
- `DATABASE_URL` is correct
- Database server is running
- Network connectivity
- Firewall rules (Cloud SQL)

### Data Not Persisting (Local)

This is expected! Local uses in-memory database.

If you need persistence:
- Use fixtures/seed data (coming soon)
- Or switch to real PostgreSQL for local dev

### Schema Changes Not Reflected

For local: Restart the server (Ctrl+C, then `pnpm dev`)

For staging/prod:
1. Run `pnpm db:generate`
2. Run `pnpm db:migrate`
3. Restart the server

## Summary

You now have a **production-ready database system** that:

- ✅ Uses in-memory PostgreSQL for local (no setup needed)
- ✅ Switches to real PostgreSQL for staging/production
- ✅ Auto-runs migrations in local (configurable)
- ✅ Requires manual migrations in staging/production (safe)
- ✅ Tracks migration history like Flyway
- ✅ Provides clean startup every time in local

**To run locally**: Just `pnpm dev` - no database setup required!
