# Adding a New Service to Harbor

This guide shows you how to add a new service to the Harbor monorepo following the established patterns.

## Example: Adding an "Agent" Service

### 1. Create the Service Directory Structure

```bash
mkdir -p services/agent/src/{public/{client,types},private/{routes,controllers,managers,resources,store,validators}}
```

### 2. Create `package.json`

**services/agent/package.json**

```json
{
  "name": "@harbor/agent",
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
    "start": "node dist/main.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@harbor/config": "workspace:*",
    "@harbor/logger": "workspace:*",
    "@harbor/errors": "workspace:*",
    "@hono/hono": "^4.6.14",
    "drizzle-orm": "^0.36.4",
    "postgres": "^3.4.5",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "drizzle-kit": "^0.29.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### 3. Create TypeScript Config

**services/agent/tsconfig.json**

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
  ],
  "include": ["src/**/*"]
}
```

### 4. Add Service Port to Config

**libs/config/src/ports.ts**

```typescript
export const SERVICE_PORTS = {
  api: 3000,
  websocket: 3001,
  tendering: 3002,
  agent: 3003,  // Add your new service
  // ...
} as const;
```

### 5. Define Public Types

**services/agent/src/public/types/index.ts**

```typescript
export interface Agent {
  id: string;
  name: string;
  email: string;
  capabilities: string[];
  rating: number;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentRequest {
  name: string;
  email: string;
  capabilities: string[];
}

export interface UpdateAgentRequest {
  name?: string;
  capabilities?: string[];
}
```

### 6. Create Database Schema

**services/agent/src/private/store/schema.ts**

```typescript
import { pgTable, text, timestamp, jsonb, uuid, real } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  capabilities: jsonb('capabilities').notNull().$type<string[]>(),
  rating: real('rating').notNull().default(0),
  status: text('status', { enum: ['active', 'inactive', 'suspended'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type AgentRow = typeof agents.$inferSelect;
```

**services/agent/src/private/store/index.ts**

```typescript
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
```

### 7. Create Resource Layer

**services/agent/src/private/resources/agent.resource.ts**

```typescript
import { eq } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, agents, type AgentRow } from '../store/index.js';
import type { Agent } from '../../public/types/index.js';

export class AgentResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    name: string;
    email: string;
    capabilities: string[];
  }): Promise<Agent> {
    const [agent] = await this.db.insert(agents).values(data).returning();
    if (!agent) throw new Error('Failed to create agent');
    return this.toAgent(agent);
  }

  async findById(id: string): Promise<Agent> {
    const [agent] = await this.db.select().from(agents).where(eq(agents.id, id));
    if (!agent) throw new NotFoundError('Agent', id);
    return this.toAgent(agent);
  }

  async findByEmail(email: string): Promise<Agent | null> {
    const [agent] = await this.db.select().from(agents).where(eq(agents.email, email));
    return agent ? this.toAgent(agent) : null;
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent> {
    const [agent] = await this.db
      .update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    if (!agent) throw new NotFoundError('Agent', id);
    return this.toAgent(agent);
  }

  private toAgent(row: AgentRow): Agent {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      capabilities: row.capabilities,
      rating: row.rating,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
```

### 8. Create Manager Layer

**services/agent/src/private/managers/agent.manager.ts**

```typescript
import type { Logger } from '@harbor/logger';
import { ConflictError } from '@harbor/errors';
import { AgentResource } from '../resources/agent.resource.js';
import type { Agent, CreateAgentRequest } from '../../public/types/index.js';

export class AgentManager {
  constructor(
    private readonly agentResource: AgentResource,
    private readonly logger: Logger
  ) {}

  async register(data: CreateAgentRequest): Promise<Agent> {
    this.logger.info({ data }, 'Registering agent');

    // Check if email already exists
    const existing = await this.agentResource.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('Agent with this email already exists');
    }

    // Create agent
    return this.agentResource.create(data);
  }

  async getAgent(id: string): Promise<Agent> {
    return this.agentResource.findById(id);
  }

  async updateCapabilities(id: string, capabilities: string[]): Promise<Agent> {
    const agent = await this.agentResource.findById(id);

    return this.agentResource.update(id, { capabilities });
  }
}
```

### 9. Create Controller Layer

**services/agent/src/private/controllers/agent.controller.ts**

