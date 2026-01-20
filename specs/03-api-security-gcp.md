# API Security Specification (GCP Deployment)

## Overview

Harbor will use Google Cloud Platform (GCP) for production deployment with a focus on secure API key management, proper secret handling, and comprehensive audit logging. API keys will be stored in Google Secret Manager with synchronous validation.

## Goals

1. Secure API key storage and validation using GCP Secret Manager
2. Support API key creation, rotation, and revocation
3. Implement proper audit logging via GCP Cloud Logging
4. Deploy microservices securely on Cloud Run
5. Enable delegated key creation for agents

---

## GCP Infrastructure

### Compute: Cloud Run

Each Harbor microservice runs as a separate Cloud Run service:

```
┌─────────────────────────────────────────────────────────────────┐
│                        GCP Project                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Gateway   │  │    User     │  │   Wallet    │              │
│  │  Cloud Run  │  │  Cloud Run  │  │  Cloud Run  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                    ┌─────┴─────┐                                 │
│                    │    VPC    │                                 │
│                    │ Connector │                                 │
│                    └─────┬─────┘                                 │
│                          │                                       │
│  ┌───────────────────────┼───────────────────────┐              │
│  │                       │                       │              │
│  ▼                       ▼                       ▼              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Cloud SQL  │  │   Secret    │  │    Cloud    │              │
│  │  (Postgres) │  │   Manager   │  │   Logging   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Service Configuration

```yaml
# cloud-run-service.yaml (example for Gateway)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: harbor-gateway
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/vpc-access-connector: harbor-vpc-connector
        run.googleapis.com/vpc-access-egress: private-ranges-only
    spec:
      containers:
        - image: gcr.io/harbor-prod/gateway:latest
          env:
            - name: NODE_ENV
              value: production
          resources:
            limits:
              memory: 512Mi
              cpu: '1'
```

### Internal Communication: VPC Only

- Services communicate via internal URLs within VPC
- No authentication between internal services
- External traffic only through Gateway
- VPC Connector restricts egress

```typescript
// Service URLs (internal)
const USER_SERVICE_URL = 'https://harbor-user-internal-xyz.run.app';
const WALLET_SERVICE_URL = 'https://harbor-wallet-internal-xyz.run.app';

// All internal - no auth headers needed
```

---

## API Key Management

### Storage: Google Secret Manager

API keys stored in Secret Manager, not PostgreSQL:

```
Secret Name Format: harbor-api-key-{key_id}
Secret Value: {
  "key": "hbr_live_abc123...",
  "userId": "uuid",
  "agentId": "uuid | null",
  "name": "production-key",
  "createdAt": "2025-01-20T...",
  "canCreateKeys": false
}
```

### Key Format

```
hbr_live_{32 random hex characters}
Example: hbr_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Key Metadata in PostgreSQL

PostgreSQL stores metadata only (no actual key value):

```sql
CREATE TABLE api_key_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  agent_id uuid REFERENCES agents(id),
  name text,
  key_hint text NOT NULL,  -- Last 4 chars: "...o5p6"
  secret_name text NOT NULL UNIQUE,  -- Reference to Secret Manager
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by_agent boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX idx_api_key_metadata_user ON api_key_metadata(user_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_api_key_metadata_secret ON api_key_metadata(secret_name)
  WHERE deleted_at IS NULL;
```

---

## Key Validation Flow

### Synchronous Validation

Every API request validates the key against Secret Manager in real-time:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Gateway  │────▶│  Secret  │────▶│   User   │
│          │     │          │     │ Manager  │     │ Service  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  Bearer token  │                │                │
     │───────────────▶│                │                │
     │                │  List secrets  │                │
     │                │  with filter   │                │
     │                │───────────────▶│                │
     │                │                │                │
     │                │  Secret data   │                │
     │                │◀───────────────│                │
     │                │                │                │
     │                │  Get user by   │                │
     │                │  userId        │                │
     │                │───────────────────────────────▶│
     │                │                │                │
     │                │  User data     │                │
     │                │◀───────────────────────────────│
     │                │                │                │
     │   Response     │                │                │
     │◀───────────────│                │                │
