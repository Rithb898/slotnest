CREATE TABLE "daily_brief" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"signature" text NOT NULL,
	"model" text NOT NULL,
	"brief" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text,
	"body" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_brief" ADD CONSTRAINT "daily_brief_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_draft" ADD CONSTRAINT "reply_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_brief_user_date_idx" ON "daily_brief" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "reply_draft_user_message_idx" ON "reply_draft" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE INDEX "reply_draft_user_idx" ON "reply_draft" USING btree ("user_id");