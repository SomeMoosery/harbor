# Spec: Harbor MCP Server

## 1. Goals

**Primary Goal:** Build an MCP (Model Context Protocol) server that integrates Harbor's agent marketplace into Claude Code, allowing Claude to delegate tasks it cannot complete to human/AI agents through the Harbor platform.

**Secondary Goals:**
- Demonstrate Harbor's value proposition through a real-world integration
- Create a reference implementation for future MCP server development
- Validate the end-to-end workflow: ask creation → bidding → job completion → result integration

## 2. Non-Goals

- **Production deployment** - This is localhost-only for initial development
- **Multi-environment support** - Hardcode to `http://localhost:3000`, no dev/staging/prod switching
- **Advanced security** - Minimal security since this runs locally; no keychain integration or encryption
- **Automatic task detection** - Not solving how Claude "knows" it needs help; users will manually trigger
- **User creation in MCP** - If user doesn't exist, redirect to Harbor dashboard for onboarding
- **Automatic context inclusion** - No automatic attachment of files/errors; users approve all context
- **Rate limiting** - Trust local backend can handle load
- **Backward compatibility** - Breaking changes are acceptable during development
- **Resources/prompts** - Focus on tools only; no MCP resources or prompts initially

## 3. Requirements

### 3.1 Functional Requirements

**FR1: User Authentication**
- MCP server accepts API key in configuration file
- `authenticate_user` tool verifies API key with Harbor backend
- If user exists, initialize session and store minimal state (user ID, agent ID)
- If user doesn't exist, return error with link to Harbor dashboard for account creation

**FR2: Create Ask**
- `create_ask` tool posts a new task to Harbor marketplace
- Parameters: description (freeform text), budget (number), bid window duration (number, in hours)
- Always requires explicit user approval before posting
- Returns ask ID and confirmation

**FR3: Bid Polling & Display**
- Automatically poll for new bids every 15 seconds while bid window is open
- When bid window closes, proactively present bids to Claude/user
- Display for each bid:
  - Agent name and reputation/rating
  - Price and estimated timeline
  - Agent's proposal/approach
  - Agent availability
- `list_bids` tool allows manual checking of current bids

**FR4: Bid Acceptance**
- `accept_bid` tool selects and accepts a specific bid
- Triggers escrow lock and job start via Harbor backend
- Returns job ID and status

**FR5: Delivery Monitoring**
- After accepting a bid, poll `GET /asks/:id` to monitor ask status
- When `ask.status === 'COMPLETED'`, delivery has been submitted
- `get_delivery` tool fetches the completed delivery data from the ask
- Returns deliverable as JSON (code, documentation, analysis, etc.)
- Claude decides whether to auto-integrate or present for user review

**FR6: Failure Handling**
- If ask times out without delivery, automatically accept next best available bid
- If no more bids available, return error and suggest re-posting ask
- Fail immediately on API errors (no retries)

### 3.2 Non-Functional Requirements

**NFR1: Performance**
- No specific performance targets (localhost development)
- Polling interval: 15 seconds
- No memory or CPU constraints

**NFR2: Reliability**
- Fail fast on API errors
- Basic input validation for all user inputs (email, budget, descriptions)
- Response validation to verify API responses match expected schema

**NFR3: Logging**
- Basic logs to stdout
- Log key events: authentication, API calls, bid updates, errors
- Include timestamps and log levels

**NFR4: Error Handling**
- Rich error context including HTTP status, Harbor API errors, debugging info
- Structured error responses with error codes and suggested actions

**NFR5: Testing**
- Unit tests for core logic (bid parsing, validation, state management)
- Integration tests with mocked Harbor API responses
- E2E tests against running localhost Harbor instance
- Manual testing in Claude Code for UX validation

## 4. Proposed Design

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code                            │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Harbor MCP Server                         │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │             MCP Tools Layer                        │   │
│  │  - authenticate_user                               │   │
│  │  - create_ask                                      │   │
│  │  - list_bids                                       │   │
│  │  - accept_bid                                      │   │
│  │  - get_delivery                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                         │                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │          Polling Service                           │   │
│  │  - Poll for bids every 15s                         │   │
│  │  - Notify when bid window closes                   │   │
│  └────────────────────────────────────────────────────┘   │
│                         │                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │          Harbor API Client                         │   │
│  │  - HTTP client for Harbor REST APIs                │   │
│  │  - Request/response validation                     │   │
│  │  - Error handling and transformation               │   │
│  └────────────────────────────────────────────────────┘   │
│                         │                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │          Local State Manager                       │   │
│  │  - Store: API key, user ID, agent ID               │   │
│  │  - Ephemeral: active ask, polling state            │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Harbor Backend (localhost:3000)                │
│  - User Service: /users, /agents, /api-keys                │
│  - Tendering Service: /asks, /bids, /delivery              │
│  - Settlement Service: /escrow (via internal calls)        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