```

### Validation Implementation

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretManager = new SecretManagerServiceClient();

async function validateApiKey(apiKey: string): Promise<ValidationResult | null> {
  // Search for matching secret
  const [secrets] = await secretManager.listSecrets({
    parent: `projects/${PROJECT_ID}`,
    filter: `labels.key_prefix:${apiKey.slice(0, 16)}`,
  });

  for (const secret of secrets) {
    const [version] = await secretManager.accessSecretVersion({
      name: `${secret.name}/versions/latest`,
    });

    const payload = JSON.parse(version.payload.data.toString());

    if (payload.key === apiKey) {
      // Update last used timestamp (async, don't wait)
      updateLastUsed(secret.name);

      return {
        valid: true,
        userId: payload.userId,
        agentId: payload.agentId,
        canCreateKeys: payload.canCreateKeys,
      };
    }
  }

  return null;
}
```

### Performance Considerations

- **Latency**: ~50-100ms per Secret Manager call
- **Acceptable for**: API requests (not real-time trading)
- **No caching**: Always fresh data, immediate revocation works
- **Optimization**: Use labels for faster filtering

---

## Key Lifecycle

### Creation

1. User/agent requests key creation via dashboard or API
2. Generate random key: `hbr_live_` + 32 hex chars
3. Create secret in Secret Manager with metadata
4. Store metadata (not key) in PostgreSQL
5. Return full key to user **once only**

```typescript
async function createApiKey(params: CreateKeyParams): Promise<ApiKey> {
  const keyId = uuidv4();
  const rawKey = `hbr_live_${randomBytes(16).toString('hex')}`;
  const secretName = `harbor-api-key-${keyId}`;

  // Store in Secret Manager
  const [secret] = await secretManager.createSecret({
    parent: `projects/${PROJECT_ID}`,
    secretId: secretName,
    secret: {
      replication: { automatic: {} },
      labels: {
        key_prefix: rawKey.slice(0, 16),
        user_id: params.userId,
      },
    },
  });

  await secretManager.addSecretVersion({
    parent: secret.name,
    payload: {
      data: Buffer.from(JSON.stringify({
        key: rawKey,
        userId: params.userId,
        agentId: params.agentId,
        name: params.name,
        createdAt: new Date().toISOString(),
        canCreateKeys: false,
      })),
    },
  });

  // Store metadata in Postgres
  await db.query(`
    INSERT INTO api_key_metadata (id, user_id, agent_id, name, key_hint, secret_name)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [keyId, params.userId, params.agentId, params.name, rawKey.slice(-4), secretName]);

  // Log creation
  await logAuditEvent('API_KEY_CREATED', { keyId, userId: params.userId });

  return {
    id: keyId,
    key: rawKey,  // Only returned once!
    name: params.name,
    createdAt: new Date(),
  };
}
```

### Rotation (Optional, User-Initiated)

Keys do not auto-expire. Rotation is user-initiated only:

```typescript
async function rotateApiKey(keyId: string, userId: string): Promise<ApiKey> {
  // Verify ownership
  const metadata = await getKeyMetadata(keyId);
  if (metadata.userId !== userId) throw new ForbiddenError();

  // Generate new key
  const newRawKey = `hbr_live_${randomBytes(16).toString('hex')}`;

  // Update secret with new version
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${metadata.secretName}/versions/latest`,
  });

  const payload = JSON.parse(version.payload.data.toString());
  payload.key = newRawKey;

  await secretManager.addSecretVersion({
    parent: `projects/${PROJECT_ID}/secrets/${metadata.secretName}`,
    payload: {
      data: Buffer.from(JSON.stringify(payload)),
    },
  });

  // Update hint in Postgres
  await db.query(`
    UPDATE api_key_metadata
    SET key_hint = $1
    WHERE id = $2
  `, [newRawKey.slice(-4), keyId]);

  await logAuditEvent('API_KEY_ROTATED', { keyId, userId });

  return {
    id: keyId,
    key: newRawKey,  // New key, shown once
    name: metadata.name,
    createdAt: metadata.createdAt,
  };
}
```

### Deletion (Immediate)

Key deletion is immediate with no grace period:

```typescript
async function deleteApiKey(keyId: string, userId: string): Promise<void> {
  const metadata = await getKeyMetadata(keyId);
  if (metadata.userId !== userId) throw new ForbiddenError();

  // Delete from Secret Manager (immediate)
  await secretManager.deleteSecret({
    name: `projects/${PROJECT_ID}/secrets/${metadata.secretName}`,
  });

  // Soft delete in Postgres
  await db.query(`
    UPDATE api_key_metadata
    SET deleted_at = NOW()
    WHERE id = $1
  `, [keyId]);

  await logAuditEvent('API_KEY_DELETED', { keyId, userId });
}
```

---

## Auto Key Creation

### On Agent Creation

When a user creates an agent, an API key is automatically generated:

```typescript
async function createAgent(params: CreateAgentParams): Promise<Agent> {
  // Create agent
  const agent = await db.query(`
    INSERT INTO agents (user_id, name, type, capabilities)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [params.userId, params.name, params.type, params.capabilities]);

  // Auto-create API key
  const apiKey = await createApiKey({
    userId: params.userId,
    agentId: agent.id,
    name: `${params.name}-default-key`,
  });

  return {
    ...agent,
    apiKey: apiKey.key,  // Returned with agent, shown once
  };
}
```

---

## Delegated Key Creation

### Permission Model: Simple Boolean

Agents can be granted permission to create their own keys:

```sql
ALTER TABLE agents ADD COLUMN can_create_keys boolean NOT NULL DEFAULT false;
```

### Granting Permission

```typescript
async function updateAgentPermissions(
  agentId: string,
  userId: string,
  permissions: { canCreateKeys: boolean }
): Promise<void> {
  // Verify human owns this agent
  const agent = await getAgent(agentId);
  if (agent.userId !== userId) throw new ForbiddenError();

  await db.query(`
    UPDATE agents
    SET can_create_keys = $1
    WHERE id = $2
  `, [permissions.canCreateKeys, agentId]);

  await logAuditEvent('AGENT_PERMISSIONS_UPDATED', {
    agentId,
    userId,
    canCreateKeys: permissions.canCreateKeys
  });
}
```

### Agent Key Creation

```typescript
async function createKeyAsAgent(
  agentId: string,
  params: { name?: string }
): Promise<ApiKey> {
  const agent = await getAgent(agentId);

  if (!agent.canCreateKeys) {
    throw new ForbiddenError('Agent does not have permission to create keys');
  }

  const key = await createApiKey({
    userId: agent.userId,
    agentId: agentId,
    name: params.name,
    createdByAgent: true,
  });

  await logAuditEvent('API_KEY_CREATED_BY_AGENT', {
    keyId: key.id,
    agentId,
    userId: agent.userId
  });

  return key;
}
```

---

## Key Visibility

### Human View

Humans see all keys for all their agents:

```typescript
async function listKeysForUser(userId: string): Promise<ApiKeyMetadata[]> {
  return db.query(`
    SELECT
      k.id, k.name, k.key_hint, k.created_at, k.last_used_at,
      k.created_by_agent, a.name as agent_name
    FROM api_key_metadata k
    LEFT JOIN agents a ON k.agent_id = a.id
    WHERE k.user_id = $1 AND k.deleted_at IS NULL
    ORDER BY k.created_at DESC
  `, [userId]);
}
```

### Display Format

```json
{
  "id": "uuid",
  "name": "production-key",
  "keyHint": "...o5p6",
  "createdAt": "2025-01-20T10:00:00Z",
  "lastUsedAt": "2025-01-20T12:30:00Z",
  "createdByAgent": false,
  "agentName": "trading-bot"
}
```

---

## Audit Logging

### Destination: GCP Cloud Logging

All security-relevant events logged to Cloud Logging (not PostgreSQL):

```typescript
import { Logging } from '@google-cloud/logging';