```typescript
import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import { HarborError } from '@harbor/errors';
import { AgentManager } from '../managers/agent.manager.js';

export class AgentController {
  constructor(
    private readonly manager: AgentManager,
    private readonly logger: Logger
  ) {}

  async register(c: Context) {
    try {
      const body = await c.req.json();
      const agent = await this.manager.register(body);
      return c.json(agent, 201);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  async getAgent(c: Context) {
    try {
      const id = c.req.param('id');
      const agent = await this.manager.getAgent(id);
      return c.json(agent);
    } catch (error) {
      return this.handleError(c, error);
    }
  }

  private handleError(c: Context, error: unknown) {
    if (error instanceof HarborError) {
      return c.json(error.toJSON(), error.statusCode);
    }
    this.logger.error({ error }, 'Unexpected error');
    return c.json({ code: 'INTERNAL_ERROR', message: 'Internal error' }, 500);
  }
}
```

### 10. Create Routes

**services/agent/src/private/routes/index.ts**

```typescript
import { Hono } from 'hono';
import type { Logger } from '@harbor/logger';
import { getDb } from '../store/index.js';
import { AgentResource } from '../resources/agent.resource.js';
import { AgentManager } from '../managers/agent.manager.js';
import { AgentController } from '../controllers/agent.controller.js';

export function createRoutes(connectionString: string, logger: Logger) {
  const app = new Hono();
  const db = getDb(connectionString);

  const resource = new AgentResource(db, logger);
  const manager = new AgentManager(resource, logger);
  const controller = new AgentController(manager, logger);

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.post('/agents', (c) => controller.register(c));
  app.get('/agents/:id', (c) => controller.getAgent(c));

  return app;
}
```

### 11. Create Main Entry Point

**services/agent/src/main.ts**

```typescript
import { serve } from '@hono/node-server';
import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { createLogger } from '@harbor/logger';
import { createRoutes } from './private/routes/index.js';

const SERVICE_NAME = 'agent';
const config = createConfig(SERVICE_NAME, SERVICE_PORTS.agent);
const logger = createLogger({ service: SERVICE_NAME });

const app = createRoutes(config.database.url, logger);

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    logger.info(`Agent service listening on http://localhost:${info.port}`);
  }
);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
```

### 12. Create Public Client

**services/agent/src/public/client/index.ts**

```typescript
import { getServiceUrl } from '@harbor/config/ports';
import type { Agent, CreateAgentRequest } from '../types/index.js';

export class AgentClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getServiceUrl('agent');
  }

  async register(data: CreateAgentRequest): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to register agent: ${response.statusText}`);
    }

    return response.json();
  }

  async getAgent(id: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/agents/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }

    return response.json();
  }
}

export const agentClient = new AgentClient();
```

### 13. Install Dependencies

```bash
cd services/agent
pnpm install
```

### 14. Run the Service

```bash
# From service directory
pnpm dev

# Or from root
pnpm dev --filter=@harbor/agent
```

## Checklist for New Services

- [ ] Create directory structure with `public/` and `private/`
- [ ] Add `package.json` with proper exports
- [ ] Create `tsconfig.json` with references to shared libs
- [ ] Add service port to `libs/config/src/ports.ts`
- [ ] Define public types in `src/public/types/`
- [ ] Create database schema in `src/private/store/`
- [ ] Implement resource layer (database access)
- [ ] Implement manager layer (business logic)
- [ ] Implement controller layer (HTTP handling)
- [ ] Create routes and wire up layers
- [ ] Create main entry point
- [ ] Create public client for inter-service communication
- [ ] Add database connection string to `.env`
- [ ] Run database migrations
- [ ] Test service locally
- [ ] Update documentation

## Best Practices

1. **Keep Public APIs Minimal**: Only expose what other services need
2. **Use Managers for Cross-Resource Logic**: Don't put business logic in controllers
3. **Resources Own Single Tables**: One resource per database table
4. **Validate at Boundaries**: Use Zod in controllers, trust internal data
5. **Type Everything**: Leverage TypeScript's type system
6. **Log Appropriately**: Info for operations, warn for handled errors, error for exceptions
7. **Handle Errors Consistently**: Use HarborError subclasses
8. **Test Each Layer**: Unit test managers/resources, integration test controllers
