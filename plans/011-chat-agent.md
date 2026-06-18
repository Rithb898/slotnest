# Plan 011: Chat — the conversational AI agent (`/chat`)

> **Executor instructions**: Read in full before starting. This plan is the
> product's main AI feature: a persistent, multi-turn chat where a non-technical
> user does email + calendar work in plain English. It is governed by
> [ADR 0001](../docs/adr/0001-chat-agent-is-read-only-app-owns-writes.md) and the
> **Chat** / **User voice** terms in `CONTEXT.md`. Honor the STOP conditions.
> Corsair work: read the matching file in `docs/corsair/` first. Do NOT run
> `build`/`dev` (repo rule). Do NOT use webhooks (repo rule).

## Status

- **Priority**: P0 (main AI feature)
- **Effort**: L
- **Risk**: MED (AI quality + write-safety + multi-turn state)
- **Depends on**: 004 (send), 005 (draft), 008 (Qdrant), 009 (proposal schema)
- **Category**: product / AI workflow
- **Planned at**: 2026-06-16
- **Status**: DONE

## Confirmed product direction (grill-with-docs, 2026-06-16)

A dedicated `/chat` page: the non-technical **front door** to the Agent. The user
types plain English; the Agent reads Gmail/Calendar, **shows its work inline**
(real email lists, proposed slots), drafts replies **in the user's voice**, and
ends every outbound action in an **approval card** — it proposes, the user
approves. It coexists with the ⌘K command bar (fast one-shot); both reach one
agent brain.

The promise: *"find Sam's emails" → see them → "reply to the second one about
Thursday" → read a draft that sounds like me → approve.*

## Architecture (pinned)

- **Surface**: `/chat` route + sidebar entry. ⌘K unchanged.
- **State**: conversation **persisted** in Postgres (Drizzle), tenant-scoped.
- **Message model**: a **typed union** rendered by the client —
  `text` · `email-list` card · `approval` card. The agent's read-tool results are
  stored as structured messages so later turns resolve references ("the 2nd one")
  by **stored Gmail IDs**, not re-parsed prose.
- **Write-safety (ADR 0001)**: the agent holds **only read tools**. It cannot
  send or book. Outbound actions are emitted as **structured proposals** →
  rendered as approval cards → executed on a human keypress through the existing
  deterministic mutations `gmail.sendReply` / `calendar.createEvent`. As a
  structural backstop, the agent's Corsair instance runs in **`readonly`**
  permission mode (`docs/corsair/concepts/permissions.md`).
- **User voice**: recipient-scoped exemplars retrieved from a **new
  `slotnest_sent` Qdrant collection** of the user's Sent mail, injected as style
  examples into the drafter.

## v1 verb set (the only scope)

1. **Search/find emails** → `email-list` card
2. **Summarize / show a thread**
3. **Draft + send a reply** (in user voice) → `approval` card → `gmail.sendReply`
4. **Find a free slot**
5. **Create an invite** → `approval` card → `calendar.createEvent`
6. **Follow-up detection** ("did they ever reply?")

Deferred (do NOT build in v1): archive/label/delete, batch actions, reschedule/
cancel existing events.

## What already exists (reuse — do not rebuild)

- `server/api/routers/agent.ts` — `agent.ask` one-shot, Agents SDK `run`/`tool`,
  Zod proposal schemas (`inviteProposalSchema` / `replyProposalSchema`), graceful
  degrade on missing `OPENAI_API_KEY`. **Reuse the proposal schemas verbatim.**
- `server/api/routers/gmail.ts` — `search` (537), `inbox` (587), `message` (672),
  `sendReply` (712, deterministic RFC 2822 threading), `draftReply` (775).
- `server/api/routers/calendar.ts` — `events` (148), `availability` (194),
  `createEvent` (299).
- `components/invite-dialog.tsx`, `components/reply-dialog.tsx` — approval dialogs
  already wired to the deterministic mutations. Approval cards open these.
- `lib/message-embeddings.ts` — Qdrant client, `createTextEmbedding`,
  `ensureMessageEmbeddingStore`, `upsert`/`searchMessageEmbeddings`. Mirror this
  for the sent collection.
- `scripts/backfill-message-embeddings.ts` — backfill pattern to copy.
- Schema patterns: `server/db/schema/draft.ts`, `daily-brief.ts` (keyed,
  tenant-scoped, `index.ts` re-exports).
- `components/command-bar.tsx` — existing proposal-card rendering to mirror.

## Build order

