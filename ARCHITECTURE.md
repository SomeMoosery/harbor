# Harbor Architecture

## Overview

Harbor is a TypeScript monorepo using **pnpm workspaces** and **Turborepo** for build orchestration. The codebase is organized into three main directories:

- **`services/`** - Independently deployable microservices, each with its own HTTP server and database
- **`libs/`** - Shared internal libraries (config, logging, tracing, errors, database utilities)
- **`packages/`** - Published npm packages (public SDK for external consumers)

## Directory Structure

```
harbor/
├── package.json              # Monorepo root
├── pnpm-workspace.yaml       # Workspace configuration
├── turbo.json                # Build orchestration
├── .env.example              # Environment template
│
├── services/                 # Microservices (one HTTP server each)
│   ├── api/                  # API Gateway - routes requests to other services
│   ├── websocket/            # WebSocket server for real-time events
│   ├── tendering/            # Ask posting, bidding, contract lifecycle
│   ├── agent/                # Agent registration, profiles, capabilities
│   ├── user/                 # User management, authentication
│   ├── wallet/               # Circle wallet integration
│   └── escrow/               # Escrow lock/release logic
│
├── libs/                     # Shared internal libraries
│   ├── config/               # Environment configuration, service discovery
│   ├── logger/               # Structured logging (pino)
│   ├── tracing/              # OpenTelemetry instrumentation
│   ├── errors/               # Standard error types
│   └── db/                   # Drizzle utilities, migration helpers
│
└── packages/                 # Published packages
    └── sdk/                  # @harbor/sdk - public SDK for external developers
```

## Service Architecture Pattern

Each service follows a **public/private** structure with strict encapsulation:

```
service-name/
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts               # Entry point - starts HTTP server
    │
    ├── public/               # Exported API (other services can import)
    │   ├── client/           # Type-safe client for inter-service communication
    │   │   └── index.ts      # e.g., TenderingClient, AgentClient
    │   ├── types/            # Shared types, DTOs
    │   │   └── index.ts
    │   └── models/           # Domain models (optional)
    │       └── index.ts
    │
    └── private/              # Internal implementation (not importable)
        ├── routes/           # HTTP route handlers
        │   └── index.ts
        ├── controllers/      # Request/response handling
        │   └── *.controller.ts
        ├── managers/         # Business logic orchestration
        │   └── *.manager.ts
        ├── resources/        # Data access adapters
        │   └── *.resource.ts
        ├── store/            # Database layer (Drizzle schema, queries)
        │   ├── schema.ts
        │   └── queries.ts
        ├── validators/       # Input validation (Zod schemas)
        │   └── *.validator.ts
        └── middleware/       # Service-specific middleware
            └── *.middleware.ts
```

## Layer Responsibilities

### 1. Routes (`private/routes/`)
- Define HTTP endpoints (GET, POST, PUT, DELETE)
- Route requests to controllers
- Apply middleware (auth, validation, rate limiting)

### 2. Controllers (`private/controllers/`)
- Parse request parameters
- Call validators
- Invoke managers
- Format responses
- Handle HTTP-specific concerns (status codes, headers)

### 3. Validators (`private/validators/`)
- Zod schemas for request validation
- Type inference for TypeScript safety

### 4. Managers (`private/managers/`)
- Business logic orchestration
- Multi-resource coordination
- Transaction management
- Calls to other service clients
- Event publishing

### 5. Resources (`private/resources/`)
- Direct database access via Drizzle
- Single-table CRUD operations
- Data transformation (DB ↔ domain models)

### 6. Store (`private/store/`)
- Drizzle schema definitions
- Database client initialization
- Query builders

### 7. Public Client (`public/client/`)
- Type-safe HTTP client for inter-service communication
- Used by other services to call this service
- Example: `AgentClient.getAgentById(id)`

## Data Flow

