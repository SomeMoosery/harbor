# Ledger Reconciliation System

## Overview

The ledger reconciliation system tracks the flow of funds between **external payment providers** (like Stripe) and **internal wallets** (like Circle). It ensures that funds received externally actually make it into the correct agent's wallet, and handles edge cases where one side succeeds but the other fails.

**Important**: The ledger is NOT used for tracking internal wallet balances or internal transfers between wallets. It is ONLY for external ↔ internal reconciliation.

## Key Concepts

### Ledger Entry Types

- **ONRAMP**: External fiat payment (Stripe) → Internal USDC wallet (Circle)
- **OFFRAMP**: Internal USDC wallet (Circle) → External fiat payout (Stripe/Bank)
- **INTERNAL_TRANSFER**: Special case transfers that need reconciliation tracking

### Ledger Entry Status Flow

```
PENDING
  ↓
EXTERNAL_COMPLETED (Stripe payment succeeded)
  ↓
INTERNAL_COMPLETED (USDC credited to wallet)
  ↓
RECONCILED (Both sides confirmed)
```

### Edge Case Statuses

- **FAILED**: One or both sides failed
- **REQUIRES_MANUAL_REVIEW**: External succeeded but internal failed, or other anomalies

## How It Works

### Onramp Flow (Deposit)

When a user deposits funds via Stripe:

1. **Initiate Payment**: Process Stripe payment intent
2. **Create Ledger Entry**: Record with status `PENDING`
   - External fields: Stripe transaction ID, fiat amount, currency
   - Internal fields: Expected USDC amount
   - Agent ID: Links payment to specific agent

3. **External Completion**: Stripe webhook or payment result confirms success
   - Update status to `EXTERNAL_COMPLETED`
   - Record external completion timestamp

4. **Internal Completion**: USDC minted and credited to agent's wallet
   - Update status to `INTERNAL_COMPLETED`
   - Record internal transaction ID and completion timestamp

5. **Reconciliation**: Both sides completed successfully
   - Update status to `RECONCILED`
   - Record reconciliation timestamp and notes

### Edge Case Handling

**Scenario: Stripe succeeds, Circle fails**

```
1. User pays $100 via Stripe ✓
2. Stripe payment succeeds → status: EXTERNAL_COMPLETED
3. Circle USDC mint fails ✗
4. Status: EXTERNAL_COMPLETED (stuck, not progressing)
5. Reconciliation job detects this → status: REQUIRES_MANUAL_REVIEW
6. Support team manually credits wallet or refunds Stripe payment
```

## Database Schema

```typescript
ledger_entries {
  id: uuid
  agentId: text                          // Which agent this belongs to
  walletId: uuid                         // Agent's wallet

  // Type and status
  type: 'ONRAMP' | 'OFFRAMP' | 'INTERNAL_TRANSFER'
  status: 'PENDING' | 'EXTERNAL_COMPLETED' | 'INTERNAL_COMPLETED' |
          'RECONCILED' | 'FAILED' | 'REQUIRES_MANUAL_REVIEW'

  // External provider (Stripe)
  externalProvider: text                 // 'stripe', 'ach', 'wire'
  externalTransactionId: text            // Stripe payment intent ID
  externalAmount: real                   // Fiat amount (e.g., 100.00 USD)
  externalCurrency: text                 // 'USD', 'EUR', etc.
  externalStatus: text                   // Provider-specific status
  externalCompletedAt: timestamp

  // Internal wallet (Circle)
  internalTransactionId: uuid            // Reference to transactions table
  internalAmount: real                   // USDC amount (e.g., 100.00 USDC)
  internalCurrency: text                 // 'USDC'
  internalStatus: text                   // 'pending', 'completed', 'failed'
  internalCompletedAt: timestamp

  // Reconciliation
  reconciledAt: timestamp
  reconciliationNotes: text

  // Fees
  platformFee: real
  externalProviderFee: real

  description: text
  metadata: jsonb
  createdAt: timestamp
  updatedAt: timestamp
}
```

## Usage

### Creating an Onramp Entry

```typescript
const ledgerEntry = await ledgerEntryResource.createOnrampEntry({
  agentId: 'agent-123',
  walletId: 'wallet-456',
  externalProvider: 'stripe',
  externalTransactionId: 'pi_abc123',
  externalAmount: 100.00,
  externalCurrency: 'USD',
  internalAmount: 100.00,
  internalCurrency: 'USDC',
  description: 'Deposit via Stripe for agent-123',
  metadata: { paymentMethodId: 'pm_xyz' }
});
// Status: PENDING
```

### Updating External Status

```typescript
// Called when Stripe webhook confirms payment
await ledgerEntryResource.updateExternalStatus(
  ledgerEntry.id,
  'succeeded'
);
// Status: EXTERNAL_COMPLETED
```

### Updating Internal Status

```typescript
// Called when USDC successfully minted
await ledgerEntryResource.updateInternalStatus(
  ledgerEntry.id,
  'tx-789',  // Internal transaction ID
  'completed'
);
// Status: INTERNAL_COMPLETED
```

### Reconciling

```typescript
// Called when both sides complete
await ledgerEntryResource.reconcile(
  ledgerEntry.id,
  'Auto-reconciled: Both Stripe payment and USDC mint completed successfully'
);
// Status: RECONCILED
```

### Marking for Manual Review

