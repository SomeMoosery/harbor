# Harbor Directory Structure Overview

This document provides a complete view of the Harbor monorepo structure.

## Complete Directory Tree

```
harbor/
│
├── package.json                      # Root package.json (workspaces, scripts)
├── pnpm-workspace.yaml               # pnpm workspace configuration
├── turbo.json                        # Turborepo build configuration
├── tsconfig.json                     # Base TypeScript configuration
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
│
├── README.md                         # Project overview
├── ARCHITECTURE.md                   # Detailed architecture documentation
├── QUICKSTART.md                     # Getting started guide
├── ADDING_A_SERVICE.md               # How to add new services
├── EXAMPLE_INTER_SERVICE.md          # Inter-service communication examples
│
├── services/                         # Microservices (deployable units)
│   │
│   ├── api/                          # API Gateway (Port 3000)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── public/
│   │       │   ├── client/
│   │       │   └── types/
│   │       └── private/
│   │           ├── routes/
│   │           ├── controllers/
│   │           └── middleware/
│   │
│   ├── websocket/                    # WebSocket Server (Port 3001)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── public/
│   │       │   ├── client/
│   │       │   └── types/
│   │       └── private/
│   │           ├── connections/
│   │           ├── handlers/
│   │           └── store/
│   │
│   ├── tendering/                    # Ask Posting & Bidding (Port 3002)
│   │   ├── package.json              # Package config with exports
│   │   ├── tsconfig.json             # TypeScript config with references
│   │   ├── drizzle.config.ts         # Database migration config
│   │   └── src/
│   │       ├── main.ts               # Entry point - starts HTTP server
│   │       │
│   │       ├── public/               # EXPORTED API (other services can import)
│   │       │   ├── client/
│   │       │   │   └── index.ts      # TenderingClient for inter-service calls
│   │       │   └── types/
│   │       │       └── index.ts      # Ask, Bid types, DTOs
│   │       │
│   │       └── private/              # INTERNAL (not importable)
│   │           ├── routes/
│   │           │   └── index.ts      # HTTP route definitions
│   │           ├── controllers/
│   │           │   └── tendering.controller.ts
│   │           ├── managers/
│   │           │   └── tendering.manager.ts
│   │           ├── resources/
│   │           │   ├── ask.resource.ts
│   │           │   └── bid.resource.ts
│   │           ├── store/
│   │           │   ├── schema.ts     # Drizzle schema (asks, bids tables)
│   │           │   └── index.ts      # Database client
│   │           └── validators/
│   │               └── ask.validator.ts
│   │
│   ├── agent/                        # Agent Registry (Port 3003)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── public/
│   │       │   ├── client/
│   │       │   │   └── index.ts      # AgentClient
│   │       │   └── types/
│   │       │       └── index.ts      # Agent types
│   │       └── private/
│   │           ├── routes/
│   │           ├── controllers/
│   │           ├── managers/
│   │           ├── resources/
│   │           ├── store/
│   │           │   └── schema.ts     # agents table
│   │           └── validators/
│   │
│   ├── user/                         # User Management (Port 3004)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── public/
│   │       │   ├── client/
│   │       │   └── types/
│   │       └── private/
│   │           ├── routes/
│   │           ├── controllers/
│   │           ├── managers/
│   │           ├── resources/
│   │           └── store/
│   │
│   ├── wallet/                       # Circle Wallet Integration (Port 3005)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── public/
│   │       │   ├── client/
│   │       │   │   └── index.ts      # WalletClient
│   │       │   └── types/
│   │       └── private/
│   │           ├── routes/
│   │           ├── controllers/
│   │           ├── managers/
│   │           ├── circle/           # Circle API integration
│   │           └── store/
│   │
│   └── escrow/                       # Escrow Management (Port 3006)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           ├── public/
│           │   ├── client/
│           │   │   └── index.ts      # EscrowClient
│           │   └── types/
│           └── private/
│               ├── routes/
│               ├── controllers/
│               ├── managers/
│               ├── resources/
│               └── store/
│
├── libs/                             # Shared internal libraries
│   │
│   ├── config/                       # Configuration management
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # createConfig(), environment
│   │       └── ports.ts              # SERVICE_PORTS, getServiceUrl()
│   │
│   ├── logger/                       # Structured logging (Pino)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts              # createLogger()
│   │
│   ├── errors/                       # Standard error types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts              # HarborError, NotFoundError, etc.
│   │
│   ├── tracing/                      # OpenTelemetry (future)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   │
│   └── db/                           # Shared DB utilities (future)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts              # Migration helpers
│
└── packages/                         # Published npm packages
    └── sdk/                          # @harbor/sdk (for external developers)
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts              # Public SDK aggregating all services
```

