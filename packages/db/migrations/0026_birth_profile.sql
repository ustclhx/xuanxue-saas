-- rollback-safe: 只新增表与索引，旧代码不读写它
SET lock_timeout = '5s';--> statement-breakpoint
SET statement_timeout = '30s';--> statement-breakpoint
CREATE TABLE "birth_profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"relation" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"birth" jsonb NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "birth_profile_relation_valid" CHECK ("birth_profile"."relation" in ('self', 'partner', 'family', 'friend', 'other')),
	CONSTRAINT "birth_profile_label_length" CHECK (char_length("birth_profile"."label") <= 40),
	CONSTRAINT "birth_profile_full_name_length" CHECK (char_length("birth_profile"."full_name") <= 120)
);
--> statement-breakpoint
ALTER TABLE "birth_profile" ADD CONSTRAINT "birth_profile_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_profile" ADD CONSTRAINT "birth_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "birth_profile_workspace_user_updated_idx" ON "birth_profile" USING btree ("workspace_id","user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "birth_profile_user_default_uq" ON "birth_profile" USING btree ("user_id") WHERE "birth_profile"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "birth_profile_user_self_uq" ON "birth_profile" USING btree ("user_id") WHERE "birth_profile"."relation" = 'self';