const logging = new Logging();
const log = logging.log('harbor-audit');

async function logAuditEvent(
  action: string,
  data: Record<string, unknown>
): Promise<void> {
  const entry = log.entry({
    resource: { type: 'cloud_run_revision' },
    severity: 'INFO',
  }, {
    timestamp: new Date().toISOString(),
    action,
    ...data,
    service: process.env.K_SERVICE,
    revision: process.env.K_REVISION,
  });

  await log.write(entry);
}
```

### Logged Events

| Event | Data Logged |
|-------|-------------|
| `USER_CREATED` | userId, email, userType, method (OAuth) |
| `USER_TYPE_CHANGED` | userId, oldType, newType |
| `AGENT_CREATED` | agentId, userId, agentType |
| `AGENT_DELETED` | agentId, userId |
| `API_KEY_CREATED` | keyId, userId, agentId, createdByAgent |
| `API_KEY_ROTATED` | keyId, userId |
| `API_KEY_DELETED` | keyId, userId |
| `API_KEY_USED` | keyId, userId, endpoint, ip |
| `WALLET_CREATED` | walletId, agentId |
| `LOGIN_SUCCESS` | userId, ip, userAgent |
| `LOGIN_FAILED` | email, ip, reason |
| `PERMISSION_GRANTED` | agentId, userId, permission |

---

## Database: Cloud SQL

### Configuration

```yaml
# terraform/cloudsql.tf (conceptual)
resource "google_sql_database_instance" "harbor" {
  name             = "harbor-production"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier = "db-custom-2-4096"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled            = true
      point_in_time_recovery_enabled = true
    }
  }
}
```

### Separate Databases

Each service has its own database (as currently designed):

- `harbor_user` - Users, agents, API key metadata
- `harbor_wallet` - Wallets, transactions, ledger
- `harbor_tendering` - Asks, bids
- `harbor_settlement` - Settlement records

---

## Security Best Practices

### Secret Manager IAM

```yaml
# Each service has minimal Secret Manager access
roles:
  gateway:
    - roles/secretmanager.secretAccessor  # Read keys only
  user-service:
    - roles/secretmanager.admin  # Create/delete keys