```typescript
// Called by reconciliation job when edge case detected
await ledgerEntryResource.markForManualReview(
  ledgerEntry.id,
  'External payment succeeded but internal mint failed after 3 retries. Requires manual intervention.'
);
// Status: REQUIRES_MANUAL_REVIEW
```

## Reconciliation Job (TODO)

A background job should run periodically to:

1. **Find Unreconciled Entries**:
   ```typescript
   const entries = await ledgerEntryResource.findUnreconciledEntries();
   ```

2. **Check Each Entry**:
   - If `PENDING` for > 10 minutes → check Stripe status
   - If `EXTERNAL_COMPLETED` for > 5 minutes → check if Circle transaction exists
   - If `INTERNAL_COMPLETED` → automatically reconcile

3. **Handle Edge Cases**:
   - If external succeeded but internal missing → `REQUIRES_MANUAL_REVIEW`
   - If both failed → `FAILED`
   - If timeout exceeded → `REQUIRES_MANUAL_REVIEW`

4. **Alert Support Team**:
   - Entries in `REQUIRES_MANUAL_REVIEW` state
   - Entries stuck in `PENDING` for > 30 minutes

## Webhook Integration (TODO)

### Stripe Webhooks

Handle these events:

- `payment_intent.succeeded` → Update external status
- `payment_intent.failed` → Mark as failed
- `charge.refunded` → Update reconciliation notes

```typescript
app.post('/webhooks/stripe', async (c) => {
  const event = await verifyStripeWebhook(c.req);

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const entry = await ledgerEntryResource.findByExternalTransactionId(
      paymentIntent.id
    );

    if (entry) {
      await ledgerEntryResource.updateExternalStatus(
        entry.id,
        paymentIntent.status
      );
    }
  }

  return c.json({ received: true });
});
```

### Circle Webhooks

Handle wallet transaction events to update internal status.

## Querying Ledger Entries

### By Agent

```typescript
const entries = await ledgerEntryResource.findByAgentId('agent-123');
```

### By External Transaction ID

```typescript
const entry = await ledgerEntryResource.findByExternalTransactionId('pi_abc123');
// Returns null if not found (useful for avoiding duplicates)
```

### Unreconciled Entries

```typescript
const unreconciled = await ledgerEntryResource.findUnreconciledEntries();
// Returns entries in PENDING, EXTERNAL_COMPLETED, or INTERNAL_COMPLETED status
```

### Manual Review Queue

```typescript
const needsReview = await ledgerEntryResource.findEntriesForManualReview();
// Returns entries in REQUIRES_MANUAL_REVIEW status
```

## Architecture Notes

### Why Ledger ≠ Balance Tracking

The ledger tracks external ↔ internal reconciliation, NOT internal balances:

- **Wallet balances** are calculated from the `transactions` table
- **Ledger entries** track Stripe ↔ Circle reconciliation
- **Internal transfers** (wallet → wallet) don't need ledger entries

### Example: Complete Deposit Flow

```typescript
async deposit(walletId: string, amount: Money, paymentMethodId: string) {
  // 1. Process Stripe payment
  const paymentResult = await paymentProvider.processDeposit(
    paymentMethodId,
    amount
  );

  // 2. Create ledger entry (tracks Stripe → Circle)
  const ledgerEntry = await ledgerEntryResource.createOnrampEntry({
    agentId: wallet.agentId,
    walletId: walletId,
    externalProvider: 'stripe',
    externalTransactionId: paymentResult.transactionId,
    externalAmount: amount.amount,
    externalCurrency: amount.currency,
    internalAmount: amount.amount,
    internalCurrency: 'USDC',
    description: `Deposit via Stripe for agent ${wallet.agentId}`
  });

  // 3. Update external status
  if (paymentResult.status === 'completed') {
    await ledgerEntryResource.updateExternalStatus(
      ledgerEntry.id,
      paymentResult.status
    );
  }

  // 4. Create internal transaction record
  const transaction = await transactionResource.create({
    type: 'MINT',
    toWalletId: walletId,
    amount: amount.amount,
    currency: 'USDC',
    status: 'COMPLETED',
    externalId: paymentResult.transactionId,
    metadata: { ledgerEntryId: ledgerEntry.id }
  });

  // 5. Update internal status
  await ledgerEntryResource.updateInternalStatus(
    ledgerEntry.id,
    transaction.id,
    'completed'
  );

  // 6. Reconcile
  await ledgerEntryResource.reconcile(
    ledgerEntry.id,
    'Auto-reconciled: Both Stripe payment and USDC mint completed successfully'
  );

  return transaction;
}
```

## Next Steps

1. **Implement Reconciliation Job**: Background process to auto-reconcile and detect edge cases
2. **Add Webhook Handlers**: Process Stripe and Circle webhooks to update ledger status
3. **Build Admin Dashboard**: View/manage entries in `REQUIRES_MANUAL_REVIEW`
4. **Add Alerts**: Notify support team of unreconciled entries
5. **Implement Offramp**: Apply same pattern to withdrawals (USDC → fiat)
6. **Add Retry Logic**: Automatically retry failed internal transactions
7. **Monitoring**: Track reconciliation success rate, time to reconcile, manual review rate

## File Locations

- Schema: `services/wallet/src/private/store/schema.ts`
- Resource: `services/wallet/src/private/resources/ledgerEntry.resource.ts`
- Model: `services/wallet/src/public/model/ledgerEntry.ts`
- Manager: `services/wallet/src/private/managers/wallet.manager.ts` (see `deposit()` method)
