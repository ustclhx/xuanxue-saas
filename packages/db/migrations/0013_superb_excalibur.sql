CREATE TABLE "reading" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"locale" text NOT NULL,
	"engine_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model_key" text NOT NULL,
	"credits" integer NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_credits_nonnegative" CHECK ("reading"."credits" >= 0),
	CONSTRAINT "reading_status_valid" CHECK ("reading"."status" in ('generating', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN "source_tool" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN "site" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN "last_result" jsonb;--> statement-breakpoint
ALTER TABLE "reading" ADD CONSTRAINT "reading_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading" ADD CONSTRAINT "reading_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading" ADD CONSTRAINT "reading_message_id_ai_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_message"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_workspace_id_id_idx" ON "reading" USING btree ("workspace_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reading_workspace_user_kind_hash_idx" ON "reading" USING btree ("workspace_id","user_id","kind","input_hash","created_at" DESC NULLS LAST);