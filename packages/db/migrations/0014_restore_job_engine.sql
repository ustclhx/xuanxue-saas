-- rollback-safe: 只新建 job_engine schema 与表，旧代码不读写它们
-- 恢复 2026-10-19 删除的模板迁移 0013–0015（语句集合一致），供模板 0.2.0 的事件死信与 0016 授权使用
-- squawk-ignore-file prefer-bigint-over-int, prefer-identity -- reason: 列类型须与模板 job_engine schema 及 drizzle 定义一致，改类型会产生 schema 差异；均为新建空表
SET lock_timeout = '5s';--> statement-breakpoint
SET statement_timeout = '15min';--> statement-breakpoint
CREATE SCHEMA "job_engine";
--> statement-breakpoint
CREATE TABLE "job_engine"."batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"state" text DEFAULT 'claimed' NOT NULL,
	"size" integer NOT NULL,
	"executor_id" text,
	"executor_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_engine"."dead_letter" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"attempts" integer NOT NULL,
	"code" text NOT NULL,
	"retryable" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_engine"."message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"body" jsonb NOT NULL,
	"request_id" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"batch_id" uuid,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_engine"."queue" (
	"name" text PRIMARY KEY NOT NULL,
	"policy" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_engine"."schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"cron" text NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"missed_run" text DEFAULT 'skip' NOT NULL,
	"next_scheduled_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_engine"."schedule_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'claimed' NOT NULL,
	"executor_id" text,
	"executor_token" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text
);
--> statement-breakpoint
CREATE TABLE "job_engine"."start" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"message_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_engine"."workflow_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sequence" bigserial NOT NULL,
	"workflow_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_engine"."workflow_wait" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "job_engine"."batch" ADD CONSTRAINT "batch_queue_queue_name_fk" FOREIGN KEY ("queue") REFERENCES "job_engine"."queue"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_engine"."dead_letter" ADD CONSTRAINT "dead_letter_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "job_engine"."message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_engine"."message" ADD CONSTRAINT "message_queue_queue_name_fk" FOREIGN KEY ("queue") REFERENCES "job_engine"."queue"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_engine"."message" ADD CONSTRAINT "message_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "job_engine"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_engine"."schedule_run" ADD CONSTRAINT "schedule_run_schedule_id_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "job_engine"."schedule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_engine"."start" ADD CONSTRAINT "start_queue_queue_name_fk" FOREIGN KEY ("queue") REFERENCES "job_engine"."queue"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_message_ready_idx" ON "job_engine"."message" USING btree ("queue","state","available_at");--> statement-breakpoint
CREATE INDEX "job_message_batch_idx" ON "job_engine"."message" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_run_slot_idx" ON "job_engine"."schedule_run" USING btree ("schedule_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_run_active_idx" ON "job_engine"."schedule_run" USING btree ("schedule_id") WHERE "job_engine"."schedule_run"."state" IN ('claimed', 'running');--> statement-breakpoint
CREATE INDEX "job_start_window_idx" ON "job_engine"."start" USING btree ("queue","started_at");--> statement-breakpoint
CREATE INDEX "workflow_event_fifo_idx" ON "job_engine"."workflow_event" USING btree ("workflow_id","type","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_wait_name_idx" ON "job_engine"."workflow_wait" USING btree ("workflow_id","name");