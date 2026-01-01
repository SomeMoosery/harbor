CREATE TABLE IF NOT EXISTS "asks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"requirements" jsonb NOT NULL,
	"min_budget" real NOT NULL,
	"max_budget" real NOT NULL,
	"budget_flexibility_amount" real,
	"created_by" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL,
	"deleted_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"proposed_price" real NOT NULL,
	"estimated_duration" integer NOT NULL,
	"proposal" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL,
	"deleted_at" timestamptz
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_ask_id_asks_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."asks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