## Layer Responsibilities

### Services Layer (services/*)

Each service is an **independent HTTP server** that:
- Runs on its own port
- Has its own database schema/tables
- Exposes a public client API
- Can be deployed independently

### Libs Layer (libs/*)

Shared utilities used by all services:
- **config**: Environment variables, service discovery
- **logger**: Structured logging with Pino
- **errors**: Standard error types
- **tracing**: OpenTelemetry integration (future)
- **db**: Shared database utilities (future)

### Packages Layer (packages/*)

Published npm packages:
- **sdk**: Public SDK for external developers to interact with Harbor

## Import Rules

### ✅ Allowed Imports

```typescript
// Services can import from libs
import { createLogger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { createConfig } from '@harbor/config';

// Services can import from other services' PUBLIC APIs
import { TenderingClient } from '@harbor/tendering/client';
import type { Ask, Bid } from '@harbor/tendering/types';

// Libs can import from other libs
import { createLogger } from '@harbor/logger';
```

### ❌ Forbidden Imports

```typescript
// CANNOT import from private implementation
import { TenderingManager } from '@harbor/tendering/src/private/managers';
// ❌ Error: Module not exported

// CANNOT import database layer directly
import { getDb, asks } from '@harbor/tendering/src/private/store';
// ❌ Error: Module not exported

// CANNOT bypass service boundaries
// ❌ Services should use public clients, not direct DB access
```

## Data Flow Through Layers

```
HTTP Request
    ↓
[Route Handler]          (services/*/src/private/routes/)
    ↓
[Controller]             (services/*/src/private/controllers/)
    ↓
[Validator (Zod)]        (services/*/src/private/validators/)
    ↓
[Manager]                (services/*/src/private/managers/)
    ├→ [Resource]        (services/*/src/private/resources/)
    ├→ [Service Client]  (other-service/client)
    └→ [Event Publisher]
    ↓
[Controller] (format response)
    ↓
HTTP Response
```

## File Naming Conventions

- **Controllers**: `*.controller.ts` (e.g., `ask.controller.ts`)
- **Managers**: `*.manager.ts` (e.g., `tendering.manager.ts`)
- **Resources**: `*.resource.ts` (e.g., `ask.resource.ts`)
- **Validators**: `*.validator.ts` (e.g., `ask.validator.ts`)
- **Clients**: `index.ts` in `public/client/`
- **Types**: `index.ts` in `public/types/`
- **Schema**: `schema.ts` in `private/store/`

## Port Assignments

| Service | Port | URL (dev) |
|---------|------|-----------|
| API Gateway | 3000 | http://localhost:3000 |
| WebSocket | 3001 | http://localhost:3001 |
| Tendering | 3002 | http://localhost:3002 |
| Agent | 3003 | http://localhost:3003 |
| User | 3004 | http://localhost:3004 |
| Wallet | 3005 | http://localhost:3005 |
| Escrow | 3006 | http://localhost:3006 |

## Key Files

- **Root**:
  - `package.json`: Workspace scripts
  - `turbo.json`: Build orchestration
  - `pnpm-workspace.yaml`: Workspace config
  - `tsconfig.json`: Base TypeScript config

- **Each Service**:
  - `package.json`: Dependencies, exports, scripts
  - `tsconfig.json`: TypeScript config with references
  - `drizzle.config.ts`: Database migration config
  - `src/main.ts`: Entry point

- **Shared Libs**:
  - `libs/config/src/ports.ts`: Service port definitions
  - `libs/errors/src/index.ts`: Error type definitions

## Development Workflow

1. **Start all services**: `pnpm dev`
2. **Start one service**: `pnpm dev --filter=@harbor/tendering`
3. **Build all**: `pnpm build`
4. **Add service**: Follow `ADDING_A_SERVICE.md`
5. **Generate migrations**: `pnpm db:generate --filter=@harbor/tendering`
6. **Run migrations**: `pnpm db:migrate --filter=@harbor/tendering`

## Deployment Options

- **Development**: All services on localhost (different ports)
- **Docker Compose**: Each service in a container
- **Kubernetes**: Each service as a Deployment + Service
- **Serverless**: Each service as a Lambda (via API Gateway)
