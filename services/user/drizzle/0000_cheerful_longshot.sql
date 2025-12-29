CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL,
	"deleted_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text,
	"last_used_at" timestamptz,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"deleted_at" timestamptz,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamptz DEFAULT NOW() NOT NULL,
	"updated_at" timestamptz DEFAULT NOW() NOT NULL,
	"deleted_at" timestamptz,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
