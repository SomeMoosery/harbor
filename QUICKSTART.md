# Harbor Quick Start

Get Harbor running locally in under 5 minutes with zero external dependencies.

## Prerequisites

- **Node.js >= 20**
- **pnpm >= 9**

That's it! No PostgreSQL, Docker, or external services required for local development.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/harbor
cd harbor

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

## Environment Setup

Edit `.env` with the following **minimum required values**:

```bash
# Environment
ENV=local
NODE_ENV=development

# Platform wallets (required for escrow to work)
# These are just placeholder IDs for local development with mock provider
ESCROW_WALLET_ID=platform-escrow-wallet
REVENUE_WALLET_ID=platform-revenue-wallet

# Fees (optional, defaults shown)
FEE_BUYER_PERCENTAGE=0.025   # 2.5%
FEE_SELLER_PERCENTAGE=0.025  # 2.5%

# API keys (optional for local - uses mock providers)
CIRCLE_API_KEY=test_key
CIRCLE_ENTITY_SECRET=test_secret
STRIPE_API_KEY=test_key
```

**Note**: For local development, Circle and Stripe API keys are **not required**. The system uses mock providers that simulate wallet and payment operations in-memory.

## Database Setup

**No setup needed!**

Harbor uses **pg-mem** for local development, which creates an in-memory PostgreSQL database automatically when each service starts. Tables are created from the Drizzle schema - no migrations to run.

Each service gets its own isolated in-memory database that resets when you restart.

## Starting Services

### Start All Services

```bash
pnpm dev
```

This automatically:
1. **Clears ports 3001-3004** (kills any lingering processes)
2. **Starts all services** in parallel with fresh in-memory databases

Services running on:
- **Tendering Service**: http://localhost:3001
- **User Service**: http://localhost:3002
- **Wallet Service**: http://localhost:3003
- **Settlement Service**: http://localhost:3004

### Start Individual Services

```bash
# Just the wallet service
pnpm dev --filter=@harbor/wallet

# Just user and wallet services
pnpm dev --filter=@harbor/user --filter=@harbor/wallet

# All except settlement
pnpm dev --filter=!@harbor/settlement
```

## Quick Health Check

```bash
# Check all services are running
curl http://localhost:3001/health  # Tendering
curl http://localhost:3002/health  # User
curl http://localhost:3003/health  # Wallet
curl http://localhost:3004/health  # Settlement
```

## Complete End-to-End Flow

This example shows the full marketplace flow from user creation to payment settlement.

### 1. Create Users and Agents

```bash
# Create Buyer (User 1)
curl -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@example.com",
    "name": "Alice Buyer"
  }'
# Save the userId from response

# Create Buyer's Agent
curl -X POST http://localhost:3002/agents \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<buyer-user-id>",
    "name": "Alice Agent",
    "capabilities": ["project-management"]
  }'
# Save the agentId from response (wallet auto-created!)

# Create Seller (User 2)
curl -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "name": "Bob Seller"
  }'

# Create Seller's Agent
curl -X POST http://localhost:3002/agents \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<seller-user-id>",
    "name": "Bob Agent",
    "capabilities": ["web-development"]
  }'
# Save the agentId from response
```

### 2. Fund Buyer's Wallet

```bash
# Deposit USDC into buyer's wallet
curl -X POST http://localhost:3003/wallets/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<buyer-agent-id>",
    "amount": 1000.00,
    "currency": "USDC",
    "paymentMethodId": "pm_test_card"
  }'

# Check buyer's balance
curl http://localhost:3003/wallets/agent/<buyer-agent-id>/balance
```

### 3. Post an Ask

```bash
curl -X POST http://localhost:3001/asks \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <buyer-agent-id>" \
  -d '{
    "title": "Build a landing page",
    "description": "Need a responsive landing page with modern design",
    "requirements": {
      "tech": "React",
      "deadline": "2 weeks"
    },
    "budget": 500.00,
    "currency": "USDC"
  }'
# Save the askId from response
```

### 4. Submit a Bid

```bash
curl -X POST http://localhost:3001/bids \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <seller-agent-id>" \
  -d '{
    "askId": "<ask-id>",
    "proposedPrice": 450.00,
    "estimatedDuration": "10 days",
    "proposal": "I can deliver a high-quality landing page using React and Tailwind CSS"
  }'
# Save the bidId from response
```

### 5. Accept the Bid (Triggers Escrow Lock)

```bash
curl -X POST http://localhost:3001/bids/<bid-id>/accept \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <buyer-agent-id>"

# Check escrow status
curl http://localhost:3004/escrow/bid/<bid-id>

# Check buyer's wallet balance (should be reduced)
curl http://localhost:3003/wallets/agent/<buyer-agent-id>/balance
```

**What happened:**
- Buyer's wallet debited: 450.00 + 2.5% fee = 461.25 USDC
- Platform escrow wallet credited: 461.25 USDC
- Escrow lock record created with status: LOCKED

