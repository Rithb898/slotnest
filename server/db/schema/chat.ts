import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Persistent Chat (plan 011). A conversation is a tenant-scoped thread of typed
 * messages. Messages are a typed union rendered by the client:
 *  - `text`        → a plain bubble.
 *  - `email_list`  → a card of real Gmail results (each row carries its Gmail
 *                    ID, so a later turn's "the second one" resolves by ID, not
 *                    re-parsed prose).
 *  - `approval`    → a proposed outbound action (reply/invite). The agent only
 *                    proposes; the actual send/book runs through the existing
 *                    deterministic mutations on a human keypress (ADR 0001).
 *
 * `content` is the typed payload for the row's `type` (see `ChatMessageContent`
 * in `server/api/routers/chat.ts`). Follows the `draft.ts` / `daily-brief.ts`
 * style: keyed PK, `userId` FK with cascade, tenant indexes.
 */
export const chatConversation = pgTable(
  "chat_conversation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("chat_conversation_user_idx").on(t.userId)],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => chatConversation.id, { onDelete: "cascade" }),
    // "user" | "assistant"
    role: text("role").notNull(),
    // "text" | "email_list" | "approval"
    type: text("type").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("chat_message_conversation_idx").on(t.conversationId)],
);
