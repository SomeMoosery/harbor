# OAuth Authentication Specification

## Overview

Harbor will implement Google OAuth 2.0 as the sole authentication mechanism for both humans and AI agents. This replaces the current email/phone-only user creation with a modern, secure authentication flow.

## Goals

1. Enable both humans and AI agents to create accounts with Harbor
2. Secure the dashboard with OAuth authentication
3. Support user type selection (human vs agent) after OAuth
4. Allow humans to manage agents and agents to manage wallets

---

## Authentication Provider

### Google OAuth 2.0

- **Provider**: Google only (no multi-provider support)
- **OAuth Scopes**: Minimal - `email` and `profile` only
- **User Provisioning**: Auto-provision (any Google user can sign up)
- **Rationale**: Google-only simplifies implementation and integrates naturally with GCP deployment

### OAuth Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Harbor    │────▶│   Google    │────▶│   Harbor    │
│             │     │   Gateway   │     │   OAuth     │     │   Callback  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                                                            │
      │                                                            ▼
      │                                                    ┌─────────────┐
      │                                                    │  User DB    │
      │                                                    │  (create/   │
      │                                                    │   lookup)   │
      │                                                    └─────────────┘
      │                                                            │
      │◀───────────────────── HttpOnly Cookie ─────────────────────┘
```

1. User visits `/login` or protected route
2. Redirect to Google OAuth consent screen
3. User grants access
4. Google redirects to `/auth/callback` with authorization code
5. Harbor exchanges code for tokens
6. Create or lookup user in database
7. Set HttpOnly session cookie
8. Redirect to dashboard (or onboarding for new users)

---

## User Types

### Human Users

- Can create and manage AI agents
- Can view all agents, wallets, and API keys
- Can create API keys for agents
- Can delegate key creation permission to agents
- See full dashboard with all tabs

### Agent Users

- Simplified dashboard experience
- Can create wallets
- Can view wallet balance
- Cannot create child agents
- Can create API keys (if delegated permission)
- See stripped-down dashboard (wallet-focused)

### Type Selection

- **Trigger**: Onboarding page shown after first OAuth login
- **Location**: `/onboarding` route
- **Content**:
  - Explanation of human vs agent accounts
  - Selection buttons with clear descriptions
  - Self-select (no verification required initially)
  - **TODO**: Add verification mechanism in future (CAPTCHA for humans, automated challenge for agents)

### Type Mutability

- User type is **fully mutable**
- Users can switch between human and agent types
- **Constraint**: Cannot switch to agent type if user has child agents
  - Must delete all child agents first
  - This prevents orphaned agent hierarchies

---

## Session Management

### Token Storage

- **Method**: HttpOnly cookies (server-side sessions)
- **Rationale**: Most secure option, prevents XSS attacks
- **CSRF Protection**: Required (implement CSRF tokens)

### Session Duration

- **Type**: Sliding window
- **Duration**: 7 days of inactivity
- **Behavior**: Session extends with each authenticated request
- **Maximum**: No upper bound while user remains active

### Concurrent Sessions

- **Policy**: Allowed
- **Rationale**: Users should be able to access from multiple devices (laptop, phone)
- **No limit** on number of concurrent sessions

---

## Rate Limiting

### OAuth Login Attempts

- **Limit**: 10 attempts per minute per IP address
- **Scope**: Per-IP, not per-email
- **Response**: HTTP 429 Too Many Requests
- **Reset**: After 1 minute of no attempts

### Implementation

```typescript
interface RateLimitConfig {
  windowMs: 60000;       // 1 minute
  maxAttempts: 10;
  keyGenerator: (req) => req.ip;
}
```

---

## Database Schema Changes

### Users Table Updates

```sql
ALTER TABLE users ADD COLUMN google_id text UNIQUE;
ALTER TABLE users ADD COLUMN user_type text NOT NULL DEFAULT 'HUMAN'
  CHECK (user_type IN ('HUMAN', 'AGENT'));
ALTER TABLE users ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN profile_picture_url text;

-- Make email/phone optional (OAuth provides email)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

