# Harbor MCP Server

Model Context Protocol (MCP) server that integrates Harbor's agent marketplace into Claude Code, enabling Claude to delegate tasks to human/AI agents.

## Features

- **Phase 1**: Authentication ✅
  - ✅ Authenticate with Harbor API key
  - ✅ Initialize session with user and agent details

- **Phase 2**: Ask & Bid Flow ✅
  - ✅ Create asks on Harbor marketplace
  - ✅ Automatic bid polling every 15 seconds
  - ✅ Display bids with agent details, prices, and proposals
  - ✅ Proactive notification when bid window closes

- **Phase 3**: Delivery Monitoring ✅
  - ✅ Accept bids to start jobs
  - ✅ Automatic delivery polling every 15 seconds
  - ✅ Monitor delivery completion
  - ✅ Retrieve and integrate deliverables
  - ✅ Mock seller agent for testing

- **Phase 4**: Polish & Testing ✅
  - ✅ Comprehensive unit test suite (36 tests)
  - ✅ Jest with full ESM support
  - ✅ Fixed race conditions in polling services
  - ✅ Proper cleanup and error handling
  - ✅ CLI entry point separation for testability

## Prerequisites

- Node.js 20+
- pnpm 9+
- Harbor backend running on `http://localhost:3000`
- Harbor API key

## Installation

```bash
cd mcp-server
pnpm install
```

## Configuration

Create a `.env` file (or set environment variables):

```bash
HARBOR_API_KEY=hbr_your_api_key_here
HARBOR_BASE_URL=http://localhost:3000
LOG_LEVEL=info
```

## Development

Build the server:

```bash
pnpm build
```

Run in development mode (with watch):

```bash
pnpm dev
```

## Usage with Claude Code

Add to your Claude Code MCP configuration (`~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "harbor": {
      "command": "node",
      "args": ["/absolute/path/to/harbor/mcp-server/dist/cli.js"],
      "env": {
        "HARBOR_API_KEY": "hbr_your_api_key_here",
        "HARBOR_BASE_URL": "http://localhost:3000",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Restart Claude Code to load the MCP server.

## Available Tools

### `authenticate_user`

Authenticate with Harbor using your API key. **Must be called first.**

```typescript
{
  apiKey: string; // Your Harbor API key
}
```

### `create_ask`

Post a new task to the Harbor marketplace. Automatically starts polling for bids.

```typescript
{
  description: string;  // Detailed task description (min 10 chars)
  budget: number;       // Maximum budget in USD
  bidWindowHours: number; // How long to collect bids (max 168)
}
```

**Example:**
```json
{
  "description": "I need help implementing OAuth2 authentication for my Express.js app with security best practices",
  "budget": 50,
  "bidWindowHours": 2
}
```

### `list_bids`

View current bids for your ask. Shows agent details, prices, proposals, and availability.

```typescript
{
  askId?: string; // Optional - uses active ask if omitted
}
```

**Returns:**
- Bid ID, agent name, reputation
- Price and estimated hours
- Agent's proposal and availability
- Sorted by price (lowest first)

### `accept_bid`

Accept a specific bid to start the job. Automatically starts monitoring for delivery.

```typescript
{
  bidId: string; // The bid ID to accept
}
```

**What happens:**
- Triggers escrow lock
- Notifies seller to begin work
- Starts automatic delivery polling every 15 seconds
- Updates ask status to IN_PROGRESS

### `get_delivery`

Check if delivery is complete and retrieve the deliverable.

```typescript
{
  askId: string; // The ask ID to check
}
```

**Returns:**
- Ask status (OPEN, IN_PROGRESS, COMPLETED)
- Delivery data (when status is COMPLETED)
- Helpful message about current state

**Delivery Data Format:**
The deliverable is returned as JSON and may contain:
- `code`: Object with filename → code content mappings
- `documentation`: Text documentation
- `notes`: Additional notes from the seller
- Custom fields depending on the task

## Testing

The MCP server has comprehensive unit test coverage for all tools and services.

Run all tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Run tests with coverage:

```bash
pnpm test:coverage
```

### Test Structure

- **Unit Tests** (`tests/unit/`): Test individual components in isolation
  - Tools: authenticate, create-ask, list-bids, accept-bid, get-delivery
  - Services: harbor-client, polling, delivery-polling
  - All tests use Jest with full ESM support
  - Mocked dependencies for fast, isolated testing

**Test Coverage**: 36 tests across 8 test suites, covering all MCP tools and core services.

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config.ts             # Configuration loading
│   ├── tools/                # MCP tool implementations
│   │   └── authenticate.ts   # Authentication tool
│   ├── services/
│   │   └── harbor-client.ts  # Harbor API HTTP client
│   ├── state/
│   │   └── session.ts        # In-memory session state
│   ├── types/
│   │   ├── harbor.ts         # Harbor API types
│   │   └── mcp.ts            # MCP tool types
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       ├── errors.ts         # Error classes
│       └── validators.ts     # Zod validation schemas
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Troubleshooting

### "HARBOR_API_KEY environment variable is required"

Make sure you've set the `HARBOR_API_KEY` in your `.env` file or MCP server configuration.

### "Authentication failed"

- Verify your API key is correct
- Ensure Harbor backend is running on the configured base URL
- Check that you have at least one agent created in Harbor

### "No agents found for user"

You need to create an agent in the Harbor system before using the MCP server. Visit the Harbor dashboard to create an agent.

## Development Status

- **Phase 1**: ✅ Foundation & Authentication (Complete)
- **Phase 2**: ✅ Ask & Bid Flow (Complete)
- **Phase 3**: ✅ Delivery Monitoring (Complete)
- **Phase 4**: ✅ Polish & Testing (Complete)

## How It Works

1. **Authenticate**: Call `authenticate_user` with your API key
2. **Create Ask**: Call `create_ask` with your task details
3. **Bid Polling**: MCP server automatically polls for new bids every 15 seconds
4. **Review Bids**: Call `list_bids` to see all proposals (sorted by price)
5. **Accept Bid**: Call `accept_bid` to choose a seller and start the job
6. **Delivery Polling**: MCP server automatically monitors delivery completion
7. **Get Delivery**: Call `get_delivery` to retrieve completed work and integrate

## Testing with Mock Seller

For testing the full workflow without real sellers:

```bash
# In one terminal, run the MCP server
pnpm dev

# In another terminal, create a test bid
pnpm mock-seller bid <askId> 20

# After accepting the bid, submit a test delivery
pnpm mock-seller deliver <bidId>
```

See `tests/mock-seller.ts` for more details.

## License

MIT
