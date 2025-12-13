# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repo overview
- TypeScript (ESM) monorepo managed with **pnpm workspaces** and orchestrated by **Turborepo**.
- Code is organized as:
  - `services/`: independently deployable services (HTTP servers)
  - `libs/`: shared internal libraries (`@harbor/config`, `@harbor/logger`, `@harbor/errors`)

Note: Several docs describe additional services (`agent`, `user`, `escrow`, etc.), but in the current repo the only implemented code is in `services/tendering` and `libs/*`. `services/gateway` is currently a skeleton (dirs + README only) and `services/wallet` is currently empty.

## Common commands
### Install
```bash
pnpm install
```

### Dev (run services)
From repo root:
```bash
# Run all workspaces that implement a `dev` script
pnpm dev

# Run a single service
pnpm dev --filter=@harbor/tendering
```

### Run a built service
```bash
pnpm --filter=@harbor/tendering build
pnpm --filter=@harbor/tendering start
```

### Build
```bash
# Build all workspaces that implement a `build` script
pnpm build

# Build a single workspace
pnpm --filter=@harbor/tendering build
```

### Clean
```bash
# Runs `clean` in workspaces + removes root node_modules
pnpm clean
```

### Database (Drizzle)
Currently only `@harbor/tendering` has Drizzle configured.

```bash
# Generate migrations
pnpm db:generate --filter=@harbor/tendering

# Run migrations
pnpm db:migrate --filter=@harbor/tendering
```

Drizzle config: `services/tendering/drizzle.config.ts`.

### Lint / test (current state)
The root scripts exist:
```bash
pnpm lint
pnpm test
```
…but no workspace currently defines `lint` or `test` scripts, so these won’t do anything useful until lint/test tooling is added per package.

## Environment configuration
- Root `.env` is a Turborepo `globalDependencies` entry (`turbo.json`), so changes to `.env` are treated as inputs to tasks.
- Copy and edit:
  - `cp .env.example .env`
- Database URLs:
  - Shared: `DATABASE_URL`
  - Per-service override pattern: `DATABASE_URL_<SERVICE_NAME_IN_UPPERCASE>` (e.g. `DATABASE_URL_TENDERING`)

## Architecture: “public/private service” pattern
Each service is intended to expose a *narrow*, importable API and hide implementation details.

### Service entry points
- Service process starts in `services/<service>/src/main.ts`.
- `main.ts` typically:
  - loads config via `createConfig(serviceName, defaultPort)` from `@harbor/config`
  - creates a logger via `createLogger({ service })` from `@harbor/logger`
  - builds a Hono app via `createRoutes(...)`
  - starts the server with `@hono/node-server`

Concrete example: `services/tendering/src/main.ts`.

### Tendering request flow (implemented example)
In `services/tendering`:
- Routes: `services/tendering/src/private/routes/index.ts`
  - wires up dependencies (DB → resources → manager)
  - defines endpoints
  - uses `@hono/zod-validator` for request-body validation
- Manager: `services/tendering/src/private/managers/tendering.manager.ts`
  - business logic + orchestration (ask/bid lifecycle)
- Resources: `services/tendering/src/private/resources/*.resource.ts`
  - DB access via Drizzle
- Store: `services/tendering/src/private/store/*`
  - Drizzle schema + `getDb(connectionString)`

### Inter-service communication
Services are expected to communicate via **type-safe HTTP clients** exported from the callee service’s `public/` surface.

Example implemented client:
- `services/tendering/src/public/client/index.ts` exports `TenderingClient`.
  - Default base URL is derived from `getServiceUrl('tendering')` in `@harbor/config/ports`.
  - Responses are validated with Zod schemas in `services/tendering/src/public/schemas/*`.

### Import boundaries to preserve
When adding code, keep service boundaries intact:
- Other services should import only from exported entry points like:
  - `@harbor/tendering/client`
- Avoid importing `services/*/src/private/*` across service boundaries; private is implementation detail.

Implementation note (current repo state): `services/tendering/package.json` declares an export for `./types`, but `services/tendering/src/public/types/` does not exist yet. The “public” surface area currently lives under:
- `services/tendering/src/public/model/*`
- `services/tendering/src/public/request/*`
- `services/tendering/src/public/schemas/*`

If you need a stable cross-service types import, either add `src/public/types/index.ts` (and re-export from those modules) or update the `exports` map accordingly.

## Key docs to read before large changes
- `README.md`: quick commands + repo intent
- `ARCHITECTURE.md`: intended end-state patterns (public/private layering, service communication)
- `QUICKSTART.md`: local dev + database setup
- `ADDING_A_SERVICE.md`: how to scaffold a new service following conventions
- `EXAMPLE_INTER_SERVICE.md`: how gateway-style orchestration is intended to work
