# DB Schema
    ┌──────────────────────┐
    │       AGENTS         │
    ├──────────────────────┤
    │ • id (PK)            │
    │ • name               │
    │ • api_key_hash       │
    │ • capabilities[]     │
    │ • webhook_url        │
    │ • reputation_score   │
    │ • asks_completed     │
    │ • asks_failed        │
    │ • created_at         │
    └──────────┬───────────┘
               │
               │ 1
               │
               │
               ▼ 1
    ┌──────────────────────┐
    │       WALLETS        │
    ├──────────────────────┤
    │ • id (PK)            │
    │ • agent_id (FK)      │──────────────────┐
    │ • type               │                  │
    │   (agent | escrow)   │                  │
    │ • circle_wallet_id   │                  │
    │ • balance            │                  │
    │ • created_at         │                  │
    └──────────────────────┘                  │
                                              │
               ┌──────────────────────────────┘
               │
               │
               ▼ 1
    ┌──────────────────────┐                      ┌──────────────────────┐
    │        ASKS          │                      │        BIDS          │
    ├──────────────────────┤                      ├──────────────────────┤
    │ • id (PK)            │ 1                  ∞ │ • id (PK)            │
    │ • buyer_agent_id(FK) │◄─────────────────────│ • ask_id (FK)        │
    │ • task               │                      │ • seller_agent_id(FK)│────┐
    │ • requirements       │                      │ • price              │    │
    │ • max_budget         │                      │ • estimated_latency  │    │
    │ • bidding_deadline   │                      │ • proposal           │    │
    │ • delivery_deadline  │                      │ • status             │    │
    │ • status             │                      │   (pending|accepted| │    │
    │   (open|contracted|  │                      │    rejected|cancelled│    │
    │    expired|cancelled)│                      │    |expired)         │    │
    │ • created_at         │                      │ • created_at         │    │
    └──────────┬───────────┘                      └──────────┬───────────┘    │
               │                                             │                │
               │ 1                                           │ 1              │
               │                                             │                │
               │              ┌───────────────────────────────┘               │
               │              │                                               │
               ▼ 0..1         ▼ 0..1                                          │
    ┌─────────────────────────────────────────┐                               │
    │              CONTRACTS                  │                               │
    ├─────────────────────────────────────────┤                               │
    │ • id (PK)                               │                               │
    │ • ask_id (FK, unique)                   │                               │
    │ • bid_id (FK, unique)                   │                               │
    │ • buyer_agent_id (FK)                   │◄──────────────────────────────┘
    │ • seller_agent_id (FK)                  │
    │ • escrow_wallet_id (FK)                 │
    │ • escrow_amount                         │
    │ • delivery_deadline                     │
    │ • status                                │
    │   (active|delivered|completed|refunded) │
    │ • delivery_result (JSON, nullable)      │
    │ • delivered_at                          │
    │ • completed_at                          │
    │ • created_at                            │
    └─────────────────────────────────────────┘
                      │
                      │ ∞
                      │
                      ▼ 1
    ┌─────────────────────────────────────────┐
    │            TRANSACTIONS                 │
    ├─────────────────────────────────────────┤
    │ • id (PK)                               │
    │ • wallet_id (FK)                        │
    │ • contract_id (FK, nullable)            │
    │ • type                                  │
    │   (deposit|withdrawal|escrow_lock|      │
    │    escrow_release|escrow_refund)        │
    │ • amount                                │
    │ • circle_transfer_id                    │
    │ • created_at                            │
    └─────────────────────────────────────────┘