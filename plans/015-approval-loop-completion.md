# Plan 015: Approval-loop completion for the better Gmail client

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7492b79..HEAD -- CONTEXT.md docs/adr server/api/routers/gmail.ts server/api/root.ts server/db/schema app/(app)/inbox app/(app)/today app/(app)/drafts app/(app)/waiting components/command-bar.tsx components/reply-dialog.tsx lib/workspace.ts lib/reply.ts docs/corsair/plugins/gmail/api.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 004, 005, 008, 010, 011
- **Category**: product / Gmail workflow
- **Planned at**: commit `7492b79`, 2026-06-18

## Why this matters

SlotNest already has the valuable AI primitives: prioritized Gmail reads,
drafted replies, approval dialogs, sent-mail visibility, command-bar search, and
Waiting/Drafts/Today surfaces. The remaining gap is not "clone Gmail"; it is
that the approval loop is incomplete. Users can approve/send in some places, but
they cannot reliably clear, snooze, resolve, archive, compose, or open search
results into the exact conversation.

This plan completes the better-Gmail-client loop while preserving the product
language in `CONTEXT.md`: **Approve, don't read**, **Approval loop**,
**Archive**, **Done**, **Approval state**, **Approval target**,
**Approval wake-up**, **Compose**, **Search result selection**, and
**Thread view**.

## Resolved product decisions

- This slice is **approval-control completion**, not Gmail parity.
- **Archive** is a real Gmail mutation. It archives the Gmail thread when
  `threadId` exists and falls back to a single message only when no thread
  exists.
- **Done**, **Skip**, **Snooze**, and **Resolved** are SlotNest approval-state
  decisions. They do not create Gmail labels and do not mutate Gmail.
- Approval state lives in SlotNest DB. Gmail labels are intentionally not used
  for SlotNest workflow state. See `docs/adr/0002-slotnest-owns-approval-state.md`.
- Draft replies stay message-level. Visibility decisions apply to the thread
  when a thread exists.
- Snooze wakes by time. Done/Skipped/Resolved wake only when there is newer
  inbound activity in the same thread.
- Compose v1 is a simple reviewed send flow through the existing Gmail send
  mutation. It is not Gmail draft management.
- Search result selection opens the thread when possible, with message fallback.
- Thread view v1 is read-only conversation context with existing actions. No AI
  summary and no Gmail conversation parity in this slice.
- Read/unread is explicitly deferred.

## Current state

- `CONTEXT.md` now defines the domain boundary for this plan:
  ```md
  - **Approval loop** — The complete decision cycle for prepared work...
  - **Archive** — A real Gmail action that removes a thread...
  - **Done** — A SlotNest approval-loop decision...
  - **Approval state** — SlotNest's record of the User's decision...
  - **Approval target** — The email object an approval-loop decision applies to...
  - **Approval wake-up** — The condition that returns hidden prepared work...
  - **Compose** — A User-started outbound email...
  - **Search result selection** — Opening the conversation behind a mail search result...
  - **Thread view** — A read-only conversation context...
  ```
- `docs/adr/0001-chat-agent-is-read-only-app-owns-writes.md` already says the
  Agent proposes and the app owns writes. Do not give the Agent direct write
  tools in this plan.
- `server/api/routers/gmail.ts` already has:
  - `gmail.search` returning `id`, `threadId`, sender, subject, snippet, date,
    score, and match mode.
  - `gmail.inbox` returning message rows with `threadId`, `messageIdHeader`,
    `references`, `replyStatus`, `replyBody`, and `triage`.
  - `gmail.message` returning one decoded message body.
  - `gmail.sent` as a read-only sent-mail list.
  - `gmail.sendEmail` for new outbound email.
  - `gmail.sendReply` for threaded replies.
  - `gmail.draftReply` for SlotNest-owned AI draft bodies.
- `app/(app)/inbox/_components/inbox-client.tsx` currently has a disabled
  Archive action and comments saying archive/compose are placeholders.
- `components/command-bar.tsx` currently routes Compose to `/inbox` instead of
  opening a composer, and mail search results route to `/inbox` without
  selecting the result.
- `app/(app)/today/_components/today-client.tsx`,
  `app/(app)/drafts/_components/drafts-client.tsx`, and
  `app/(app)/waiting/_components/waiting-client.tsx` use component-local state
  for skipped/snoozed/resolved decisions.
