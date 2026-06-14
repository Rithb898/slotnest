# Plan 006: Webhook ingest → fast local reads (the "Local cache")

> **Executor instructions**: Read in full before starting. **This plan is owned
> by the user (rithb8981) to implement.** It establishes Corsair webhook ingest
> so reads come from the local DB instead of live API fan-out, and creates the
> ingest seam that plans 007 (triage) and 008 (search) hang off. There is a
> documented **gap** (subscription registration) — see STOP conditions; resolve
> it before wiring the providers. Update this plan's row in `plans/README.md`.

## Status

- **Priority**: P0 (PRD Phase 1; foundation for triage-on-ingest + search)
- **Effort**: M–L
- **Risk**: HIGH (provider push setup + local tunneling are the classic time sinks)
- **Depends on**: 001 (OAuth connect — DONE)
- **Category**: foundation
- **Planned at**: 2026-06-14

## Decision provenance (grill session 2026-06-14)

- **Q11/Q12**: deferred during the reply-loop slice, but it's the foundation the
  PRD's P1 intelligence features (LLM triage, hybrid search) require. Build it
  *after* the reply loop (004) is shippable, *before* 007/008.
- Live `*.api.*` fan-out (current `gmail.inbox`) is acceptable as the PRD's
  documented fallback, but it's slow and rate-limited; the cache is the upgrade.

## What Corsair already gives us (don't rebuild)

Per `docs/corsair/concepts/database.md`:

- Corsair maintains **four tables** (`corsair_integrations/accounts/entities/
  events`) and already upserts entities on every `*.api.*` call. `server/
  corsair.ts` already passes `database: conn`, so this is live today.
- After webhooks are flowing, reads should use `*.db.*` (e.g.
  `corsair.gmail.db.messages.search({ data, limit, offset })`,
  `gmail.db.messages.list`) — fast, no rate limits
  (`docs/corsair/plugins/gmail/database.md`).
- Corsair **auto-routes, verifies signatures, and backfills out-of-order events**
  (`docs/corsair/concepts/webhooks.md`). We do not build a sync layer.

So "Local cache" in `CONTEXT.md` is *mostly Corsair's `corsair_entities`* — our
work is (a) turn on webhook ingest, (b) switch reads to `.db.*`, (c) add the
ingest hook for triage/embeddings.

## Build order

1. **Webhook route** — `app/api/webhook/route.ts`:
   ```ts
   import { processWebhook } from "corsair";
   import { corsair } from "@/server/corsair";
   export async function POST(request: Request) {
     const headers = Object.fromEntries(request.headers);
     const body = await request.json();
     const result = await processWebhook(corsair, headers, body);
     return result.response;
   }
   ```
   One endpoint handles both Gmail (`messageChanged`) and Calendar
   (`onEventChanged`) — Corsair routes by headers/payload.

2. **Multi-tenant routing** — Corsair recommends a **hashed tenant id** as a
   query param on the webhook URL (`...?tenant=<hashed>`), so internal ids aren't
   public (`docs/corsair/concepts/webhooks.md`). Decide the hash, and ensure the
   per-tenant subscription is registered with that URL.

3. **⚠ Subscription registration (THE GAP — resolve first, see STOP)** — getting
   Gmail to *push* requires a Google Pub/Sub topic + `users.watch`; Calendar
   requires `events.watch`. **Neither a `watch` operation nor the registration
   flow is in `docs/corsair/`**, and Gmail `watch` expires (~7 days) so it must be
   renewed. Confirm how Corsair establishes/renews these subscriptions before
   building — do not guess the API.

4. **Local tunneling** — ngrok (or similar) so Google can reach the route in dev;
   the deployed URL in prod (PRD). Verify a real change in Gmail/Calendar lands a
   webhook and updates `corsair_entities`.

5. **Switch reads to the cache** — once entities populate, refactor
   `gmail.inbox` / `gmail.message` and the calendar reads from `*.api.*` to
   `*.db.*` (`gmail.db.messages.search/list`). Keep an `*.api.*` path available
   for "force fresh" (per the docs' API-vs-DB table). Confirm the `.db` row shape
   carries what the UI needs (headers may require `format:"full"` semantics — the
   current code already notes `metadata` drops `payload.headers`).

6. **Ingest hook (the seam for 007/008)** — add `webhookHooks` on the gmail (and
   calendar) plugin in `server/corsair.ts`:
   ```ts
   gmail({ authType: "oauth_2", webhookHooks: {
     messageChanged: { after: async (ctx, result) => {
       // plan 007: classify + persist triage
       // plan 008: embed + upsert into message_embeddings
     } },
   }})
   ```
   `after` runs only on success and always runs for that event type — the right
   place for triage + embeddings so they're computed **once on ingest**, not per
   render.

## How this maps to hackathon scoring

- Webhooks + local DB + multi-tenant routing → **Corsair integration (20)** +
  **Engineering quality (10)**.
- Unlocks **Gmail (15)** / **AI-MCP (15)** intelligence via plans 007/008.

## STOP conditions

- **Subscription registration is undocumented** (step 3). STOP and either add the
  Corsair doc for Gmail `users.watch` / Calendar `events.watch` (and renewal), or
  confirm the supported mechanism — do not guess (per `CLAUDE.md`/`AGENTS.md`).
- Signature verification failing / webhooks rejected — check stored webhook
  credentials per `docs/corsair/concepts/webhooks.md`; don't disable verification.
- Tenant leakage — every `.db.*` read must go through `withTenant()`.
