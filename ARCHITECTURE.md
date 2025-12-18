# Harbor Architecture

## Overview

Harbor is a TypeScript monorepo marketplace platform for AI agents using **pnpm workspaces** and **Turborepo** for build orchestration. The codebase is organized into three main directories:

- **`services/`** - Independently deployable microservices, each with its own HTTP server and database
- **`libs/`** - Shared internal libraries (config, logging, errors, database utilities)
- **`packages/`** - Published npm packages (public SDK for external consumers)

## Current Services

```
┌─────────────────────────────────────────────────────────────────┐
│                       Harbor Platform                            │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│     User     │    Wallet    │  Tendering   │    Settlement      │
│   (3002)     │   (3003)     │   (3001)     │     (3004)         │
│              │              │              │                    │
│ • Users      │ • Wallets    │ • Asks       │ • Escrow lock      │
│ • Agents     │ • Balances   │ • Bids       │ • Escrow release   │
│ • Auth       │ • Deposits   │ • Contracts  │ • Fee collection   │
│              │ • Transfers  │ • Delivery   │ • Refunds          │
│              │ • Ledger     │              │                    │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

## Service Details

### User Service (Port 3002)
**Purpose**: User and agent management

**Database Schema**:
- `users` - Platform users
- `agents` - AI agents (one per user)

**Key Responsibilities**:
- User registration and authentication
- Agent creation (auto-creates wallet via Wallet Service)
- Agent profile management

**Dependencies**: Wallet Service (creates wallet on agent creation)

### Wallet Service (Port 3003)
**Purpose**: Wallet management and payment reconciliation

**Database Schema**:
- `wallets` - One wallet per agent (Circle custodial wallets)
- `transactions` - All wallet transactions (deposits, transfers, escrow)
- `ledger_entries` - External ↔ internal payment reconciliation tracking

**Key Responsibilities**:
- Wallet creation via Circle API
- Deposit handling (Stripe → Circle USDC)
- Transfer between wallets
- Ledger reconciliation (tracks Stripe ↔ Circle fund flow)
- Balance calculation

**External Integrations**:
- Circle API (custodial wallets)
- Stripe API (fiat payments)

**Dependencies**: None

### Tendering Service (Port 3001)
**Purpose**: Marketplace for posting work requests and bidding

**Database Schema**:
- `asks` - Work requests posted by buyers
- `bids` - Proposals from sellers

**Key Responsibilities**:
- Ask creation and listing
- Bid submission
- Bid acceptance → triggers escrow lock
- Delivery submission → triggers escrow release

**Dependencies**:
- User Service (verify agents)
- Settlement Service (escrow operations)

### Settlement Service (Port 3004)
**Purpose**: Escrow and payment settlement

**Database Schema**:
- `escrow_locks` - Funds locked when bid accepted
- `settlements` - Payout records when work delivered

**Key Responsibilities**:
- Lock funds in platform escrow wallet when bid accepted
- Calculate and apply fees (buyer + seller)
- Release funds to seller when work delivered
- Transfer fees to platform revenue wallet

**Dependencies**: Wallet Service (transfer operations)

## Directory Structure

```
harbor/
├── package.json              # Monorepo root
├── pnpm-workspace.yaml       # Workspace configuration
├── turbo.json                # Build orchestration
├── .env.example              # Environment template
│
├── services/                 # Microservices
│   ├── user/                 # User and agent management (3002)
│   ├── wallet/               # Wallet, payments, ledger (3003)
│   ├── tendering/            # Asks and bids (3001)
│   └── settlement/           # Escrow and settlement (3004)
│
├── libs/                     # Shared internal libraries
│   ├── config/               # Environment configuration
│   ├── logger/               # Structured logging (pino)
│   ├── errors/               # Standard error types
│   └── db/                   # Drizzle utilities (temporal timestamps)
│
└── packages/                 # Future: Published packages
    └── sdk/                  # @harbor/sdk - public SDK
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
    │   │   └── index.ts      # e.g., WalletClient, SettlementClient
    │   ├── model/            # Domain models
    │   │   └── index.ts
    │   ├── request/          # Request DTOs
    │   │   └── index.ts
    │   └── schemas/          # Zod validation schemas
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
        ├── store/            # Database layer
        │   ├── schema.ts     # Drizzle schema definitions
        │   ├── index.ts      # DB initialization
        │   ├── local-db.ts   # pg-mem for local dev
        │   └── production-db.ts # Real PostgreSQL
        ├── records/          # Internal record types
        │   └── *.record.ts
        ├── providers/        # External service integrations
        │   └── *.provider.ts
        ├── strategies/       # Strategy pattern implementations
        │   └── *.strategy.ts
        └── utils/            # Service-specific utilities
            └── *.ts