- `server/db/schema/draft.ts` stores reply draft bodies and `sent` status by
  Gmail message id. Do not overload it with all approval state; add a separate
  approval-state table.

## Documented API seams

Read these docs before editing any Corsair-related code:

- `docs/corsair/plugins/gmail/api.md`
- `docs/corsair/plugins/gmail/database.md`
- `docs/corsair/concepts/api.md`
- `docs/corsair/concepts/error-handling.md`

The specific Gmail APIs this plan relies on are documented:

- `gmail.api.threads.modify({ id, removeLabelIds: ["INBOX"] })` archives a
  thread by removing the inbox label.
- `gmail.api.messages.modify({ id, removeLabelIds: ["INBOX"] })` is the
  message-level fallback when no thread exists.
- `gmail.api.threads.get({ id, format: "full" })` loads the read-only thread
  context.

If any of those docs are missing, contradict the above, or do not match the
installed SDK types, stop and report the mismatch. Do not guess the Corsair API.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| DB migration generation | `pnpm exec drizzle-kit generate` | creates one migration for the approval-state table |
| Focused formatter/lint | `pnpm exec biome check --write server/api/routers/gmail.ts server/db/schema/approval-state.ts server/db/schema/index.ts app/(app)/inbox/_components/inbox-client.tsx app/(app)/today/_components/today-client.tsx app/(app)/drafts/_components/drafts-client.tsx app/(app)/waiting/_components/waiting-client.tsx components/command-bar.tsx components/reply-dialog.tsx lib/workspace.ts` | exit 0 |
| Focused test | `pnpm exec tsx lib/approval-state.test.ts` | exit 0, assertions pass |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, or only known unrelated baseline errors clearly reported |

Do **not** run `dev` or `build` commands.

## Suggested executor toolkit

- Before touching app-route files, read the relevant Next.js guide in
  `node_modules/next/dist/docs/` per `AGENTS.md`.
- Use the existing `ReplyDialog` for both reply and Compose if it can stay clear;
  otherwise rename it to a shared composer only if the rename remains surgical.
- Keep write mutations deterministic and tenant-scoped through
  `corsair.withTenant(ctx.session.user.id)`.
- Prefer one shared approval-state helper in `lib/workspace.ts` or a small new
  helper over duplicating wake-up filtering across Today, Drafts, and Waiting.
- Keep full-repo baseline noise separate from touched-slice verification.

## Scope

**In scope**:
- Add SlotNest-owned approval-state persistence.
- Add Gmail thread archive and message fallback.
- Add minimal Compose from Command Bar.
- Make Today/Drafts/Waiting use persisted approval state.
- Add read-only thread query and Inbox thread/message selection from URL.
- Make command-bar mail search open the exact thread/message.
- Update comments/docs in touched files that currently describe placeholders.

**Out of scope**:
- Gmail labels for SlotNest workflow state.
- Gmail draft creation/sending via `gmail.api.drafts.*`.
- Read/unread mutations or auto-mark-read behavior.
- Full Gmail label/filter/folder management.
- Webhook provider setup or webhook-dependent freshness.
- AI thread summaries.
- Multiple Gmail accounts per User.
- Any Agent direct-write tool.

## Data model

Create `server/db/schema/approval-state.ts` and export it from
`server/db/schema/index.ts`.

Suggested table: `approval_state`

Fields:
- `id`: deterministic primary key, `${userId}:${targetKind}:${targetId}`
- `userId`: references `user.id`, cascade delete
- `targetKind`: text enum-by-convention: `thread` | `message`
- `targetId`: Gmail thread id or Gmail message id
- `threadId`: nullable Gmail thread id for query convenience
- `messageId`: nullable source Gmail message id
- `state`: text enum-by-convention: `done` | `skipped` | `snoozed` | `resolved`
- `sourceInternalDate`: nullable timestamp or text date representing the newest
  inbound activity when the state was set
- `snoozedUntil`: nullable timestamp
- `createdAt`, `updatedAt`

Indexes:
- `(userId, targetKind, targetId)` unique
- `(userId, threadId)`
- `(userId, state)`
- `(userId, snoozedUntil)`

