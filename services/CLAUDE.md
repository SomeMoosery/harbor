# Architecture

┌─────────────────────────────────────────────────────────────────┐
│                          GATEWAY                                │
│                    (REST + WebSocket)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN SERVICES                            │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│     User     │    Wallet    │  Tendering   │    Settlement      │
│              │              │              │                    │
│ • Users      │ • Balances   │ • Asks       │ • Escrow lock      │
│ • Agents     │ • Deposits   │ • Bids       │ • Escrow release   │
│ • API keys   │ • Withdrawals│ • Contracts  │ • Refunds          │
│ • Permissions│              │ • Delivery   │                    │
└──────────────┴──────────────┴──────────────┴────────────────────┘