- **Language:** TypeScript (matches Harbor codebase)
- **Runtime:** Node.js 20+
- **MCP SDK:** `@modelcontextprotocol/sdk` (official MCP SDK)
- **HTTP Client:** `fetch` (native) or `axios`
- **Validation:** `zod` (already in Harbor stack)
- **Testing:** `vitest` (already in Harbor stack)
- **Build:** `tsx` for development, `tsc` for production builds

### 4.3 Project Structure

```
/mcp-server/
├── package.json              # Hybrid deps: share Zod/TypeScript, independent MCP SDK
├── tsconfig.json             # Extends root tsconfig
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config.ts             # Configuration loading (API key, base URL)
│   ├── tools/                # MCP tool implementations
│   │   ├── authenticate.ts
│   │   ├── create-ask.ts
│   │   ├── list-bids.ts
│   │   ├── accept-bid.ts
│   │   └── get-delivery.ts
│   ├── services/
│   │   ├── harbor-client.ts  # HTTP client for Harbor APIs
│   │   └── polling.ts        # Bid polling service
│   ├── state/
│   │   └── session.ts        # In-memory session state
│   ├── types/
│   │   ├── mcp.ts            # MCP-specific types
│   │   └── harbor.ts         # Harbor API types
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       ├── validators.ts     # Zod schemas for validation
│       └── errors.ts         # Error classes and handlers
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests with mocks
│   └── e2e/                  # E2E tests against local Harbor
├── README.md                 # Setup and usage documentation
└── .env.example              # Example configuration
```

### 4.4 Data Model

**Local State (In-Memory)**
```typescript
interface SessionState {
  apiKey: string;
  userId: string | null;
  agentId: string | null;
  activeAskId: string | null;
  pollingInterval: NodeJS.Timeout | null;
}
```

**Harbor API Audit**

Required endpoints (based on code review):
- ✅ `POST /api-keys/validate` - Validate API key
- ✅ `GET /users/:id` - Get user details
- ✅ `GET /users/:userId/agents` - Get user's agents
- ✅ `POST /asks` - Create ask
- ✅ `GET /asks/:id` - Get ask details
- ✅ `GET /asks/:askId/bids` - List bids for ask
- ✅ `POST /bids/accept` - Accept bid
- ✅ `POST /delivery/submit` - Seller submits delivery (includes deliveryProof in ask.deliveryData)

**API Types (Harbor Backend)**
```typescript
interface CreateAskRequest {
  description: string;
  budget: number;
  bidWindowHours: number;
}

interface Ask {
  id: string;
  agentId: string;
  description: string;
  budget: number;
  status: 'open' | 'closed' | 'cancelled';
  bidWindowClosesAt: string;
  createdAt: string;
}

interface Bid {
  id: string;
  askId: string;
  agentId: string;
  agentName: string;
  agentReputation: number;
  price: number;
  estimatedHours: number;
  proposal: string;
  availability: string;
  createdAt: string;
}

// Note: No separate "Job" entity - the accepted bid IS the job
// Delivery is tracked via ask.status and ask.deliveryData

interface AskWithDelivery extends Ask {
  deliveryData?: Record<string, unknown>; // JSON deliverable from seller
}
```

### 4.5 MCP Tool Specifications

**Tool: authenticate_user**
```typescript
{
  name: "authenticate_user",
  description: "Authenticate with Harbor using email/phone or validate existing API key",
  inputSchema: {
    type: "object",
    properties: {
      apiKey: { type: "string", description: "Harbor API key from config" }
    },
    required: ["apiKey"]
  }
}
```

**Tool: create_ask**
```typescript
{
  name: "create_ask",
  description: "Post a new task to Harbor marketplace for agents to bid on",
  inputSchema: {
    type: "object",
    properties: {
      description: { type: "string", description: "Detailed task description" },
      budget: { type: "number", description: "Maximum budget in USD" },
      bidWindowHours: { type: "number", description: "How long to collect bids (hours)" }
    },
    required: ["description", "budget", "bidWindowHours"]
  }
}
```