Do not store draft body here. `reply_draft` remains the cache of AI-generated
reply bodies and sent status.

## API design

Add these procedures to `server/api/routers/gmail.ts` unless the file becomes
too large; if it does, create `server/api/routers/mail-workflow.ts` and wire it
in `server/api/root.ts`.

### `gmail.thread`

Input:
- `threadId: string`
- optional `forceFresh?: boolean`

Behavior:
- Load `tenant.gmail.api.threads.get({ id: threadId, format: "full" })`.
- Normalize each thread message with the existing Gmail normalization helpers.
- Sort messages by date ascending.
- Return thread id, snippet, and messages with the same fields needed by
  `MessageView`: id, threadId, from, to, subject, date, snippet, labels,
  message-id headers, html/text body.
- Include triage for the latest inbound message if cheap to reuse; otherwise do
  not block thread view on triage.

### `gmail.archive`

Input:
- `messageId: string`
- `threadId?: string | null`

Behavior:
- If `threadId` exists, call
  `tenant.gmail.api.threads.modify({ id: threadId, removeLabelIds: ["INBOX"] })`.
- Otherwise call
  `tenant.gmail.api.messages.modify({ id: messageId, removeLabelIds: ["INBOX"] })`.
- Also upsert SlotNest approval state as `done` for the same approval target so
  local no-webhook reads hide it immediately.
- Invalidate `gmail.inbox`, `gmail.message`, `gmail.thread`, `workspace.dailyBrief`
  callers on success.

### `gmail.setApprovalState`

Input:
- `messageId: string`
- `threadId?: string | null`
- `state: "done" | "skipped" | "snoozed" | "resolved"`
- `snoozedUntil?: string`
- `sourceInternalDate?: string | null`

Behavior:
- Target thread when `threadId` exists, otherwise message.
- Validate `snoozedUntil` is present and in the future when `state === "snoozed"`.
- Upsert approval state.
- Do not mutate Gmail.

### Inbox read filtering

Update `gmail.inbox` so returned messages include approval state and so default
views filter hidden work:

- Hide `done`, `skipped`, and `resolved` state if there is no newer inbound
  thread activity than `sourceInternalDate`.
- Hide `snoozed` state until `snoozedUntil` is in the past.
- Wake `snoozed` items after time passes.
- Wake `done`/`skipped`/`resolved` only when newer inbound activity appears in
  the same thread.

Keep a simple `includeHidden?: boolean` option only if it is needed for Inbox
debugging. Do not add a visible hidden-items page in this plan.

## UI design

### Inbox

Update `app/(app)/inbox/_components/inbox-client.tsx`:

- Read `message` and `thread` from URL search params.
- If `thread` exists, load `gmail.thread` and render read-only thread view.
- If `message` exists without `thread`, select/open that message.
- Replace disabled Archive with a live Archive button.
- Keep Draft reply and Email→invite actions.
- Add a small Compose affordance only if Command Bar Compose needs a local host;
  otherwise keep Compose in Command Bar.
- Remove placeholder comments that say archive/compose are not wired.

Thread view v1:
- Show messages in chronological order.
- Collapse only if easy; full visible messages are acceptable for v1.
- Reuse the existing email body iframe/plain-text fallback.
- Actions should operate on the latest selected/latest inbound message where a
  message id is required.

### Command Bar

Update `components/command-bar.tsx`:

- `Compose` opens the shared composer with empty `to`, `subject`, and `body`.
- Agent reply proposals continue to open the same approval dialog.
- Mail search result selection routes to `/inbox?thread=<threadId>&message=<id>`
  when `threadId` exists, else `/inbox?message=<id>`.
- Do not add a dedicated search page.

### Today

Update `app/(app)/today/_components/today-client.tsx`:

- Replace component-local `skipped`/`snoozed`/`resolved` visibility decisions
  with `gmail.setApprovalState`.
- On approve/send, keep the existing `reply_draft.status = "sent"` behavior and
  also ensure the approval target leaves the queue.
- `Snooze` should persist a concrete time. Use a simple default such as tomorrow
  morning unless the existing UI already has a picker.
- `Skip` and `Resolved` persist as approval state.

### Drafts

Update `app/(app)/drafts/_components/drafts-client.tsx`:

