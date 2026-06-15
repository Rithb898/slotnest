# Plan 008: Hybrid search — Qdrant semantic + Postgres keyword

> **Executor instructions**: Read in full before starting. This adds sub-second
> search over the local cache: keyword (Corsair `gmail.db`) + semantic (Qdrant
> embeddings generated on ingest). Heaviest of the P1 plans — only after 004–007
> land. Update this plan's row in `plans/README.md` when done.

## Status

- **Priority**: P1 (PRD signature "instant search"; biggest lift, off the core loop)
- **Effort**: L
- **Risk**: MED (Qdrant setup + embedding cost; keyword half is nearly free)
- **Depends on**: 006 (local cache + ingest hook)
- **Category**: intelligence
- **Planned at**: 2026-06-14

## Decision provenance (grill session 2026-06-14)

- **Q12**: deferred behind the reply loop and cache; it's the largest remaining
  P1 and not on the triage→draft→approve→send path. Do it last.

## What's nearly free vs what's new

- **Keyword** is mostly free: `corsair.gmail.db.messages.search({ data })`
  supports `contains` on `subject`, `snippet`, `raw` (and `threadId`, etc.) —
  `docs/corsair/plugins/gmail/database.md`. That alone gives a fast local keyword
  search with no new infra.
- **Semantic** is the new build: Qdrant embeddings keyed to
  `corsair_entities.id`, with Postgres remaining the source of truth.

## Build order

1. **Enable Qdrant** — configure `QDRANT_URL` and optional `QDRANT_API_KEY`.
   Collection creation is app-managed and idempotent.
2. **Embeddings collection** — Qdrant collection `slotnest_messages`:
   1536-dimensional cosine vectors plus payload `{ tenantId, entityId,
   gmailMessageId, subject, from, date }`. (1536 = OpenAI
   `text-embedding-3-small`.)
3. **Embed on ingest** — in the plan 006 `webhookHooks.messageChanged.after`
   hook (alongside triage), embed subject + snippet/body via
   `text-embedding-3-small`, upsert into Qdrant. One embed per
   message, on ingest — never on the read path.
4. **Backfill** — a one-off script to embed already-cached entities so search
   isn't empty before new mail arrives.
5. **Query** — `search` procedure: embed the query, ANN cosine over
   Qdrant with tenant filter, **and** run the `gmail.db` keyword `contains`; merge +
   rank (e.g. reciprocal-rank fusion, or keyword-first then semantic fill).
   Join back to `corsair_entities` for display rows.
6. **Surface** — wire into the ⌘K command bar's search mode (results list with
   honey rail on the active row, per DESIGN). Sub-second target.

## How this maps to hackathon scoring

- Hybrid local search → **Productivity UX (15)** + **AI/MCP (15)** +
  **Engineering quality (10)**.

## STOP conditions

- Embedding/searching on the read path instead of ingest — kills the
  "sub-second" claim and burns cost.
- Qdrant not configured on the deploy target — semantic search should degrade to
  keyword-only rather than breaking command search.
