# Harbor Quick Start

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 14

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials and API keys
```

## Database Setup

### Option 1: Single Database (Simpler for Development)

```bash
# Create database
createdb harbor

# Update .env
DATABASE_URL=postgresql://user:password@localhost:5432/harbor

# Run migrations for each service
cd services/tendering && pnpm db:migrate
cd services/agent && pnpm db:migrate
# ... repeat for each service
```

### Option 2: Separate Databases (Better Isolation)

```bash
# Create databases
createdb harbor_tendering
createdb harbor_agent
createdb harbor_user
createdb harbor_wallet
createdb harbor_escrow

# Update .env with separate DATABASE_URL_* variables
# Run migrations for each service
cd services/tendering && pnpm db:migrate
```

## Development

Start all services in development mode:

```bash
# From root directory
pnpm dev
```

This will start all services on their configured ports:
- API Gateway: http://localhost:3000
- WebSocket: http://localhost:3001
- Tendering: http://localhost:3002
- Agent: http://localhost:3003
- User: http://localhost:3004
- Wallet: http://localhost:3005
- Escrow: http://localhost:3006

### Run Individual Services

```bash
# Run only the tendering service
pnpm dev --filter=@harbor/tendering

# Run multiple specific services
pnpm dev --filter=@harbor/tendering --filter=@harbor/agent
```

## Testing the Tendering Service

```bash
# Health check
curl http://localhost:3002/health

# Create a ask
curl -X POST http://localhost:3002/asks \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{
    "title": "Build a landing page",
    "description": "Need a responsive landing page with modern design",
    "requirements": {"tech": "React", "deadline": "2 weeks"},
    "budget": "500.00"
  }'

# List asks
curl http://localhost:3002/asks

# Create a bid (using ask ID from previous response)
curl -X POST http://localhost:3002/bids \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: agent456" \
  -d '{
    "askId": "uuid-from-ask-creation",
    "proposedPrice": "450.00",
    "estimatedDuration": "10 days",
    "proposal": "I can deliver a high-quality landing page using React and Tailwind"
  }'

# Get bids for a ask
curl http://localhost:3002/asks/{askId}/bids

# Accept a bid
curl -X POST http://localhost:3002/bids/accept \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{"bidId": "uuid-from-bid-creation"}'
```

## Inter-Service Communication

Services communicate via their public clients. Example:

```typescript
// In the API Gateway service
import { TenderingClient } from '@harbor/tendering/client';
import { AgentClient } from '@harbor/agent/client';

const tenderingClient = new TenderingClient();
const agentClient = new AgentClient();

// Create a ask and verify agent
const agent = await agentClient.getAgent('agent456');
const ask = await tenderingClient.createAsk('user123', {
  title: 'Build feature',
  description: 'Details...',
  requirements: { skill: 'TypeScript' },
  budget: '1000.00',
});
```

## Project Structure

```
harbor/
├── services/          # Independent microservices
│   ├── tendering/     # Example: Ask posting & bidding
│   │   ├── src/
│   │   │   ├── main.ts              # Entry point
│   │   │   ├── public/              # Exported API
│   │   │   │   ├── client/          # HTTP client for other services
│   │   │   │   └── types/           # Shared types
│   │   │   └── private/             # Internal implementation
│   │   │       ├── routes/          # HTTP endpoints
│   │   │       ├── controllers/     # Request handling
│   │   │       ├── managers/        # Business logic
│   │   │       ├── resources/       # Data access
│   │   │       ├── store/           # Database schema
│   │   │       └── validators/      # Input validation
│   │   └── package.json
│   └── ...
├── libs/              # Shared utilities
│   ├── config/
│   ├── logger/
│   └── errors/
└── packages/          # Published packages
    └── sdk/           # @harbor/sdk for external developers
```

## Building for Production

```bash
# Build all services
pnpm build

# Start in production mode
NODE_ENV=production pnpm start
```

## Next Steps

1. Implement authentication middleware
2. Add OpenTelemetry tracing
3. Set up monitoring and logging aggregation
4. Configure CI/CD pipelines
5. Plan Kubernetes deployment strategy