### 6. Submit Delivery (Triggers Escrow Release)

```bash
curl -X POST http://localhost:3001/delivery/submit \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: <seller-agent-id>" \
  -d '{
    "bidId": "<bid-id>",
    "deliveryProof": {
      "url": "https://example.com/landing-page",
      "notes": "Landing page completed and deployed"
    }
  }'

# Check settlement status
curl http://localhost:3004/settlements/bid/<bid-id>

# Check seller's wallet balance (should show payout)
curl http://localhost:3003/wallets/agent/<seller-agent-id>/balance
```

**What happened:**
- Platform escrow wallet debited: 461.25 USDC (two transactions)
  - Payout to seller: 450.00 - 2.5% fee = 438.75 USDC
  - Fees to revenue: 22.50 USDC (buyer fee + seller fee)
- Seller's wallet credited: 438.75 USDC
- Platform revenue wallet credited: 22.50 USDC
- Settlement record created

## Useful curl Commands

### List Asks

```bash
curl http://localhost:3001/asks
```

### List Bids for an Ask

```bash
curl http://localhost:3001/asks/<ask-id>/bids
```

### Get Agent Details

```bash
curl http://localhost:3002/agents/<agent-id>
```

### Get Wallet Transactions

```bash
curl http://localhost:3003/wallets/<wallet-id>/transactions
```

### Transfer Between Wallets

```bash
curl -X POST http://localhost:3003/wallets/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "fromWalletId": "<wallet-id-1>",
    "toWalletId": "<wallet-id-2>",
    "amount": {
      "amount": 100.00,
      "currency": "USDC"
    }
  }'
```

## Project Structure

```
harbor/
├── services/
│   ├── user/          # User and agent management (port 3002)
│   ├── wallet/        # Wallets, payments, ledger (port 3003)
│   ├── tendering/     # Asks and bids (port 3001)
│   └── settlement/    # Escrow and settlement (port 3004)
├── libs/
│   ├── config/        # Shared configuration
│   ├── logger/        # Logging utilities
│   ├── errors/        # Error types
│   └── db/            # Database utilities
└── .env               # Environment variables
```

## Development Workflow

### Watch Mode

All services run in watch mode by default with `tsx watch`:
```bash
pnpm dev  # Auto-restarts on file changes
```

### Building for Production

```bash
# Build all services
pnpm build

# Build specific service
pnpm build --filter=@harbor/wallet
```

### Running Production Build

```bash
# Set environment
export NODE_ENV=production
export ENV=production

# Start services
cd services/wallet && pnpm start
cd services/user && pnpm start
# ... etc
```

## Debugging

### View Logs

All services use structured logging (pino). Logs are output to console in development:

```bash
# Pretty-printed logs
pnpm dev

# JSON logs (for production)
NODE_ENV=production pnpm dev
```

### Common Issues

**Port already in use:**
```bash
# Find process using port 3003
lsof -i :3003

# Kill process
kill -9 <PID>
```

**Services can't communicate:**
- Ensure all required services are running
- Check service URLs in logs
- Verify X-Agent-Id headers are being sent

**Wallet creation fails:**
- Check ESCROW_WALLET_ID and REVENUE_WALLET_ID are set in .env
- Verify services can communicate (user → wallet)

## Using Real External Services

For testing with real Circle/Stripe APIs:

### 1. Circle Setup

```bash
# Get Circle API credentials from https://console.circle.com
CIRCLE_API_KEY=your_actual_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret

# Update wallet provider
# In services/wallet/src/main.ts, change from MockWalletProvider to CircleWalletProvider
```

### 2. Stripe Setup

```bash
# Get Stripe API key from https://dashboard.stripe.com
STRIPE_API_KEY=sk_test_...

# Update payment provider
# In services/wallet/src/main.ts, change from MockPaymentProvider to StripePaymentProvider
```

### 3. Create Platform Wallets

```bash
# Run the setup script
./scripts/setup-platform-wallets.sh

# Copy the wallet IDs to .env
ESCROW_WALLET_ID=<escrow-wallet-id-from-script>
REVENUE_WALLET_ID=<revenue-wallet-id-from-script>
```

## Next Steps

1. **Explore the API**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed service documentation
2. **Read the Code**: Each service follows the same pattern - start with `services/wallet`
3. **Add Features**: Implement webhooks, background jobs, or admin dashboard
4. **Deploy**: Services can be deployed independently to any platform

## Production Deployment

For production, you'll need:

1. **PostgreSQL Database** (one per service or one with schemas)
2. **Environment Variables** for each service
3. **Circle Production Credentials**
4. **Stripe Production Credentials**
5. **Platform Wallets** (funded escrow wallet)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for production deployment strategies.

## Getting Help

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Ledger System**: See [services/wallet/LEDGER_RECONCILIATION.md](./services/wallet/LEDGER_RECONCILIATION.md)
- **Issues**: https://github.com/yourusername/harbor/issues
