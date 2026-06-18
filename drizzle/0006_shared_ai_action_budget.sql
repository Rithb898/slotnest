CREATE TABLE "ai_action_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action_kind" text NOT NULL,
	"period_key" text NOT NULL,
	"source" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_action_budget" ADD CONSTRAINT "ai_action_budget_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ai_action_budget_user_idx" ON "ai_action_budget" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_action_budget_period_idx" ON "ai_action_budget" USING btree ("user_id","period_key");