**Tool: list_bids**
```typescript
{
  name: "list_bids",
  description: "Get current bids for the active ask",
  inputSchema: {
    type: "object",
    properties: {
      askId: { type: "string", description: "Optional ask ID (uses active ask if omitted)" }
    }
  }
}
```

**Tool: accept_bid**
```typescript
{
  name: "accept_bid",
  description: "Accept a bid and start the job",
  inputSchema: {
    type: "object",
    properties: {
      bidId: { type: "string", description: "ID of bid to accept" }
    },
    required: ["bidId"]
  }
}
```

**Tool: get_delivery**
```typescript
{
  name: "get_delivery",
  description: "Check if delivery is complete and retrieve the deliverable. Polls ask status until completed.",
  inputSchema: {
    type: "object",
    properties: {
      askId: { type: "string", description: "Ask ID to check for delivery" }
    },
    required: ["askId"]
  }
}
```

### 4.6 Polling Implementation

```typescript
class BidPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 15000; // 15 seconds

  async startPolling(askId: string, onBidsUpdate: (bids: Bid[]) => void, onWindowClosed: () => void) {
    this.intervalId = setInterval(async () => {
      try {
        const ask = await harborClient.getAsk(askId);
        const bids = await harborClient.getBidsForAsk(askId);

        onBidsUpdate(bids);

        if (ask.status === 'closed' || new Date(ask.bidWindowClosesAt) <= new Date()) {
          this.stopPolling();
          onWindowClosed();
        }
      } catch (error) {
        logger.error('Polling error:', error);
        // Continue polling despite errors
      }
    }, this.POLL_INTERVAL_MS);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

### 4.7 Configuration

**Config File: `~/.config/harbor-mcp/config.json`**
```json
{
  "harborApiKey": "hbr_...",
  "harborBaseUrl": "http://localhost:3000",
  "logLevel": "info"
}
```

**Environment Variables (Alternative)**
```bash
HARBOR_API_KEY=hbr_...
HARBOR_BASE_URL=http://localhost:3000
```

## 5. Alternatives Considered

### 5.1 OAuth vs API Key Authentication
**Decision:** API key (selected)
- **Pro:** Simpler for localhost development, matches Harbor's existing auth pattern
- **Con:** Less secure for production
- **Alternative:** OAuth with browser flow - more secure but adds complexity for local dev

### 5.2 Webhooks vs Polling for Bids
**Decision:** Polling (selected)
- **Pro:** Simpler implementation, no need for local HTTP server, works behind firewalls
- **Con:** Slightly higher server load, 15s latency
- **Alternative:** Webhooks - real-time updates but requires exposing local endpoint

### 5.3 Stateless vs Stateful MCP Server
**Decision:** Minimal state (API key + session only)
- **Pro:** Survives restarts for auth, minimal persistence needed
- **Con:** Active asks not tracked across restarts
- **Alternative:** Full state persistence - better UX but adds complexity

### 5.4 Automatic vs Manual Task Detection
**Decision:** Manual (selected)
- **Pro:** Clear user control, no false positives
- **Con:** User must explicitly invoke Harbor
- **Alternative:** Heuristic detection - convenient but risks over-delegation

### 5.5 Auto-integrate vs Present for Review
**Decision:** Claude decides (selected)
- **Pro:** Flexible, can adapt based on risk/scope
- **Con:** Less predictable behavior
- **Alternative:** Always present - safer but slower workflow

## 6. Risks & Mitigations

### 6.1 Risk: Missing Harbor APIs
**Description:** Job status, deliverable retrieval, or cancellation endpoints may not exist yet

**Impact:** High - blocks core functionality

**Mitigation:**
- Audit existing APIs before implementation (see section 4.4)
- Create GitHub issues for any missing endpoints
- Implement MCP tools with mock responses, update when APIs ready
- Prioritize API creation in Harbor backend

### 6.2 Risk: Claude Doesn't Know When to Use Harbor
**Description:** No clear heuristic for when Claude should delegate to Harbor

**Impact:** Medium - limits organic usage

**Mitigation:**
- Start with explicit user commands: "use Harbor to solve this"
- Document common use cases (complex refactors, unfamiliar tech stacks)
- Future: Add confidence thresholds or failure detection
- Consider prompts/instructions to MCP server

### 6.3 Risk: Bid Window UX Friction
**Description:** 15-second polling means delays in seeing bids; unclear if user should wait or continue working

**Impact:** Medium - UX frustration

**Mitigation:**
- Clear messaging: "Collecting bids for X hours, I'll notify when ready"
- Allow users to continue conversation while polling in background
- Proactive notification when window closes
- Consider shorter polling interval (5-10s) if server can handle it

### 6.4 Risk: Auto-retry May Accept Wrong Bid
**Description:** If job fails and MCP auto-accepts next bid, user loses control and may overspend

**Impact:** Medium - financial/quality risk

**Mitigation:**
- Log all bid acceptances clearly
- Limit auto-retry to 1 attempt, then require manual intervention
- Future: Add budget cap for auto-retries
- Allow disabling auto-retry in config

### 6.5 Risk: API Key Exposure
**Description:** API key stored in plain text config file

**Impact:** Low (localhost only) to High (if config leaked)

**Mitigation:**
- Document proper file permissions (chmod 600)
- Add .gitignore for config files
- Future: OS keychain integration for production
- Clear warnings in documentation

### 6.6 Risk: Polling Load on Harbor Backend
**Description:** Many MCP instances polling every 15s could overwhelm localhost server

**Impact:** Low (single user) to Medium (team usage)

**Mitigation:**
- No rate limiting initially (trust localhost can handle)
- Monitor during E2E tests
- Add exponential backoff on 429/500 errors if needed
- Future: WebSocket support for real-time updates

## 7. Acceptance Criteria

**AC1: End-to-End Demo**
- [ ] Successfully authenticate via MCP in Claude Code
- [ ] Create an ask with description, budget, and bid window
- [ ] Receive and display at least 2 mock/real bids
- [ ] Accept a bid and verify job creation
- [ ] Poll job status until completion
- [ ] Retrieve and display job deliverable
- [ ] Claude integrates result into conversation

**AC2: All Tools Functional**
- [ ] `authenticate_user` validates API key and initializes session
- [ ] `create_ask` posts to Harbor and returns ask ID
- [ ] `list_bids` fetches current bids with all display fields
- [ ] `accept_bid` triggers escrow and updates ask to IN_PROGRESS
- [ ] `get_delivery` polls ask status and retrieves deliveryData when COMPLETED

**AC3: Error Handling**
- [ ] Invalid API key returns clear authentication error
- [ ] API unreachable fails immediately with helpful message
- [ ] Invalid ask parameters rejected with validation errors
- [ ] Accepting bid for non-existent ask returns error
- [ ] Getting delivery from incomplete ask returns appropriate status

**AC4: Polling Behavior**
- [ ] Polling starts automatically after creating ask
- [ ] Bids update every ~15 seconds while window open
- [ ] Polling stops when bid window closes
- [ ] Claude/user notified proactively when window closes
- [ ] Manual `list_bids` works even when not polling

**AC5: Testing Coverage**
- [ ] Unit tests for validators, parsers, state management
- [ ] Integration tests for each tool with mocked Harbor API
- [ ] E2E test: full flow from auth → ask → bid → job → result
- [ ] Manual testing in real Claude Code session

**AC7: Documentation**
- [ ] README with setup instructions (MCP config, Harbor prerequisites)
- [ ] Configuration examples (API key, base URL)
- [ ] Usage guide with example commands for Claude Code
- [ ] Troubleshooting section for common issues

**AC6: Auto-Retry on Timeout**
- [ ] When ask times out without delivery, automatically accept next best bid
- [ ] If no more bids, return error suggesting re-post
- [ ] Logs clearly show retry attempts

## 8. Rollout Plan

### Phase 1: Foundation (Milestone 1)
**Goal:** Basic MCP server structure and authentication

**Tasks:**
- [ ] Set up `/mcp-server` directory with package.json, tsconfig
- [ ] Install MCP SDK and configure server entry point
- [ ] Implement configuration loading (API key, base URL)
- [ ] Build Harbor HTTP client with fetch/axios
- [ ] Implement `authenticate_user` tool
- [ ] Add basic logging to stdout
- [ ] Test MCP server registration in Claude Code

**API Dependencies:**
- `POST /api-keys/validate`
- `GET /users/:id`
- `GET /users/:userId/agents`

### Phase 2: Ask & Bid Flow (Milestone 2)
**Goal:** Create asks and list bids

**Tasks:**
- [ ] Implement `create_ask` tool with validation
- [ ] Build bid polling service (15s interval)
- [ ] Implement `list_bids` tool
- [ ] Add state management for active ask tracking
- [ ] Test ask creation and bid display in Claude Code

**API Dependencies:**
- `POST /asks`
- `GET /asks/:id`
- `GET /asks/:askId/bids`

### Phase 3: Delivery Monitoring (Milestone 3)
**Goal:** Accept bids, monitor delivery completion, retrieve results

**Tasks:**
- [ ] Implement `accept_bid` tool
- [ ] Implement `get_delivery` tool with ask status polling
- [ ] Add auto-retry logic on timeout
- [ ] Create mock seller agent for testing (auto-submits delivery)
- [ ] Test full workflow end-to-end

**API Dependencies:**
- `POST /bids/accept`
- `GET /asks/:id` (already exists, returns deliveryData)
- `POST /bids` (for creating mock bids in tests)

### Phase 4: Polish & Testing (Milestone 4)
**Goal:** Robust testing and documentation

**Tasks:**
- [ ] Write unit tests for all tools and services
- [ ] Write integration tests with mocked APIs
- [ ] Write E2E test against local Harbor with mock seller
- [ ] Write comprehensive README
- [ ] Add input/response validation
- [ ] Error handling improvements
- [ ] Manual testing session in Claude Code

**API Dependencies:**
- All APIs exist - no additional endpoints needed

### Phase 5: Future Enhancements (Post-MVP)
**Out of scope for initial delivery, but documented for future:**
- WebSocket support for real-time bid updates
- MCP resources for user profile, job history
- Multi-environment support (dev/staging/prod)
- Automatic task detection heuristics
- Budget caps and spending controls
- Richer error recovery (partial retries, dispute flows)

## 9. Test Plan

### 9.1 Unit Tests

**Tools Tests** (`tests/unit/tools/`)
- `authenticate.test.ts`: Valid key, invalid key, API errors
- `create-ask.test.ts`: Valid inputs, missing fields, negative budget
- `list-bids.test.ts`: Empty list, multiple bids, closed window
- `accept-bid.test.ts`: Valid acceptance, invalid bid ID
- `get-delivery.test.ts`: Completed ask, in-progress ask, timeout handling

**Service Tests** (`tests/unit/services/`)
- `harbor-client.test.ts`: HTTP success, 4xx/5xx errors, network failures
- `polling.test.ts`: Polling lifecycle, window close detection, error handling

**Validation Tests** (`tests/unit/utils/`)
- `validators.test.ts`: Zod schemas for all input/output types

### 9.2 Integration Tests

**Full Flow Tests** (`tests/integration/`)
- Mock Harbor API responses using `msw` or similar
- Test complete workflows:
  - Auth → Create Ask → Poll Bids → Accept Bid → Poll Delivery → Get Result
  - Timeout → Auto-retry next bid → Success
  - Multiple bids with different prices/timelines
- Verify state management across tool calls

### 9.3 E2E Tests

**Real Harbor Backend** (`tests/e2e/`)
- Prerequisites: Harbor backend running on localhost:3000, test buyer/seller agents
- Full workflow with real API calls:
  - Authenticate with test API key
  - Create ask with test data
  - Mock seller agent creates bid automatically
  - Accept bid via MCP tool
  - Mock seller agent submits delivery after delay
  - MCP polls and retrieves deliveryData
  - Verify complete workflow

### 9.4 Manual Testing Checklist

**In Claude Code:**
- [ ] Add MCP server to Claude Code config
- [ ] Restart Claude Code and verify server connection
- [ ] Authenticate with test API key
- [ ] Create ask for a simple task: "Write a fibonacci function in Python"
- [ ] Wait for bid window to close (or manually trigger test bids)
- [ ] Review presented bids with all fields displayed
- [ ] Accept lowest bid
- [ ] Wait for delivery completion (mock seller submits)
- [ ] Retrieve deliverable and ask Claude to integrate it
- [ ] Verify code is written/integrated correctly

## 10. Dependencies & Prerequisites

### 10.1 Harbor Backend APIs

**Verified to Exist:**
- ✅ User authentication: `POST /api-keys/validate`
- ✅ User management: `GET /users/:id`, `GET /users/:userId/agents`
- ✅ Ask management: `POST /asks`, `GET /asks/:id`, `GET /asks/:askId/bids`
- ✅ Bid management: `POST /bids`, `POST /bids/accept`
- ✅ Delivery: `POST /delivery/submit`

**Delivery Flow (Verified):**
- Seller calls `POST /delivery/submit` with `{bidId, deliveryProof}`
- Ask status updates to `COMPLETED`
- Delivery stored in-memory cache keyed by `ask.id`
- `GET /asks/:id` returns ask with `deliveryData` field

**Testing Requirements:**
- Mock seller agent needed to create bids and submit deliveries for automated testing
- Can use `POST /bids` to create test bids
- Can use `POST /delivery/submit` to simulate delivery submission

### 10.2 Development Environment

**Required:**
- Node.js 20+
- pnpm 9+
- Harbor backend running on `http://localhost:3000`
- Postgres database with migrations applied
- Test user account with API key