```
HTTP Request
    ↓
Route Handler
    ↓
Controller
    ↓
Validator (Zod)
    ↓
Manager (business logic)
    ├→ Resource (DB access)
    ├→ Other Service Client (inter-service call)
    └→ Event Publisher
    ↓
Controller (format response)
    ↓
HTTP Response
```

## Service Communication

Services communicate via **HTTP using public clients**:

```typescript
// In tendering service
import { AgentClient } from '@harbor/agent/client';
import { WalletClient } from '@harbor/wallet/client';

class TenderingManager {
  async createAsk(userId: string, askData: AskData) {
    // Verify agent exists
    const agent = await AgentClient.getAgent(userId);

    // Check wallet balance
    const balance = await WalletClient.getBalance(userId);

    // Create ask in local database
    const ask = await this.askResource.create(askData);

    return ask;
  }
}
```

## Local Development

Each service runs on its own port:

```bash
# libs/config/src/ports.ts
export const SERVICE_PORTS = {
  api: 3000,         // API Gateway
  websocket: 3001,   // WebSocket server
  tendering: 3002,
  agent: 3003,
  user: 3004,
  wallet: 3005,
  escrow: 3006,
} as const;
```

Start all services:

```bash
pnpm dev              # Turborepo runs all services in parallel
pnpm dev --filter=api # Run only API service
```

## Database Strategy

**Option A: One database, service-specific schemas**
```typescript
// services/tendering/src/private/store/schema.ts
import { pgSchema } from 'drizzle-orm/pg-core';

const tenderingSchema = pgSchema('tendering');

export const asks = tenderingSchema.table('asks', {
  // ...
});
```

**Option B: Separate databases per service** (better isolation)
```bash
# .env
DATABASE_URL_TENDERING=postgresql://...
DATABASE_URL_AGENT=postgresql://...
DATABASE_URL_WALLET=postgresql://...
```

## TypeScript Configuration

### Root `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true
  }
}
```

### Service `tsconfig.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../../libs/config" },
    { "path": "../../libs/logger" },
    { "path": "../../libs/errors" }
  ]
}
```

## Package.json Structure

### Service `package.json`
```json
{
  "name": "@harbor/tendering",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./client": "./src/public/client/index.ts",
    "./types": "./src/public/types/index.ts"
  },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc --build",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@harbor/config": "workspace:*",
    "@harbor/logger": "workspace:*",
    "@harbor/errors": "workspace:*",
    "@hono/hono": "^4.x",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "typescript": "^5.7.0",
    "drizzle-kit": "^0.29.0"
  }
}
```

## Deployment Flexibility

The architecture supports multiple deployment models:

1. **Development**: All services on localhost (different ports)
2. **Docker Compose**: Each service in a container
3. **Kubernetes**: Each service as a Deployment + Service
4. **Serverless**: API Gateway → Lambda per service
5. **Monolith**: Bundle all services into one process (if needed)

## Best Practices (2025)

1. **Use `tsx` for development** - Fast TypeScript execution with watch mode
2. **Zod for runtime validation** - Type-safe schemas with inference
3. **Drizzle ORM** - Type-safe SQL with minimal overhead
4. **Hono for HTTP** - Fast, lightweight, edge-compatible
5. **Pino for logging** - High-performance structured logging
6. **OpenTelemetry for tracing** - Distributed tracing across services
7. **TypeScript 5.7+** - Latest features (using `satisfies`, `const` assertions)
8. **ESM-first** - All packages use `"type": "module"`
9. **Workspace protocol** - `workspace:*` for internal dependencies
10. **Strict TypeScript** - All strict flags enabled

## Security Boundaries

- Each service validates its own inputs (defense in depth)
- API Gateway handles authentication
- Individual services perform authorization
- Database credentials are per-service (least privilege)
- Public clients use service-to-service API keys (future)

## Testing Strategy

```
service-name/
└── src/
    ├── __tests__/
    │   ├── unit/             # Manager, resource tests
    │   ├── integration/      # Full HTTP endpoint tests
    │   └── fixtures/         # Test data
    └── private/
        └── managers/
            └── ask.manager.test.ts
```
