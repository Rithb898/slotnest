import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const approvalState = pgTable(
  "approval_state",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    threadId: text("thread_id"),
    messageId: text("message_id"),
    state: text("state").notNull(),
    sourceInternalDate: timestamp("source_internal_date"),
    snoozedUntil: timestamp("snoozed_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("approval_state_user_target_idx").on(
      t.userId,
      t.targetKind,
      t.targetId,
    ),
    index("approval_state_user_thread_idx").on(t.userId, t.threadId),
    index("approval_state_user_state_idx").on(t.userId, t.state),
    index("approval_state_user_snoozed_until_idx").on(t.userId, t.snoozedUntil),
  ],
);