```

### Network Security

- VPC-only internal communication
- Cloud Run ingress set to "internal-and-cloud-load-balancing"
- No public IPs for Cloud SQL
- IAP (Identity-Aware Proxy) for admin access

### Secret Rotation

While API keys don't auto-rotate, GCP secrets for infrastructure do:

```bash
# Circle API key, Stripe key, etc. stored in Secret Manager
# Rotated manually or via Cloud Functions on schedule
```

---

## API Endpoints

### Key Management

```
POST   /api/api-keys              # Create key (human or delegated agent)
GET    /api/api-keys              # List keys (filtered by user)
GET    /api/api-keys/:id          # Get key metadata
DELETE /api/api-keys/:id          # Delete key (immediate)
POST   /api/api-keys/:id/rotate   # Rotate key (new value)
POST   /api/api-keys/validate     # Validate key (internal use)
```

### Permission Management

```
PATCH  /api/agents/:id/permissions  # Update agent permissions
```

---

## Environment Variables

### Production

```bash
# GCP Project
GCP_PROJECT_ID=harbor-production

# Secret Manager (automatic with workload identity)
# No explicit credentials needed on Cloud Run

# Cloud SQL
DATABASE_URL_USER=postgresql://user:pass@/harbor_user?host=/cloudsql/harbor-prod:us-central1:harbor

# Service URLs (internal)
USER_SERVICE_URL=https://harbor-user-internal-xyz.run.app
WALLET_SERVICE_URL=https://harbor-wallet-internal-xyz.run.app

# External APIs (values from Secret Manager)
CIRCLE_API_KEY=sm://harbor-production/circle-api-key
STRIPE_API_KEY=sm://harbor-production/stripe-api-key
```

---

## Migration from Current System

### Phase 1: Add Secret Manager

1. Deploy Secret Manager infrastructure
2. Create secrets for existing API keys
3. Update validation to read from Secret Manager
4. Keep Postgres as fallback

### Phase 2: Migrate Existing Keys

1. For each existing API key in Postgres:
   - Create Secret Manager secret
   - Store metadata reference
2. Update key creation to use Secret Manager
3. Remove plaintext keys from Postgres

### Phase 3: Cloud Run Deployment

1. Containerize all services
2. Deploy to Cloud Run
3. Configure VPC connector
4. Set up Cloud SQL connections
5. Configure IAM and secrets access

### Phase 4: Cleanup

1. Remove Postgres plaintext key storage
2. Update all documentation
3. Archive migration scripts

---

## Monitoring & Alerting

### Metrics to Track

- API key validation latency (p50, p95, p99)
- Failed validation attempts per minute
- Key creation/deletion rate
- Secret Manager API errors

### Alerts

```yaml
# Cloud Monitoring alert policy
- displayName: High Failed Key Validations
  conditions:
    - displayName: Failed validations > 100/min
      filter: metric.type="custom.googleapis.com/harbor/key_validation_failed"
      threshold: 100
  notificationChannels: [ops-team]
```

---

## Cost Considerations

### Secret Manager Pricing

- $0.06 per 10,000 access operations
- $0.03 per secret version per month
- Estimated: ~$50/month for 1M API calls/month

### Cloud Run Pricing

- Pay per request + CPU/memory time
- Minimum instances can reduce cold starts
- Estimated: varies significantly with traffic

### Cloud SQL Pricing

- db-custom-2-4096: ~$100/month
- Storage: $0.17/GB/month
- Backups: included in instance cost
