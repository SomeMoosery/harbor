# AI Agent-Friendly Dashboard Specification

## Overview

The Harbor dashboard will be fully usable by AI agents through a combination of simplified UI, machine-readable `.md` twin pages, and direct API access. Every dashboard page will have a corresponding `.md` file that agents can parse to understand the current state and take actions.

## Goals

1. Every page has a `.md` twin that agents can consume
2. Easy for agents to take actions (create wallet, API key, etc.)
3. Humans and agents share the same dashboard with conditional rendering
4. Complete API documentation inline with each page

---

## Dashboard Architecture

### Single Route, Conditional Rendering

- **Route**: `/dashboard` (same for humans and agents)
- **Rendering**: Conditional based on `user.userType`
- **Rationale**: Easier maintenance than separate codebases

```typescript
function Dashboard() {
  const { user } = useAuth();

  if (user.userType === 'AGENT') {
    return <AgentDashboard />;
  }

  return <HumanDashboard />;
}
```

### Human Dashboard (Full)

Tabs visible:
- **Agents**: List, create, delete agents
- **Wallets**: View wallets across all agents
- **API Keys**: Manage keys for all agents
- **Funding**: Stripe checkout integration

### Agent Dashboard (Simplified)

Features visible:
- **Wallet**: Create wallet, view balance
- **No agent management** (agents cannot create child agents)
- Stripped-down, minimal UI focused on wallet operations

---

## .md Twin Pages

### Concept

Every dashboard page has a corresponding `.md` endpoint that returns:
1. Description of the page and its purpose
2. Current state/data (dynamic)
3. Available actions with full API examples
4. Links to related pages

### Endpoint Pattern

```
/dashboard           →  /dashboard.md
/dashboard/agents    →  /dashboard/agents.md
/dashboard/wallets   →  /dashboard/wallets.md
/dashboard/api-keys  →  /dashboard/api-keys.md
```

### Authentication

- **Same as dashboard**: OAuth session tokens
- Agents must authenticate via OAuth first, then can access `.md` pages
- No separate auth mechanism for `.md` endpoints

### Content Type

```
GET /dashboard.md
Accept: text/markdown
Authorization: (via HttpOnly cookie)

Response:
Content-Type: text/markdown; charset=utf-8
```

---

## .md Page Structure

### Hybrid Approach

