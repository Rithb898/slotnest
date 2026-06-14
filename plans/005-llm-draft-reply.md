# Plan 005: LLM Draft reply — the real "Draft reply" (on-demand)

> **Executor instructions**: Read in full before starting. This layers the
> AI-generated draft onto the working send path from plan 004. It does **not**
> change how a reply is sent — it only fills the `body` field the user then edits
> and approves. Update this plan's row in `plans/README.md` when done.

## Status

- **Priority**: P1 (the signature "Draft reply"; loop works without it via manual typing)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 004 (reply send path + `ReplyDialog`)
- **Category**: signature feature
- **Planned at**: 2026-06-14

## Decision provenance (grill session 2026-06-14)

- **Q3**: draft is the *second* slice — send plumbing ships first (004).
- **Q8 — trigger**: **on-demand** ("Draft with AI" button in the reply dialog),
  **not** eager generation on every inbox load. No local cache exists yet, so
  per-list LLM calls would be slow and costly.
- **Q9 — tone**: neutral/professional + editable now. True "matched to the
  User's tone" needs a Sent-mail corpus we don't have wired — treat tone-matching
  as a **stretch** (few-shot from recent Sent), not a v1 promise.

## Glossary tension to resolve (CONTEXT.md)

`CONTEXT.md` defines **Draft reply** as *"An LLM-generated reply, matched to the
User's tone."* v1 cannot match tone (no Sent corpus). Either:

- **(recommended)** soften the glossary to *"a context-aware draft reply,
  editable before send"*, or
- implement the few-shot-from-Sent stretch below before claiming tone-matching.

Update `CONTEXT.md` when this is decided — do not let the term over-claim.

## Current state

- `ReplyDialog` (plan 004) has an editable, initially-empty `body`.
- `replyPreview()` in `today-client.tsx` is heuristic placeholder text — replace
  its role with a real draft seam, or keep it only as a one-line teaser.
- `agent.ts` already shows the project's LLM pattern: OpenAI Agents SDK,
  `OPENAI_API_KEY` **optional** with graceful degrade (`configured: false`).

## Build order

1. **Draft procedure** — `gmail.draftReply` mutation (or extend the agent
   router): input `{ messageId }` (or the message fields already loaded).
   Server-side, fetch/accept the original subject + body + sender, prompt a
   **fast, cheap model** to produce a concise plain-text reply in the user's
   voice. Reuse the existing OpenAI setup for infra consistency
   (`gpt-4.1-mini`); a Claude model is a valid alternative — if you switch
   providers, read the `claude-api` skill first. Return `{ configured, text }`,
   mirroring `agent.ask`'s graceful-degrade shape.
2. **Wire into the dialog** — add a **"Draft with AI"** button in `ReplyDialog`.
   On click → call the procedure, stream/set the result into the editable `body`.
   The user edits, then hits **Send** (plan 004's keypress). Show a pending state;
   on `configured: false`, hide or disable with a tooltip ("set OPENAI_API_KEY").
3. **`/today` teaser (optional)** — keep a short, honest preview line per
   Needs-reply row; the full draft is generated on-demand when the dialog opens.

## Stretch (only if 004–008 land)

- **Tone via few-shot**: pull a handful of the user's recent `Sent` messages
  (`gmail.api.messages.list` with `labelIds: ["SENT"]`, or `gmail.db` once plan
  006 lands) and include them as style exemplars in the prompt. Only then update
  `CONTEXT.md` to claim tone-matching.

## How this maps to hackathon scoring

- Auto-draft replies → **Gmail workflow (15)** + **AI/MCP (15)**.

## STOP conditions

- Sending an AI draft without an explicit human Send press — violates "Approve,
  don't read". The draft only *fills* the field.
- Claiming tone-matching in `CONTEXT.md`/UI without the few-shot corpus actually
  wired.
