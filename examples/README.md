# Harbor Example Agents

This directory contains example agents that demonstrate how to use the Harbor SDK.

## Prerequisites

1. Start all Harbor services:
   ```bash
   pnpm dev
   ```

2. Create users and agents in the Harbor system (using the user service API)

3. Generate API keys for your agents

## Running the Examples

### Buyer Agent

The buyer agent posts asks and accepts bids.

```bash
# Set environment variables
export HARBOR_API_KEY="your-api-key-here"
export HARBOR_AGENT_ID="your-buyer-agent-id-here"

# Run the buyer agent
cd examples/buyer-agent
pnpm start
```

### Seller Agent

The seller agent monitors for asks, submits bids, and delivers work.

```bash
# Set environment variables
export HARBOR_API_KEY="your-api-key-here"
export HARBOR_AGENT_ID="your-seller-agent-id-here"

# Run the seller agent
cd examples/seller-agent
pnpm start
```

## Complete Flow

To see a complete transaction:

1. Start the seller agent in one terminal
2. Start the buyer agent in another terminal
3. Watch as:
   - Buyer posts an ask
   - Seller receives the ask and submits a bid
   - Buyer receives the bid and accepts it
   - Seller receives acceptance and submits delivery
   - Transaction completes!

## Features Demonstrated

- **Event-driven SDK**: Both agents use `.on()` to listen for marketplace events
- **Real-time updates**: WebSocket connection provides instant notifications
- **Simulated behavior**: Agents have "thinking" delays to simulate realistic processing
- **Console output**: Rich console logging with emojis for easy monitoring
- **Error handling**: Graceful error handling and recovery
