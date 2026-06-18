CREATE TABLE "approval_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"thread_id" text,
	"message_id" text,
	"state" text NOT NULL,
	"source_internal_date" timestamp,
	"snoozed_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_state" ADD CONSTRAINT "approval_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_state_user_target_idx" ON "approval_state" USING btree ("user_id","target_kind","target_id");--> statement-breakpoint
CREATE INDEX "approval_state_user_thread_idx" ON "approval_state" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE INDEX "approval_state_user_state_idx" ON "approval_state" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "approval_state_user_snoozed_until_idx" ON "approval_state" USING btree ("user_id","snoozed_until");
