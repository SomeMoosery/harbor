# Local Development Guide

This guide shows you how to run the Harbor services locally with an in-memory database.

## Prerequisites

- Node.js >= 20
- pnpm >= 9

**Note:** You do NOT need PostgreSQL installed for local development! The services use an in-memory database.

## Quick Start (5 Steps)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

The default `.env` is already configured for local development:
```bash
HARBOR_ENV=local
DATABASE_URL=    # Leave empty for in-memory database
```

### 3. Start the Tendering Service

```bash
cd services/tendering
pnpm dev
```

You should see output like:
```
[12:34:56] INFO (tendering): Starting Tendering service
    env: "local"
    port: 3002
    autoMigrate: true
[12:34:56] INFO (tendering): Creating in-memory PostgreSQL database (pg-mem)
[12:34:56] INFO (tendering): In-memory database created successfully
[12:34:56] INFO (tendering): Running database migrations
    env: "local"
[12:34:56] INFO (tendering): Creating database schema for local environment
[12:34:56] INFO (tendering): Database schema created successfully
[12:34:56] INFO (tendering): Database migrations completed successfully
[12:34:56] INFO (tendering): Tendering service ready
    url: "http://localhost:3002"
    env: "local"
```

### 4. Test the Service

In another terminal, try these commands:

```bash
# Health check
curl http://localhost:3002/health
# Response: {"status":"ok"}

# Create an ask
curl -X POST http://localhost:3002/asks \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{
    "title": "Build a landing page",
    "description": "Need a responsive landing page with modern design",
    "requirements": {"tech": "React", "deadline": "2 weeks"},
    "minBudget": 400,
    "maxBudget": 600
  }'

# List all asks
curl http://localhost:3002/asks

# Create a bid (replace {askId} with the ID from the ask you created)
curl -X POST http://localhost:3002/bids \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: agent456" \
  -d '{
    "askId": "{askId}",
    "proposedPrice": 450,
    "estimatedDuration": 864000000,
    "proposal": "I can deliver a high-quality landing page using React and Tailwind"
  }'

# Get bids for an ask
curl http://localhost:3002/asks/{askId}/bids

# Accept a bid (replace {bidId} with the ID from the bid you created)
curl -X POST http://localhost:3002/bids/accept \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{"bidId": "{bidId}"}'
```

### 5. Make Changes and See Live Updates

The service is running with `tsx watch`, so any changes to `.ts` files will automatically restart the server.

Try editing `services/tendering/src/private/routes/index.ts` and watch the server restart!

## How It Works

### In-Memory Database (Local Development)

When `HARBOR_ENV=local`, the service:

1. ✅ Creates an **in-memory PostgreSQL database** using `pg-mem`
2. ✅ Automatically runs **migrations** to create tables
3. ✅ Starts **fresh on every restart** (no leftover data)
4. ✅ **No external database needed** (no PostgreSQL installation required)

The database exists only in memory and is destroyed when you stop the server.

### Database Migrations

Migrations run automatically in local mode. The migration system:

- Creates tables based on `src/private/store/schema.ts`
- Creates indexes for performance
- Tracks migration history (like Flyway)
- Ensures migrations run exactly once

You can see the migration code in:
- `services/tendering/src/private/store/migrate.ts`
- `services/tendering/src/private/store/schema.ts`

### Environment Detection

The service detects which environment it's running in:

```typescript
// Priority order:
1. HARBOR_ENV environment variable
2. NODE_ENV === 'development' → 'local'
3. NODE_ENV === 'production' → 'production'
4. Default to 'local'
```

Based on the environment:
- **local**: In-memory database, auto-migrations
- **staging/production**: Real PostgreSQL, manual migrations

## Configuration Options

### Disable Auto-Migration

If you want to run migrations manually even in local mode:

```bash
# .env
DB_AUTO_MIGRATE=false
```

Then run migrations manually:
```bash
cd services/tendering
pnpm dev
# In another terminal:
# (manual migration not yet implemented - auto is recommended for local)
```

### Change Service Port

```bash
# .env
PORT=4000
```

Or set per-service:
```bash
TENDERING_PORT=4000
```

### Enable Debug Logging

```bash
# .env
LOG_LEVEL=debug
```

## Common Issues

### "Failed to run migrations"

This usually means there's a syntax error in the migration SQL. Check the error message and fix the schema in `src/private/store/schema.ts`.

### Port Already in Use

If port 3002 is already in use, either:
1. Stop the other process using that port
2. Change the port in `.env`: `PORT=3003`

### Module Not Found

Make sure you've installed dependencies:
```bash
pnpm install
```

## Data Persistence

### Local Development (In-Memory)

Data is **NOT persisted** across restarts. Every time you start the server, you get a fresh database.

This is intentional for local development:
- ✅ Clean slate every time
- ✅ No database state issues
- ✅ Fast startup

If you need persistent data, use fixtures/seed data (coming soon).

### Staging/Production

When you deploy to staging/production:
- Set `HARBOR_ENV=staging` or `HARBOR_ENV=production`
- Set `DATABASE_URL` to your Cloud SQL connection string
- Migrations will NOT auto-run (you run them manually)
- Data persists in the real PostgreSQL database

## Next Steps

### Add More Data

Try creating multiple asks, bids, and testing the workflow:
1. User creates ask
2. Agent submits bid
3. User accepts bid
4. Ask status changes to "IN_PROGRESS"

### Explore the Code

Look at how the data flows:
- `src/private/routes/index.ts` - HTTP endpoints
- `src/private/controllers/` - Request handling
- `src/private/managers/` - Business logic
- `src/private/resources/` - Database access
- `src/private/store/schema.ts` - Database schema

### Run Multiple Services

Once you add more services (agent, user, wallet), you can run them all:
```bash
# From root directory
pnpm dev
```

Each service will run on its own port with its own in-memory database.

## Switching to Real PostgreSQL (Later)

When you're ready to use a real database:

```bash
# .env
HARBOR_ENV=staging
DATABASE_URL=postgresql://user:password@localhost:5432/harbor_tendering

# Disable auto-migrations (run them manually)
DB_AUTO_MIGRATE=false
```

Then run migrations:
```bash
cd services/tendering
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Run migrations
pnpm dev          # Start service
```

## Summary

**To run the server locally:**

1. `pnpm install`
2. `cp .env.example .env`
3. `cd services/tendering && pnpm dev`
4. Visit http://localhost:3002/health

That's it! No database setup required. The in-memory database starts automatically and migrations run on startup.