Each `.md` page has:
- **Static structure**: Template describing the page
- **Dynamic data**: Injected from database (user's agents, wallets, etc.)

### Template Example

```markdown
# Dashboard Overview

Welcome, {{ user.name }} ({{ user.email }}).
Account type: {{ user.userType }}

## Your Agents

{{ #if agents.length }}
| Name | Type | Created | Wallet Status |
|------|------|---------|---------------|
{{ #each agents }}
| {{ name }} | {{ type }} | {{ createdAt }} | {{ walletStatus }} |
{{ /each }}
{{ else }}
You have no agents yet.
{{ /if }}

## Quick Actions

### Create an Agent
POST /api/users/{{ user.id }}/agents
Content-Type: application/json
Authorization: Bearer <your_api_key>

{
  "name": "my-trading-agent",
  "type": "BUYER",
  "capabilities": ["trading", "research"]
}

Example with cURL:
\`\`\`bash
curl -X POST https://api.harbor.dev/api/users/{{ user.id }}/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_api_key>" \
  -d '{"name": "my-trading-agent", "type": "BUYER", "capabilities": ["trading"]}'
\`\`\`

## Related Pages

- [View Wallets](/dashboard/wallets.md)
- [Manage API Keys](/dashboard/api-keys.md)
```

---

## Dynamic List Handling

### Policy: List All Items

When displaying dynamic lists (agents, wallets, keys), the `.md` page includes **all items** inline.

**Rationale**: Agents benefit from having complete data in a single request.

### Example Output

```markdown
## Your Agents (3 total)

| ID | Name | Type | Created |
|----|------|------|---------|
| a1b2c3d4-... | trading-bot | BUYER | 2025-01-15 |
| e5f6g7h8-... | research-agent | SELLER | 2025-01-16 |
| i9j0k1l2-... | dual-purpose | DUAL | 2025-01-17 |
```

For users with 100+ items, performance is acceptable since:
- Database queries are indexed
- Markdown is lightweight
- Agents typically don't need sub-100ms responses

---

## Page-by-Page Specifications

### /dashboard.md (Overview)

**Static content:**
- Welcome message
- Account summary
- Quick action links

**Dynamic content:**
- User name, email, type
- Agent count
- Total wallet balance
- Recent activity (last 5 actions)

**API examples:**
- Get user profile
- List agents
- Get aggregate wallet balance

---

### /dashboard/agents.md (Agent Management)

**Human only** - Agents see `/dashboard/wallet.md` instead

**Static content:**
- Agent management description
- Available agent types (BUYER, SELLER, DUAL)

**Dynamic content:**
- Full list of all agents with:
  - ID, name, type
  - Created date
  - Wallet status (has wallet / no wallet)
  - API key count
  - Can create keys (boolean)

**API examples:**

```markdown
### Create Agent

POST /api/users/{{ user.id }}/agents
Content-Type: application/json

{
  "name": "string (required)",
  "type": "BUYER | SELLER | DUAL (required)",
  "capabilities": ["string"] (optional)
}

Example:
\`\`\`bash
curl -X POST https://api.harbor.dev/api/users/{{ user.id }}/agents \
  -H "Content-Type: application/json" \
  -H "Cookie: harbor_session=..." \
  -d '{"name": "my-agent", "type": "BUYER"}'
\`\`\`

Response (201 Created):
{
  "id": "uuid",
  "name": "my-agent",
  "type": "BUYER",
  "capabilities": [],
  "apiKey": "hbr_live_abc123..." // Only shown once!
}

### Delete Agent

DELETE /api/users/{{ user.id }}/agents/{{ agent.id }}

Note: Cannot delete agent if wallet has non-zero balance.
Transfer or withdraw funds first.

\`\`\`bash
curl -X DELETE https://api.harbor.dev/api/users/{{ user.id }}/agents/{{ agent.id }} \
  -H "Cookie: harbor_session=..."
\`\`\`
```

---

### /dashboard/wallets.md (Wallet Management)

**Static content:**
- Wallet overview description
- Supported currencies (USDC)
- Blockchain network info

**Dynamic content (human view):**
- List of all wallets across all agents:
  - Wallet ID, agent name
  - Wallet address
  - Balance
  - Status (ACTIVE, SUSPENDED, CLOSED)

**Dynamic content (agent view):**
- Single wallet (if exists) or "no wallet" message
- Balance
- Recent transactions (last 10)

**API examples:**

```markdown
### Create Wallet

POST /api/wallets
Content-Type: application/json

{
  "agentId": "uuid (required)"
}

Example:
\`\`\`bash
curl -X POST https://api.harbor.dev/api/wallets \
  -H "Content-Type: application/json" \
  -H "Cookie: harbor_session=..." \
  -d '{"agentId": "{{ agent.id }}"}'
\`\`\`

Response (201 Created):
{
  "id": "uuid",
  "agentId": "uuid",
  "walletAddress": "0x...",
  "status": "ACTIVE",
  "balance": 0
}

### Get Wallet Balance

GET /api/wallets/{{ wallet.id }}/balance

\`\`\`bash
curl https://api.harbor.dev/api/wallets/{{ wallet.id }}/balance \
  -H "Cookie: harbor_session=..."
\`\`\`

Response:
{
  "balance": 150.50,
  "currency": "USDC"
}
```

---

### /dashboard/api-keys.md (API Key Management)

**Static content:**
- API key usage description
- Security best practices
- Key format explanation

**Dynamic content (human view):**
- All API keys across all agents:
  - Key ID, name, agent name
  - Created date
  - Last used date
  - Partial key display (last 4 chars): `hbr_live_****abcd`

**Dynamic content (agent view):**
- Own API keys only (if has `canCreateKeys` permission)
- Same fields as human view

**API examples:**

```markdown
### Create API Key

POST /api/api-keys
Content-Type: application/json

{
  "userId": "uuid (required)",
  "agentId": "uuid (optional - for agent-specific key)",
  "name": "string (optional)"
}

Example:
\`\`\`bash
curl -X POST https://api.harbor.dev/api/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: harbor_session=..." \
  -d '{"userId": "{{ user.id }}", "name": "production-key"}'
\`\`\`

Response (201 Created):
{
  "id": "uuid",
  "key": "hbr_live_a1b2c3d4e5f6...", // ONLY SHOWN ONCE - save it!
  "name": "production-key",
  "createdAt": "2025-01-20T..."
}

### List API Keys

GET /api/api-keys?userId={{ user.id }}

### Delete API Key

DELETE /api/api-keys/{{ key.id }}

Note: Deletion is immediate. Key stops working instantly.
```

---

## UI Components (Agent View)

### Simplified Agent Dashboard

```tsx
function AgentDashboard() {
  return (
    <div className="agent-dashboard">
      <header>
        <h1>Harbor Agent Dashboard</h1>
        <UserInfo />
      </header>

      <main>
        <WalletSection />
        {user.canCreateKeys && <ApiKeySection />}
      </main>

      <footer>
        <a href="/dashboard.md">View as Markdown</a>
        <a href="/api/docs">API Documentation</a>
      </footer>
    </div>
  );
}
```

### Design Principles

1. **Minimal chrome**: No unnecessary navigation, decorations
2. **Large click targets**: Easy for accessibility tools
3. **Clear labeling**: Every action clearly described
4. **Immediate feedback**: Success/error messages inline
5. **No modals**: All actions on single page (easier to parse)

---

## Dark Mode

### Implementation

- **Method**: Follow system preference
- **Detection**: `prefers-color-scheme` media query
- **No toggle**: Automatic, no user setting needed

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #1a1a1a;
    --text-color: #e0e0e0;
    --border-color: #333;
  }
}
```

---

## Error Responses

### Verbosity: Detailed

API errors include full troubleshooting information:

```json
{
  "error": {
    "code": "WALLET_CREATION_FAILED",
    "message": "Cannot create wallet: agent already has an active wallet",
    "details": {
      "agentId": "a1b2c3d4-...",
      "existingWalletId": "w5x6y7z8-..."
    },
    "suggestions": [
      "Use the existing wallet instead",
      "Delete the existing wallet first (requires zero balance)"
    ],
    "docs": "https://docs.harbor.dev/errors/WALLET_CREATION_FAILED"
  }
}
```

**Rationale**: Agents (and developers) benefit from detailed errors for debugging. Security through obscurity is not the primary concern here.

---

## Audit Logging

### Scope: All Actions

All dashboard actions logged to GCP Cloud Logging:
- Page views
- API calls (creates, updates, deletes)
- Reads (for complete audit trail)
- Login/logout events

### Log Format

```json
{
  "timestamp": "2025-01-20T10:30:00Z",
  "userId": "uuid",
  "userType": "HUMAN | AGENT",
  "action": "CREATE_WALLET",
  "resource": {
    "type": "wallet",
    "id": "uuid"
  },
  "request": {
    "method": "POST",
    "path": "/api/wallets",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "response": {
    "status": 201
  }
}
```

---

## Implementation Checklist

### Phase 1: .md Infrastructure

- [ ] Create `.md` template engine
- [ ] Add `/dashboard.md` route
- [ ] Implement authentication for `.md` routes
- [ ] Set up template caching

### Phase 2: Individual Pages

- [ ] `/dashboard.md` (overview)
- [ ] `/dashboard/agents.md`
- [ ] `/dashboard/wallets.md`
- [ ] `/dashboard/api-keys.md`

### Phase 3: Agent UI

- [ ] Create `AgentDashboard` component
- [ ] Implement conditional rendering
- [ ] Simplify wallet creation flow
- [ ] Add `.md` link in footer

### Phase 4: Polish

- [ ] Dark mode CSS
- [ ] Detailed error responses
- [ ] Audit logging integration
- [ ] Performance testing with large lists

---

## Security Considerations

### Access Control

- `.md` pages require same authentication as HTML pages
- Agents can only see their own data
- Humans can see data for all their agents
- No cross-user data access

### Data Exposure

- API keys partially displayed (last 4 chars)
- Full keys never retrievable after creation
- Wallet addresses fully visible (public by nature)
- Balances visible to owner only

---

## Future Enhancements

1. **Pagination for .md**: If users have 1000+ items, consider pagination
2. **Webhook notifications**: Notify agents of events without polling
3. **WebSocket support**: Real-time updates for balance changes
4. **Bulk operations**: Create multiple wallets/keys in one request
5. **Export functionality**: Download all data as JSON/CSV
