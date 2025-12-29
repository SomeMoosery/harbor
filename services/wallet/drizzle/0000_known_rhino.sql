CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"external_provider" text,
	"external_transaction_id" text,
	"external_amount" real,
	"external_currency" text,
	"external_status" text,
	"external_completed_at" timestamptz,
	"internal_transaction_id" uuid,
	"internal_amount" real NOT NULL,
	"internal_currency" text DEFAULT 'USDC' NOT NULL,
	"internal_status" text,
	"internal_completed_at" timestamptz,
	"reconciled_at" timestamptz,
	"reconciliation_notes" text,
	"platform_fee" real DEFAULT 0,
	"external_provider_fee" real DEFAULT 0,
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"from_wallet_id" uuid,
	"to_wallet_id" uuid,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"circle_wallet_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL,
	"deleted_at" timestamptz,
	CONSTRAINT "wallets_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_internal_transaction_id_transactions_id_fk" FOREIGN KEY ("internal_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_wallet_id_wallets_id_fk" FOREIGN KEY ("from_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_wallet_id_wallets_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
