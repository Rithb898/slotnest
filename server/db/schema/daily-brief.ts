import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Cache of the AI daily-brief paragraph, one row per (user, day). Unlike a reply
 * draft, the brief's input changes through the day, so a row also stores a
 * `signature` — a hash of the *reduced* input (the fields whose change should
 * justify a new paragraph: needsReply / waiting / events / best slot / top
 * subject). The brief is reused while the signature and model match; it
 * regenerates when the day's shape meaningfully changes or it's a new day.
 *
 * Highlights are deterministic and recomputed per request — never stored here.
 */
export const dailyBrief = pgTable(
  "daily_brief",
  {
    // `${userId}:${date}` — one brief per user per calendar day.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "YYYY-MM-DD" in the user's local day.
    date: text("date").notNull(),
    signature: text("signature").notNull(),
    model: text("model").notNull(),
    brief: text("brief").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("daily_brief_user_date_idx").on(t.userId, t.date)],
);