- Replace local `hidden` with persisted `skipped` or `done`, depending on the UI
  copy.
- After a reply/invite is sent, persist `done` or rely on the sent status if it
  already removes the row. Make the behavior explicit and deterministic.
- Keep AI draft generation approval-gated.

### Waiting

Update `app/(app)/waiting/_components/waiting-client.tsx`:

- Replace local `resolved`/`snoozed` state with `gmail.setApprovalState`.
- After follow-up send, persist `resolved` for the target so it disappears after
  refresh.

### Shared composer

Keep a single review-before-send dialog:

- `To` editable.
- `Subject` editable for new Compose; keep reply subject readonly only if that
  is already deliberate and still appropriate.
- `Body` editable.
- For thread replies, use `gmail.sendReply`.
- For new Compose, use `gmail.sendEmail`.
- Nothing sends without the User clicking the final send button.

## Steps

### Step 1: Add approval-state schema and helpers

Create `server/db/schema/approval-state.ts`, export it, and generate a Drizzle
migration. Add a focused `lib/approval-state.test.ts` for pure wake-up/filtering
helpers if the helper logic can be kept framework-independent.

**Verify**:
- `pnpm exec drizzle-kit generate`
- `pnpm exec tsx lib/approval-state.test.ts`

### Step 2: Add server procedures

Implement `gmail.thread`, `gmail.archive`, and `gmail.setApprovalState` with
tenant scoping and documented Corsair APIs. Reuse normalization helpers from
`server/api/routers/gmail.ts`; do not duplicate body/header parsing.

**Verify**:
- focused Biome on `server/api/routers/gmail.ts` and new schema/helper files
- `pnpm exec tsc --noEmit`

### Step 3: Apply approval-state filtering to Gmail reads

Update `gmail.inbox` to join/load approval state for returned messages and hide
items according to **Approval wake-up**. Return enough state for UI badges only
if useful; avoid exposing implementation details.

**Verify**:
- `pnpm exec tsx lib/approval-state.test.ts`
- focused Biome on touched files

### Step 4: Wire Inbox archive, thread view, and URL selection

Update Inbox so Archive is live, search/open URLs select the right conversation,
and read-only thread view works.

**Verify**:
- focused Biome on Inbox and Gmail router
- `pnpm exec tsc --noEmit`

### Step 5: Wire Compose in Command Bar

Open a real composer from Command Bar instead of routing to Inbox. Reuse the
existing send mutation and approval dialog.

**Verify**:
- focused Biome on `components/command-bar.tsx` and composer/dialog file

### Step 6: Persist Today/Drafts/Waiting decisions

Replace local state for skip/snooze/resolve/done with the new mutation and
invalidate affected tRPC queries after success.

**Verify**:
- focused Biome on Today, Drafts, Waiting, workspace helper
- `pnpm exec tsc --noEmit`

### Step 7: Update comments and plan status

Remove stale placeholder comments in touched files and update
`plans/README.md` status for this plan after implementation.

**Verify**:
- `git diff --check`
- final focused Biome command from the table above

## STOP conditions

Stop and report if any of these occur:

- Corsair docs do not support `threads.modify`, `messages.modify`, or
  `threads.get` as described.
- Next.js docs under `node_modules/next/dist/docs/` contradict the routing/search
  params approach needed for Inbox.
- Implementing approval state requires Gmail labels.
- You need webhooks to make the feature function.
- The Agent would need direct write permissions.
- You need to run `dev` or `build`.
- The schema change starts overlapping with `reply_draft` in a way that would
  make draft body and approval visibility the same concept.
- Read/unread, Gmail drafts, labels, filters, or full Gmail conversation parity
  start entering the implementation.

## Acceptance criteria

- A user can archive from Inbox and the thread leaves the app immediately.
- A user can compose and send a new email from Command Bar with explicit review.
- A user can skip, snooze, resolve, or mark prepared work done and that decision
  survives refresh.
- Snoozed work returns after its snooze time.
- Done/skipped/resolved work returns only when newer inbound activity appears in
  that thread.
- Command-bar mail search opens the exact thread/message.
- Inbox can show a read-only thread view.
- No Gmail labels are created for SlotNest approval state.
- No read/unread or Gmail draft management is added.
