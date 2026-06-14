import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Cache of AI-drafted reply bodies, one per (user, Gmail message). A Gmail
 * message is immutable, so the draft only needs regenerating when the prompt or
 * model changes (tracked via `model`) or the user forces it. Keying on
 * messageId means the model is hit once per message — never per reload.
 *
 * `status`:
 *  - generated: fresh AI draft, safe to overwrite on regenerate
 *  - edited:    user changed the body; do NOT overwrite on regenerate
 *  - sent:      the reply was approved and sent
 */
export const replyDraft = pgTable(
  "reply_draft",
  {
    // `${userId}:${messageId}` — stable, deterministic primary key.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    threadId: text("thread_id"),
    body: text("body").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("generated"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("reply_draft_user_message_idx").on(t.userId, t.messageId),
    index("reply_draft_user_idx").on(t.userId),
  ],
);
