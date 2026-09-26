CREATE TABLE "conversations" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"record" jsonb,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "conversations_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"record" jsonb,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "trips_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversations_user_updated" ON "conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "trips_user_updated" ON "trips" USING btree ("user_id","updated_at");