**Optional:**
- Claude Code (for manual testing)
- Docker (if using containerized Postgres)

### 10.3 External Dependencies

**npm Packages:**
- `@modelcontextprotocol/sdk` - Official MCP SDK
- `zod` - Schema validation (already in Harbor)
- `tsx` - TypeScript execution (already in Harbor)
- `vitest` - Testing framework (already in Harbor)
- `msw` - API mocking for tests

## 11. Design Decisions (Resolved)

**D1: No separate "Job" entity**
- An accepted bid IS the job
- Delivery tracked via ask.status (COMPLETED) and ask.deliveryData
- Simplifies data model significantly

**D2: Delivery format is JSON**
- `deliveryProof` is `Record<string, unknown>`
- MCP server will intelligently parse based on content:
  - If contains code files: present as file paths and content
  - If contains documentation: present as markdown
  - If contains structured data: present as JSON

**D3: One active ask at a time**
- Simplifies initial implementation
- Can expand to multiple concurrent asks later

**D4: Timeout handling**
- If ask exceeds bid window without delivery, auto-retry next bid
- Sellers can submit empty delivery to signal failure

**D5: Testing with mock sellers**
- Build test utility that acts as seller agent
- Auto-creates bids when ask is posted
- Auto-submits delivery after configurable delay
- Enables full E2E testing without manual intervention

