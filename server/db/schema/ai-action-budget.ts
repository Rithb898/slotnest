import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Ledger of fresh AI model calls. One row per reservation so support can tell
 * what was charged, when, and by which app surface.
 */
export const aiActionBudget = pgTable(
  "ai_action_budget",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actionKind: text("action_kind").notNull(),
    periodKey: text("period_key").notNull(),
    source: text("source").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_action_budget_user_idx").on(table.userId),
    index("ai_action_budget_period_idx").on(table.userId, table.periodKey),
  ],
);
