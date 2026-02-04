# AGENTS.md

## Purpose & Scope
Harbor is a TypeScript microservices marketplace platform for AI agents. It is a monorepo using pnpm workspaces and Turborepo.

## Repo Layout (High-Level)
- `services/`: Domain services (deployable units)
- `libs/`: Shared internal libraries
- `apps/`: UI apps (dashboard, landing)
- `examples/`: SDK agents (buyer/seller)

## Services & Ports (Source of Truth: `libs/config/src/ports.ts`)
- `gateway`: 3000 (HTTP), 3005 (WebSocket)
- `tendering`: 3001
- `user`: 3002
- `wallet`: 3003
- `settlement`: 3004

Note: Documentation may diverge; treat `libs/config/src/ports.ts` as authoritative.

## Service Architecture Pattern
- Public/private split:
- `public/` exports clients/types used by other services.
- `private/` holds routes/controllers/managers/resources/store.

Layer responsibilities:
- Routes → controllers → managers → resources/store (providers/strategies as needed).

Import rules:
- Services may import other services only via `public/` clients/types.
- Never import `private/` modules or access other services' databases directly.

## Shared Libraries
- `@harbor/config` (env + service URLs)
- `@harbor/logger` (pino)
- `@harbor/errors`
- `@harbor/db` (shared DB helpers)
- `@harbor/sdk` (agent SDK)

## Environment & Database
- `HARBOR_ENV` / `NODE_ENV` determine local vs staging/production.
- Local uses `pg-mem` with auto-migrations by default.
- Staging/production use real Postgres with manual migrations.

Key env vars:
- `HARBOR_ENV`, `DATABASE_URL`, `DB_AUTO_MIGRATE`
- `ESCROW_WALLET_ID`, `REVENUE_WALLET_ID`
- Fee vars, Circle/Stripe keys

## Primary Commands
- `pnpm dev` (runs `scripts/dev.sh`, clears ports 3000–3005, starts services)
- `pnpm build`, `pnpm test`, `pnpm lint`
- `pnpm db:generate`, `pnpm db:migrate` (real DB envs)

## Testing
- See `TESTING_GUIDE.md` for end-to-end flows.
- `pg-mem` resets on restart; use unique IDs or restart services to clear state.

## Key Docs & References
- `README.md`
- `ARCHITECTURE.md`
- `STRUCTURE_OVERVIEW.md`
- `LOCAL_DEVELOPMENT.md`
- `DATABASE_SETUP.md`
- `TESTING_GUIDE.md`
- `services/wallet/LEDGER_RECONCILIATION.md`
- `services/tendering/README.md`
- `services/gateway/README.md`

## Project Guidance (from `CLAUDE.md`)
- Prioritize readability over cleverness.
- Ask clarifying questions before architectural changes.
- Use strong typing wherever possible.

## Maintenance Rule
After every major change, review diffs against `AGENTS.md` and update it as needed so it stays accurate.