1. **Persistence schema** — `verify: drizzle-kit generate` clean
   - New `server/db/schema/chat.ts`: `chat_conversation` (id, userId→user.id
     cascade, title, createdAt/updatedAt) and `chat_message` (id, conversationId
     cascade, role `user|assistant`, `type` `text|email_list|approval`, `content`
     jsonb/text for the typed payload, createdAt). Follow the `draft.ts` style
     (keyed PK, `userId` FK, indexes).
   - Re-export from `server/db/schema/index.ts`.
   - `pnpm exec drizzle-kit generate`.

2. **Read-only agent tools** — `verify: focused tsc on new files`
   - New `server/api/agent/tools.ts`: curated `tool()` functions over existing
     server logic — `searchEmails`, `getThread`, `findFreeSlots`, `getEvents`,
     `findFollowUps`. Each is **read-only**, tenant-scoped, returns structured
     data (IDs included) suitable for an `email-list` card.
   - Build the agent's tenant Corsair instance in **`readonly`** mode (backstop).
   - NO write tool. Sends/books are NOT tools.

3. **Voice retrieval** — `verify: backfill inserts points; recipient query returns hits`
   - New `slotnest_sent` Qdrant collection (mirror `message-embeddings.ts`; new
     `lib/sent-embeddings.ts`).
   - New `scripts/backfill-sent-embeddings.ts`: list `labelIds:["SENT"]` via
     `corsair.gmail.api.messages.list` + `.get` raw, embed body, upsert with
     payload `{to, subject, snippet}`.
   - At draft time, retrieve top-k≈3 sent emails where recipient matches; inject
     as style examples into the reply drafter (extend `gmail.draftReply` or the
     chat reply-proposal path). Recipient-scoping can also use
     `gmail.db.messages.search({ from: <self>, to: contains <recipient> })`.

4. **Chat backend procedure** — `verify: focused tsc; manual send returns typed messages`
   - New `server/api/routers/chat.ts`, mounted in `server/api/root.ts`:
     - `conversations.list` / `messages.list(conversationId)` — load history.
     - `send({ conversationId?, prompt })` mutation: load prior messages → run
       Agents SDK agent with the read-only toolset + history →
       `outputType` returns `{ text, proposals[], emailRefs[] }` (extend the
       plan-009 union with an email-list payload) → persist user + assistant
       typed messages → return them.
   - Keep the `OPENAI_API_KEY`-absent graceful-degrade guard from `agent.ask`.
   - Agent instructions: read-only, propose-don't-send (carry over `agent.ts`
     STRICT RULES), reference resources by ID.

5. **`/chat` UI** — `verify: renders the three message types; "2nd one" resolves`
   - `app/(app)/chat/page.tsx` + `_components/chat-client.tsx`: scrollable thread,
     input box, streaming/pending state. Render by `type`:
     - `text` → bubble.
     - `email_list` → clickable rows (sender/subject/snippet), each carrying its
       Gmail ID (so a later turn's "the second one" resolves server-side).
     - `approval` → reuse `ReplyDialog` / `InviteDialog` behind Approve; Edit/Skip.
   - Add **Chat** to `components/app-sidebar.tsx` and the `GOTO` map in
     `components/command-bar.tsx` (`/chat`).

6. **Polish (only if 1–5 are solid)**
   - Conversation titles (cheap-model one-liner), per `daily-brief` caching style.
   - Empty-state suggestions ("Find emails that need a reply", "When am I free
     Thursday?").

## Model strategy (per plan 010)

- **Cheap** (`gpt-4.1-mini`, already used): routing, tool-loop reasoning,
  follow-up detection, conversation titles.
- **Bigger**: reply drafting in user voice (quality over cost). Keep the
  drafter swappable.
- **Deterministic (never AI)**: free-slot math, final Gmail/Calendar writes,
  sorting, counts.

## Success criteria

- A new connected user can, with no tutorial, type "find emails from <person>"
  and see a real, clickable list.
- "Reply to the second one" resolves to the correct message via stored IDs.
- The drafted reply visibly reflects the user's own past sent phrasing.
- Approving a reply/invite sends/books through the existing deterministic
  mutation — never the agent.
- Conversation survives a reload.
- The agent has no write tool and cannot send or book (verify by inspection +
  `readonly` backstop).

## STOP conditions

- Do NOT give the agent any write/send/book tool. Writes go only through approval
  cards → deterministic mutations (ADR 0001).
- Do NOT enforce write-safety by prompt alone — the read-only toolset + `readonly`
  Corsair mode are the structural guarantees.
- Do NOT render found emails as a prose paragraph — they must be a typed
  `email_list` card with real IDs.
- Do NOT invent a writing persona — voice comes only from real Sent mail; if the
  sent corpus is empty, draft without exemplars (do not fabricate).
- Do NOT expand beyond the 6-verb set.
- If Corsair Sent access or `readonly` mode behaves differently than
  `docs/corsair/` describes, STOP and have the user add/correct the doc rather
  than guessing.
