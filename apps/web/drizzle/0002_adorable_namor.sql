CREATE TABLE "account_memories" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"previous_value" text,
	"undo_token" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_memories_user_id_key_pk" PRIMARY KEY("user_id","key")
);