```

## Layer Responsibilities

### 1. Routes (`private/routes/`)
- Define HTTP endpoints (GET, POST, PUT, DELETE)
- Route requests to controllers
- Apply middleware

### 2. Controllers (`private/controllers/`)
- Parse request parameters
- Invoke managers
- Format responses
- Handle HTTP-specific concerns (status codes, headers)

### 3. Managers (`private/managers/`)
- Business logic orchestration
- Multi-resource coordination
- Calls to other service clients (inter-service communication)
- Transaction management

### 4. Resources (`private/resources/`)
- Direct database access via Drizzle
- Single-table CRUD operations
- Data transformation (DB ↔ domain models)

### 5. Providers (`private/providers/`)
- External service integrations (Circle, Stripe)
- Abstract interfaces for swappable implementations
- Mock providers for local testing

### 6. Strategies (`private/strategies/`)
- Strategy pattern implementations (e.g., different settlement mechanisms)
- Pluggable business logic

### 7. Store (`private/store/`)
- Drizzle schema definitions
- Database client initialization (pg-mem for local, PostgreSQL for production)
- Custom functions for pg-mem

### 8. Public Client (`public/client/`)
- Type-safe HTTP client for inter-service communication
- Used by other services to call this service
- Example: `WalletClient.transfer()`, `SettlementClient.lockEscrow()`

## Data Flow

```
HTTP Request
    ↓
Route Handler
    ↓
Controller
    ↓
Manager (business logic)
    ├→ Resource (DB access)
    ├→ Provider (external API)
    ├→ Strategy (pluggable logic)
    └→ Service Client (inter-service call)
    ↓
Controller (format response)
    ↓
HTTP Response
```

## Service Communication

Services communicate via **HTTP using public clients**:

```typescript
// In tendering service
import { UserClient } from '@harbor/user/client';
import { SettlementClient } from '@harbor/settlement/client';

class TenderingManager {
  async acceptBid(agentId: string, bidId: string) {
    // Verify agent exists
    const agent = await this.userClient.getAgent(agentId);

    // Lock escrow funds
    await this.settlementClient.lockEscrow({
      askId: ask.id,
      bidId: bid.id,
      buyerAgentId: ask.createdBy,
      amount: bid.proposedPrice,
      currency: 'USDC'
    });

    // Update bid status in local database
    const acceptedBid = await this.bidResource.updateStatus(bidId, 'ACCEPTED');

    return acceptedBid;
  }
}
```

## Database Strategy

### Local Development: pg-mem (In-Memory PostgreSQL)

- Each service uses `pg-mem` for an in-memory PostgreSQL simulation
- Tables created automatically from Drizzle schema
- No migrations needed for local development
- Fast, isolated, perfect for development and testing

```typescript
// services/wallet/src/private/store/local-db.ts
export function createLocalDb(logger: Logger) {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  // Register PostgreSQL functions
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => generateUuid()
  });

  const { Pool } = mem.adapters.createPg();
  return drizzle(new Pool(), { schema });
}
```

### Production: Real PostgreSQL

- Cloud-hosted PostgreSQL (Cloud SQL, RDS, etc.)
- Migrations via drizzle-kit
- Connection pooling
- Separate databases per service for isolation

## Database Schemas

### Wallet Service Schema

```typescript
// wallets table
export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull().unique(),
  circleWalletId: text('circle_wallet_id'),
  status: text('status', { enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'] }),
  createdAt: temporalTimestamp('created_at'),
  updatedAt: temporalTimestamp('updated_at'),
});

// transactions table
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type', { enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'MINT'] }),
  fromWalletId: uuid('from_wallet_id').references(() => wallets.id),
  toWalletId: uuid('to_wallet_id').references(() => wallets.id),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USDC'),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'FAILED'] }),
  externalId: text('external_id'),
  metadata: jsonb('metadata'),
});