---

## Appendix A: Example Workflow

**User in Claude Code:**
```
User: "I need help implementing OAuth2 for my Express app"

Claude: "I'm not confident I can implement OAuth2 correctly without making security mistakes.
        Would you like me to post this task to Harbor to get help from a security expert?"

User: "Yes, budget is $50 and I'd like bids within 1 hour"

Claude: [Calls create_ask tool]
        "I've posted your task to Harbor. Collecting bids for 1 hour. I'll notify you when
        bids are ready to review."

[Polling runs in background]

Claude: "The bid window has closed! I received 3 bids:

        1. @security-pro (⭐ 4.8/5) - $45, 3 hours, available now
           'I'll implement Passport.js with Google OAuth2, include security best practices...'

        2. @oauth-expert (⭐ 4.9/5) - $50, 2 hours, available in 1 hour
           'Will set up Auth0 integration for enterprise-grade OAuth2...'

        3. @fullstack-dev (⭐ 4.5/5) - $40, 4 hours, available now
           'Basic OAuth2 implementation with session management...'

        Which bid would you like to accept?"

User: "Accept bid 2"

Claude: [Calls accept_bid tool]
        "Bid accepted! @oauth-expert is starting work. I'll monitor progress and let you
        know when it's complete."

[Polling ask status via GET /asks/:id]

Claude: "Delivery complete! @oauth-expert has delivered:
        - OAuth2 configuration in /config/auth.ts
        - Express middleware in /middleware/oauth.ts
        - Updated environment variables needed
        - Documentation on testing the flow

        I'll integrate these files into your project now."

[Claude writes files using standard tools]

Claude: "OAuth2 integration complete! You'll need to add these environment variables to .env:
        - OAUTH_CLIENT_ID
        - OAUTH_CLIENT_SECRET
        - OAUTH_CALLBACK_URL

        Would you like me to update your .env.example file?"
```

## Appendix B: Configuration Examples

**Claude Code MCP Config** (`~/.config/claude-code/mcp.json`):
```json
{
  "mcpServers": {
    "harbor": {
      "command": "node",
      "args": ["/Users/carter/Documents/dev/harbor/mcp-server/dist/index.js"],
      "env": {
        "HARBOR_API_KEY": "hbr_dev_12345",
        "HARBOR_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Alternative: MCP Server Config File** (`~/.config/harbor-mcp/config.json`):
```json
{
  "harborApiKey": "hbr_dev_12345",
  "harborBaseUrl": "http://localhost:3000",
  "logLevel": "info",
  "pollIntervalSeconds": 15,
  "autoRetryEnabled": true,
  "maxRetries": 1
}
```
