ALTER TABLE "user" ADD COLUMN "razorpay_customer_id" text;--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"razorpay_customer_id" text,
	"razorpay_subscription_id" text,
	"razorpay_plan_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"current_start" timestamp,
	"current_end" timestamp,
	"ended_at" timestamp,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_count" integer,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"remaining_count" integer,
	"cancelled_at" timestamp,
	"paused_at" timestamp,
	"short_url" text,
	"cancel_at_cycle_end" boolean DEFAULT false NOT NULL,
	"billing_period" text,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"metadata" text,
	"renewed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_razorpay_subscription_id_idx" ON "subscription" USING btree ("razorpay_subscription_id");