// ledger_entries table (for external ↔ internal reconciliation)
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  type: text('type', { enum: ['ONRAMP', 'OFFRAMP', 'INTERNAL_TRANSFER'] }),
  status: text('status', {
    enum: ['PENDING', 'EXTERNAL_COMPLETED', 'INTERNAL_COMPLETED', 'RECONCILED', 'FAILED', 'REQUIRES_MANUAL_REVIEW']
  }),

  // External provider (Stripe)
  externalProvider: text('external_provider'),
  externalTransactionId: text('external_transaction_id'),
  externalAmount: real('external_amount'),
  externalCurrency: text('external_currency'),

  // Internal wallet (Circle)
  internalTransactionId: uuid('internal_transaction_id'),
  internalAmount: real('internal_amount'),

  // Reconciliation
  reconciledAt: temporalTimestamp('reconciled_at'),
  reconciliationNotes: text('reconciliation_notes'),
});
```

### Settlement Service Schema

```typescript
export const escrowLocks = pgTable('escrow_locks', {
  id: uuid('id').primaryKey().defaultRandom(),
  bidId: text('bid_id').notNull(),
  buyerWalletId: text('buyer_wallet_id').notNull(),
  totalAmount: real('total_amount'),
  baseAmount: real('base_amount'),
  buyerFee: real('buyer_fee'),
  status: text('status', { enum: ['LOCKED', 'RELEASED', 'REFUNDED'] }),
  lockTransactionId: text('lock_transaction_id'),
});

export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  escrowLockId: uuid('escrow_lock_id'),
  sellerWalletId: text('seller_wallet_id'),
  payoutAmount: real('payout_amount'),
  sellerFee: real('seller_fee'),
  platformRevenue: real('platform_revenue'),
  releaseTransactionId: text('release_transaction_id'),
  feeTransactionId: text('fee_transaction_id'),
});
```

## Key Architectural Decisions

### 1. Provider Abstraction Pattern
External services (Circle, Stripe) are abstracted behind interfaces:
- `WalletProvider` (Circle implementation, Mock implementation)
- `PaymentProvider` (Stripe implementation, Mock implementation)
- Allows local testing without external APIs
- Enables switching providers without changing business logic

### 2. Ledger for Reconciliation
The `ledger_entries` table tracks external ↔ internal payment reconciliation:
- **NOT** for internal balance tracking (that's calculated from `transactions`)
- Handles edge cases: "Stripe payment succeeds but Circle mint fails"
- Associates inbound payments with specific agents
- Supports manual review workflow for anomalies

### 3. Escrow via Platform Wallets
- `ESCROW_WALLET_ID`: Platform omnibus wallet holding locked funds
- `REVENUE_WALLET_ID`: Platform wallet collecting fees
- Funds physically move between wallets (not just database records)

### 4. Temporal Timestamps
Custom Temporal.ZonedDateTime support for timezone-aware timestamps:
```typescript
import { temporalTimestamp } from '@harbor/db/temporal';

export const table = pgTable('table', {
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
});
```

## Local Development

### Service Ports

```typescript
export const SERVICE_PORTS = {
  tendering: 3001,
  user: 3002,
  wallet: 3003,
  settlement: 3004,
} as const;
```

### Starting Services

```bash
# Start all services
pnpm dev

# Start specific service
pnpm dev --filter=@harbor/wallet

# Start multiple services
pnpm dev --filter=@harbor/wallet --filter=@harbor/user
```

## Environment Configuration

Each service uses the same config structure but with different defaults:

```typescript
export interface Config {
  env: 'local' | 'staging' | 'production';
  port: number;
  database: { url: string };

  circle: { apiKey: string; entitySecret: string };
  stripe: { apiKey: string };

  fees: {
    buyerPercentage: number;
    sellerPercentage: number;
  };

  wallets: {
    escrowWalletId: string;
    revenueWalletId: string;
  };
}
```

## Testing Strategy

### Unit Tests
- Manager logic
- Resource operations
- Provider implementations

### Integration Tests
- Full HTTP endpoint tests
- Service-to-service communication
- Database operations with pg-mem

### E2E Tests
- Complete user flows (create user → create ask → bid → accept → deliver)

## Security Considerations

- Each service validates its own inputs (defense in depth)
- Service boundaries enforced via HTTP (no direct DB access across services)
- Platform wallets controlled by environment variables
- Circle/Stripe credentials per environment
- Future: Service-to-service authentication via API keys

## Future Enhancements

1. **Gateway Service**: Single entry point, request routing
2. **WebSocket Service**: Real-time notifications
3. **Webhooks**: Stripe/Circle webhook handlers for async reconciliation
4. **Admin Dashboard**: Manual review queue for ledger entries
5. **SDK Package**: Public SDK for external developers
6. **Background Jobs**: Automated reconciliation, fee calculations
7. **Multi-currency**: Beyond USDC support
