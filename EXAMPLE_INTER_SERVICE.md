# Inter-Service Communication Example

This document demonstrates how services communicate with each other using public clients.

## Scenario: API Gateway Orchestrating Ask Creation

The API Gateway receives a request to create a ask. It needs to:
1. Verify the user exists (User service)
2. Check wallet balance (Wallet service)
3. Create the ask (Tendering service)
4. Lock escrow funds (Escrow service)

## API Gateway Service Implementation

### services/api/src/private/controllers/ask.controller.ts

```typescript
import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { HarborError, ValidationError, InsufficientFundsError } from '@harbor/errors';

// Import public clients from other services
import { TenderingClient } from '@harbor/tendering/client';
import { UserClient } from '@harbor/user/client';
import { WalletClient } from '@harbor/wallet/client';
import { EscrowClient } from '@harbor/escrow/client';

export class AskController {
  constructor(
    private readonly tenderingClient: TenderingClient,
    private readonly userClient: UserClient,
    private readonly walletClient: WalletClient,
    private readonly escrowClient: EscrowClient,
    private readonly logger: Logger
  ) {}

  async createAsk(c: Context) {
    try {
      const userId = c.req.header('Authorization'); // In production: extract from JWT
      const askData = await c.req.json();

      this.logger.info({ userId, askData }, 'Creating ask via API gateway');

      // Step 1: Verify user exists
      const user = await this.userClient.getUser(userId);
      if (!user.verified) {
        throw new ValidationError('User must be verified to create asks');
      }

      // Step 2: Check wallet balance
      const wallet = await this.walletClient.getBalance(userId);
      const requiredBalance = parseFloat(askData.budget);

      if (parseFloat(wallet.balance) < requiredBalance) {
        throw new InsufficientFundsError(
          askData.budget,
          wallet.balance
        );
      }

      // Step 3: Create the ask
      const ask = await this.tenderingClient.createAsk(userId, {
        title: askData.title,
        description: askData.description,
        requirements: askData.requirements,
        budget: askData.budget,
      });

      // Step 4: Lock escrow funds
      const escrow = await this.escrowClient.lock({
        userId,
        askId: ask.id,
        amount: askData.budget,
        currency: 'USD',
      });

      this.logger.info(
        { askId: ask.id, escrowId: escrow.id },
        'Ask created with escrow'
      );

      return c.json({
        ask,
        escrow,
      }, 201);

    } catch (error) {
      return this.handleError(c, error);
    }
  }

  private handleError(c: Context, error: unknown) {
    if (error instanceof HarborError) {
      this.logger.warn({ error: error.toJSON() }, 'Request error');
      return c.json(error.toJSON(), error.statusCode);
    }

    this.logger.error({ error }, 'Unexpected error');
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      500
    );
  }
}
```

## Key Points

### 1. Public Clients are Type-Safe

```typescript
// The TenderingClient knows about the Tendering service's types
import { TenderingClient } from '@harbor/tendering/client';
import type { Ask, CreateAskRequest } from '@harbor/tendering/types';

const client = new TenderingClient();

// TypeScript knows the shape of the request and response
const ask: Ask = await client.createAsk('user123', {
  title: 'Build feature',
  description: 'Details...',
  requirements: { skill: 'TypeScript' },
  budget: '1000.00',
});
```

### 2. Services Expose Only What's in `public/`

```typescript
// ✅ Allowed - importing from public client
import { TenderingClient } from '@harbor/tendering/client';

// ✅ Allowed - importing public types
import type { Ask, Bid } from '@harbor/tendering/types';

// ❌ Not allowed - private implementation is not exported
import { TenderingManager } from '@harbor/tendering/src/private/managers';
// This will fail at build time
```

### 3. Each Service Owns Its Data

The Tendering service owns asks and bids. Other services cannot access the database directly:

```typescript
// ❌ Wrong - direct database access
import { getDb, asks } from '@harbor/tendering/src/private/store';
const db = getDb(process.env.DATABASE_URL);
const allAsks = await db.select().from(asks); // NOT ALLOWED

// ✅ Correct - via public client
import { TenderingClient } from '@harbor/tendering/client';
const client = new TenderingClient();
const allAsks = await client.listAsks();
```

### 4. Error Handling Across Services

```typescript
import { HarborError, NotFoundError } from '@harbor/errors';
import { TenderingClient } from '@harbor/tendering/client';

try {
  const ask = await tenderingClient.getAsk('invalid-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle not found
  } else if (error instanceof HarborError) {
    // Handle other Harbor errors
  } else {
    // Handle unexpected errors
  }
}
```

## Testing Inter-Service Communication

### Unit Tests (Mock the Client)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AskController } from './ask.controller';

describe('AskController', () => {
  it('creates ask with escrow', async () => {
    const mockTenderingClient = {
      createAsk: vi.fn().mockResolvedValue({ id: 'ask-123', ... }),
    };

    const mockWalletClient = {
      getBalance: vi.fn().mockResolvedValue({ balance: '1000.00' }),
    };

    const controller = new AskController(
      mockTenderingClient,
      mockUserClient,
      mockWalletClient,
      mockEscrowClient,
      logger
    );

    // Test the controller...
  });
});
```

### Integration Tests (Real HTTP Calls)

```typescript
import { describe, it, expect } from 'vitest';
import { TenderingClient } from '@harbor/tendering/client';

describe('Tendering Service Integration', () => {
  it('creates and retrieves a ask', async () => {
    const client = new TenderingClient('http://localhost:3002');

    const ask = await client.createAsk('user123', {
      title: 'Test ask',
      description: 'Test description',
      requirements: {},
      budget: '100.00',
    });

    expect(ask.id).toBeDefined();

    const retrieved = await client.getAsk(ask.id);
    expect(retrieved.title).toBe('Test ask');
  });
});
```

## Deployment Considerations

### Local Development
All services run on different ports on localhost. Clients use `getServiceUrl()` to find them:

```typescript
// Automatically resolves to http://localhost:3002
const client = new TenderingClient();
```

### Docker Compose
Services communicate via service names:

```yaml
services:
  tendering:
    environment:
      - PORT=3000
  api:
    environment:
      - TENDERING_HOST=tendering
      - TENDERING_PORT=3000
```

### Kubernetes
Services use Kubernetes Service DNS:

```typescript
// In production, getServiceUrl() could return:
// http://tendering-service.default.svc.cluster.local:3000
```

### API Gateway Pattern (Recommended)
External clients only talk to the API Gateway. Internal services communicate directly:

```
External Client → API Gateway → Internal Services
                      ↓
                  Tendering
                  Agent
                  Wallet
                  Escrow
```
