CREATE TABLE "message_triage" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"urgency" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_triage" ADD CONSTRAINT "message_triage_entity_id_corsair_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."corsair_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_triage_action_urgency_idx" ON "message_triage" USING btree ("action","urgency");