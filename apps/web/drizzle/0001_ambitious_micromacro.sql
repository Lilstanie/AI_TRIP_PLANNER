ALTER TABLE "conversations" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;