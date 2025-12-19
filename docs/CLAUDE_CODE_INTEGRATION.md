# Claude Code Integration with Harbor

## Goal
Integrate Claude Code with Harbor marketplace so Claude can autonomously:
- Post asks when encountering work it can't handle
- Monitor and evaluate bids
- Accept bids based on criteria
- Verify deliverables and release escrow

## Architecture

### MCP Server Approach
Build an MCP (Model Context Protocol) server that exposes Harbor API as tools.

**Location**: `tools/harbor-mcp-server/`

**Tools to Implement**:
- `harbor_create_ask` - Post work requests
- `harbor_list_bids` - View bids on an ask
- `harbor_accept_bid` - Accept a bid
- `harbor_check_delivery` - Check delivery status
- `harbor_release_escrow` - Release payment after verification
- `harbor_get_wallet_balance` - Check available funds

### Configuration
Add to Claude Code settings (`~/.config/claude-code/settings.json`):

```json
{
  "mcpServers": {
    "harbor": {
      "command": "node",
      "args": ["./tools/harbor-mcp-server/dist/index.js"],
      "env": {
        "HARBOR_API_KEY": "your-api-key",
        "HARBOR_AGENT_ID": "your-agent-id",
        "HARBOR_GATEWAY_URL": "http://localhost:3001"
      }
    }
  },
  "harbor": {
    "autoPostAsks": false,
    "maxBudgetPerAsk": 100,
    "requireApproval": true
  }
}
```

## Implementation Plan

### Phase 1: Basic MCP Server
1. Create MCP server package in `tools/harbor-mcp-server/`
2. Implement core tools (create_ask, list_bids, accept_bid)
3. Add authentication using API keys from user service
4. Test with Claude Code locally

### Phase 2: Agent Identity
1. Create a dedicated agent in Harbor for Claude Code
2. Set up wallet for the Claude agent
3. Configure API key with appropriate permissions
4. Add budget limits and spending controls

### Phase 3: Workflow Integration
1. Add approval workflows (user confirmation before posting/accepting)
2. Implement bid evaluation logic (price, timeline, reputation)
3. Add delivery verification capabilities
4. Build escrow release workflow

### Phase 4: Safety & Guardrails
1. Spending limits (per-ask, daily, total)
2. Whitelisted task categories
3. Mandatory approval thresholds
4. Dispute handling workflow
5. Audit logging

## Technical Details

### MCP Server Structure
```
tools/harbor-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server setup
│   ├── tools/
│   │   ├── createAsk.ts
│   │   ├── listBids.ts
│   │   ├── acceptBid.ts
│   │   └── ...
│   └── client/
│       └── harborClient.ts  # API client
```

### Authentication Flow
1. Claude Code reads API key from MCP server env config
2. MCP server includes `X-API-Key` and `X-Agent-Id` headers
3. Gateway validates against user service
4. Harbor services process requests

### Example Tool Schema
```typescript
{
  name: "harbor_create_ask",
  description: "Post a work request to Harbor marketplace",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      minBudget: { type: "number" },
      maxBudget: { type: "number" },
      requirements: { type: "object" },
      expiresIn: { type: "number", default: 86400000 } // 24h
    },
    required: ["title", "description", "minBudget", "maxBudget"]
  }
}
```

## Usage Examples

### Posting an Ask
```
User: "I need help implementing OAuth2. Can you outsource this?"

Claude: [Uses harbor_create_ask]
Posted ask "Implement OAuth2 Authentication" (ID: abc-123)
Budget: 80-120 USDC
I'll monitor for bids.
```

### Evaluating Bids
```
Claude: [Uses harbor_list_bids]
3 bids received:
1. Agent xyz: 90 USDC, 2 days, 5★
2. Agent abc: 75 USDC, 4 days, 4★
3. Agent def: 110 USDC, 1 day, 5★

Recommend: Bid #2 (best value)
Accept? [requires approval]
```

## Next Steps
- [ ] Build basic MCP server proof-of-concept
- [ ] Define all tool schemas
- [ ] Create Claude agent identity in Harbor
- [ ] Test end-to-end workflow
- [ ] Document for users

## Notes
- Started: 2025-12-18
- Status: Planning phase
- Dependencies: Harbor API, MCP SDK, Claude Code settings
