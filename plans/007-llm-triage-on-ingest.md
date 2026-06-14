# Plan 007: LLM triage on ingest — real two-axis classification

> **Executor instructions**: Read in full before starting. This swaps the
> heuristic triage stub for a cheap-LLM classifier that runs **once on ingest**
> and persists, behind the existing `triage()` signature. Update this plan's row
> in `plans/README.md` when done.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (cost/latency if run on the read path instead of ingest)
- **Depends on**: 006 (ingest hook + local cache to persist against)
- **Category**: intelligence
- **Planned at**: 2026-06-14

## Decision provenance (grill session 2026-06-14)

- **Q10**: keep the heuristic stub until there's a cache; do **not** block the
  reply loop on this. The stub already sits behind a clean seam.
- The classifier must run on **ingest** (the plan 006 `webhookHooks.after`
  seam) and persist — never per-render LLM calls.

## Current state

- `lib/triage.ts` is a documented heuristic stub (`URGENT_CUES`/`REPLY_CUES`/
  `IGNORE_CUES`/`FYI_CUES`) returning `{ action, urgency }`. Its signature is the
  swap point ("an LLM classifier can swap in behind the same `triage()`
  signature later").
- Label sets are fixed in `CONTEXT.md`: Action = `Needs reply | FYI | Ignore`;
  Urgency = `Urgent | Normal | Low`.
- `gmail.inbox` computes triage per-request today (fine for the stub; too costly
  for an LLM).

## Build order

1. **Persistence** — add an app table (Drizzle) `message_triage`:
   `entity_id` (FK → `corsair_entities.id`), `action`, `urgency`, `model`,
   `created_at`. Join to Corsair entities by id (per the database doc's
   "join to your own tables" pattern). One row per message.
2. **Classifier** — `lib/triage-llm.ts`: cheap/fast model over subject + snippet
   (+ short body), returns `{ action, urgency }` constrained to the exact label
   sets. Reuse the project's OpenAI setup (`gpt-4.1-mini`) for consistency; if you
   switch to Claude, read the `claude-api` skill first. Validate output against
   the enum; on any failure fall back to the heuristic `triage()`.
3. **Run on ingest** — call the classifier in the plan 006
   `gmail webhookHooks.messageChanged.after` hook, upsert into `message_triage`.
4. **Read path** — `gmail.inbox`/`message` read the stored label by `entity_id`;
   if absent (not yet classified, or webhook lagged), fall back to the live
   heuristic so the UI never blocks. Same `{ action, urgency }` shape downstream —
   `/today` and `/inbox` chips need no changes.

## How this maps to hackathon scoring

- Two-axis triage on ingest → **Gmail workflow (15)** + **AI/MCP (15)**.

## STOP conditions

- Running the LLM on the read path (every inbox load) — defeats the purpose;
  classify on ingest and persist.
- Emitting labels outside the `CONTEXT.md` enums — breaks the chips/sort.