-- Add index for Google ID lookups
CREATE UNIQUE INDEX idx_users_google_id ON users(google_id) WHERE deleted_at IS NULL;
```

### Sessions Table (New)

```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  session_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  last_accessed_at timestamptz NOT NULL DEFAULT NOW(),
  ip_address inet,
  user_agent text
);

CREATE INDEX idx_sessions_token ON sessions(session_token) WHERE expires_at > NOW();
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

---

## API Endpoints

### Public Endpoints (No Auth Required)

```
GET  /auth/login          # Initiates Google OAuth flow
GET  /auth/callback       # Google OAuth callback handler
POST /auth/logout         # Destroys session
GET  /health              # Health check
```

### Protected Endpoints (Auth Required)

```
GET  /api/*               # All API routes require authentication
GET  /dashboard           # Dashboard pages
GET  /dashboard.md        # Dashboard .md twin pages
```

### Auth Middleware

```typescript
async function authMiddleware(req, res, next) {
  const sessionToken = req.cookies['harbor_session'];

  if (!sessionToken) {
    return res.redirect('/auth/login');
  }

  const session = await validateSession(sessionToken);

  if (!session) {
    res.clearCookie('harbor_session');
    return res.redirect('/auth/login');
  }

  // Extend sliding window
  await extendSession(session.id);

  req.user = await getUser(session.userId);
  next();
}
```

---

## Gateway Integration

### All Traffic Through Gateway

- Dashboard requests route through Gateway (port 3000)
- No direct service access from dashboard
- Gateway handles OAuth verification and session management

### Request Flow

```
Dashboard ──▶ Gateway ──▶ Auth Middleware ──▶ Service Proxy ──▶ User/Wallet Service
                │
                ▼
         Session Validation
```

---

## Error Handling

### OAuth Errors

| Error | Response | User Message |
|-------|----------|--------------|
| Google OAuth denied | Redirect to /login | "Authentication cancelled. Please try again." |
| Invalid state param | Redirect to /login | "Session expired. Please try again." |
| Google API error | Redirect to /login | "Unable to connect to Google. Please try again." |
| Rate limited | HTTP 429 | "Too many login attempts. Please wait a minute." |

### Session Errors

| Error | Response | Behavior |
|-------|----------|----------|
| Session expired | HTTP 401 | Clear cookie, redirect to /login |
| Invalid session | HTTP 401 | Clear cookie, redirect to /login |
| Session not found | HTTP 401 | Clear cookie, redirect to /login |

---

## Security Considerations

### Cookie Configuration

```typescript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

### CSRF Protection

- Generate CSRF token per session
- Include in forms and AJAX requests
- Validate on state-changing operations (POST, PUT, DELETE)

### State Parameter

- Generate random state for each OAuth initiation
- Store in session or signed cookie
- Validate on callback to prevent CSRF

---

## Implementation Notes

### Dependencies to Add

```json
{
  "googleapis": "^130.0.0",
  "cookie-parser": "^1.4.6",
  "csrf-csrf": "^3.0.0"
}
```

### Environment Variables

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/callback
SESSION_SECRET=your_session_secret
```

---

## Migration Path

### Phase 1: Add OAuth (Parallel)

1. Implement OAuth endpoints
2. Add session management
3. Keep existing API key auth working
4. Test OAuth flow end-to-end

### Phase 2: Dashboard Auth

1. Add auth middleware to dashboard routes
2. Implement onboarding flow
3. Update dashboard to show user-specific data

### Phase 3: Deprecate Old Flow

1. Remove direct service access from dashboard
2. Require OAuth for all dashboard access
3. Keep API key auth for programmatic access

---

## Future Enhancements (TODOs)

1. **Agent Verification**: Implement automated challenge for agents, CAPTCHA for humans
2. **MFA Support**: Optional TOTP/WebAuthn for high-security accounts
3. **Admin Impersonation**: Ability for admins to view as specific users (currently decided against)
4. **Session Revocation**: Endpoint to revoke all sessions for a user
5. **Login History**: Show user their recent login activity
