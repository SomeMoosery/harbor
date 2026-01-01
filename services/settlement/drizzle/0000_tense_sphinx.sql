CREATE TABLE IF NOT EXISTS "escrow_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" text NOT NULL,
	"bid_id" text NOT NULL,
	"buyer_wallet_id" text NOT NULL,
	"buyer_agent_id" text NOT NULL,
	"total_amount" real NOT NULL,
	"base_amount" real NOT NULL,
	"buyer_fee" real NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"status" text DEFAULT 'LOCKED' NOT NULL,
	"lock_transaction_id" text,
	"metadata" jsonb,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_lock_id" uuid NOT NULL,
	"seller_wallet_id" text NOT NULL,
	"seller_agent_id" text NOT NULL,
	"payout_amount" real NOT NULL,
	"seller_fee" real NOT NULL,
	"platform_revenue" real NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"release_transaction_id" text,
	"fee_transaction_id" text,
	"metadata" jsonb,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settlements" ADD CONSTRAINT "settlements_escrow_lock_id_escrow_locks_id_fk" FOREIGN KEY ("escrow_lock_id") REFERENCES "public"."escrow_locks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
