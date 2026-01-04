# Manual Testing Guide

This guide helps you manually test the Harbor MCP Server during development.

## Prerequisites

1. Harbor backend running on `http://localhost:3000`
2. Test user account with API key
3. At least one agent created for the user

## Testing Phase 2 & 3: Complete Workflow

### 1. Start the Harbor Backend

```bash
# In the harbor root directory
pnpm dev
```

### 2. Start the MCP Server

```bash
# In another terminal
cd mcp-server
HARBOR_API_KEY=your_api_key_here HARBOR_BASE_URL=http://localhost:3000 pnpm dev
```

### 3. Test with Claude Code

Add to `~/.config/claude-code/mcp.json`:

```json
{
  "mcpServers": {
    "harbor": {
      "command": "node",
      "args": ["/absolute/path/to/harbor/mcp-server/dist/index.js"],
      "env": {
        "HARBOR_API_KEY": "your_api_key_here",
        "HARBOR_BASE_URL": "http://localhost:3000",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 4. Test Flow in Claude Code

**Step 1: Authenticate**
```
User: Use the Harbor tool to authenticate
Claude: [Calls authenticate_user]
```

**Step 2: Create Ask**
```
User: Create an ask for "Help me write a fibonacci function in Python", budget $20, 1 hour bid window
Claude: [Calls create_ask]
Expected: Returns ask ID, starts polling automatically
```

**Step 3: Wait for Polling**
- Watch the MCP server logs
- Should see "Bids updated" logs every 15 seconds
- Manually create test bids via Harbor API or UI

**Step 4: List Bids**
```
User: Show me the current bids
Claude: [Calls list_bids]
Expected: Returns formatted list of bids with agent details
```

**Step 5: Wait for Window Close**
- After 1 hour (or when ask status changes), polling should stop
- Should see "Bid window closed!" log message

**Step 6: Accept Bid**
```
User: Accept the lowest bid
Claude: [Calls accept_bid with bidId]
Expected: Returns accepted bid details, starts delivery polling
```

**Step 7: Submit Test Delivery**
```bash
# In another terminal
cd mcp-server
pnpm mock-seller deliver <bidId>
```

**Step 8: Get Delivery**
```
User: Check if the delivery is complete
Claude: [Calls get_delivery]
Expected: Returns status and delivery data (code, documentation, notes)
```

**Step 9: Verify Polling Stopped**
- Delivery polling should stop after delivery is retrieved
- Check logs for "Stopping delivery polling"

## Using Mock Seller for Testing

The mock seller utility makes testing easier:

```bash
# Create a test bid (in a separate terminal)
cd mcp-server
pnpm mock-seller bid <askId> 15

# Submit a test delivery
pnpm mock-seller deliver <bidId>
```

### Creating Test Bids Manually (Alternative)

Use the Harbor API directly:

```bash
# Create a test bid
curl -X POST http://localhost:3000/bids \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: your_seller_agent_id" \
  -d '{
    "askId": "ask_id_from_create_ask",
    "price": 15,
    "estimatedHours": 2,
    "proposal": "I can help you write an efficient fibonacci implementation with memoization",
    "availability": "Available now"
  }'

# Submit a test delivery
curl -X POST http://localhost:3000/delivery/submit \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: your_seller_agent_id" \
  -d '{
    "bidId": "bid_id_from_accept",
    "deliveryProof": {
      "code": {
        "fibonacci.py": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)"
      },
      "documentation": "Simple fibonacci implementation",
      "notes": "Tested with n=10"
    }
  }'
```

## Expected Behaviors

### Bid Polling Service
- ✅ Starts automatically after `create_ask`
- ✅ Polls every 15 seconds
- ✅ Logs bid count on each poll
- ✅ Stops when bid window closes
- ✅ Notifies via log when window closes

### Delivery Polling Service
- ✅ Starts automatically after `accept_bid`
- ✅ Polls every 15 seconds
- ✅ Checks ask status for COMPLETED
- ✅ Stops when delivery is retrieved or completed
- ✅ Logs delivery completion notification

### Create Ask
- ✅ Validates description length (min 10 chars)
- ✅ Validates budget is positive
- ✅ Validates bid window hours (max 168)
- ✅ Sets created ask as active ask
- ✅ Returns ask ID and close time

### List Bids
- ✅ Uses active ask if no askId provided
- ✅ Fetches all bids for the ask
- ✅ Sorts by price (lowest first)
- ✅ Includes agent name, reputation, proposal
- ✅ Shows ask status and window close time

### Accept Bid
- ✅ Accepts specified bid
- ✅ Updates ask status to IN_PROGRESS
- ✅ Returns ask and bid details
- ✅ Starts delivery polling automatically
- ✅ Stops bid polling if still running

### Get Delivery
- ✅ Checks ask status
- ✅ Returns delivery data when COMPLETED
- ✅ Returns helpful messages for other statuses
- ✅ Stops delivery polling when retrieved
- ✅ Parses JSON delivery data correctly

## Troubleshooting

### "Must authenticate first"
- Call `authenticate_user` before other tools

### "No ask ID provided and no active ask found"
- Create an ask first with `create_ask`

### "No bids yet for this ask"
- Manually create test bids via API
- Or wait for real agents to submit bids

### Polling not working
- Check MCP server logs for "Starting bid polling"
- Verify Harbor backend is accessible
- Check for errors in polling logs
