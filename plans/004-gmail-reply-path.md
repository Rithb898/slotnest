# Plan 004: Gmail reply path — send a threaded reply (the loop's missing arm)

> **Executor instructions**: Read in full before starting. This closes the
> **send** half of the "triage → draft → approve → send" loop. The calendar half
> already works (`invite-dialog.tsx` → `calendar.createEvent`); this plan is its
> symmetric Gmail twin. Build in "Build order"; each step is shippable. Update
> this plan's row in `plans/README.md` when done. On a STOP condition, stop and
> report — do not guess the Corsair/Gmail contract.

## Status

- **Priority**: P0 (the demo + product loop is non-functional without a send)
- **Effort**: M
- **Risk**: MED (threading correctness + RFC 2822 encoding)
- **Depends on**: 002 (Gmail read — DONE), 003 (shell / `/today` / `/inbox` — DONE)
- **Category**: core loop
- **Planned at**: 2026-06-14

## Decision provenance (grill session 2026-06-14)

- **Objective**: shippable product — the real loop (triage → draft → approve →
  send) works reliably; correctness over coverage.
- **Q2 — write scope**: **reply-in-thread only.** No compose-new, no
  save-as-draft in v1 (cheap to add later behind the same body-builder).
- **Q3 — first slice**: **send plumbing first** (this plan); the LLM "Draft
  reply" is plan 005, layered on top.
- **Q6 — how to send**: `gmail.api.messages.send({ raw, threadId })` with a
  base64url RFC 2822 message.
- **Q7 — threading correctness**: widen the read to surface the original
  `Message-ID` + `References` and set `In-Reply-To`/`References` on the reply.
- **Q5 — UX**: a modal dialog mirroring `invite-dialog.tsx` (editable body).
- **Q13 — the keypress**: the dialog's **Send** button *is* the human keypress
  that satisfies "Approve, don't read." No second confirm.

## Current state

- `gmail.inbox` / `gmail.message` (plan 002) read live via Corsair. The `message`
  query returns `threadId`, the sender (`fromEmail`), `to`, `subject` — but **not**
  the `Message-ID` or `References` headers a correct reply needs.
- `components/invite-dialog.tsx` is the proven draft → edit → Send → write
  pattern (calls `calendar.createEvent`, `sendUpdates: "all"`). Copy its shape.
- `/today` Approve buttons (`today-client.tsx`) currently only set local
  `actionStates`; they send nothing. `replyPreview` is heuristic placeholder text.
- `/inbox` reading pane has an action bar concept (plan 003) but no working Reply.
- Corsair exposes `gmail.api.messages.send` — **Risk: `write`**, input
  `raw` (base64url RFC 2822, required) + optional `threadId`
  (`docs/corsair/plugins/gmail/api.md`).

## Build order

1. **Widen the read** — in `gmail.message` (`server/api/routers/gmail.ts`),
   additionally extract and return `messageIdHeader = getHeader(headers,
   "Message-ID")` and `references = getHeader(headers, "References")`. These feed
   the reply's `In-Reply-To` / `References`. (Threading landmine: without them,
   replies thread in Gmail by `threadId` but break in other clients.)

2. **RFC 2822 builder** — add `lib/rfc2822.ts`: a pure function that takes
   `{ to, subject, body, inReplyTo?, references? }` and returns a base64url
   string. Build MIME headers (`To`, `Subject`, `Content-Type: text/plain;
   charset="UTF-8"`, `In-Reply-To`, `References`), blank line, then body; **lines
   joined with `\r\n`**; base64-encode then `+→-`, `/→_`, strip trailing `=`
   (per the `messages.send` doc note). Do **not** set `From` — Gmail fills the
   authenticated sender. Unit-test the encoding.

3. **`gmail.sendReply` mutation** — in the gmail router, `protectedProcedure`
   input `{ to: string().email(), subject, body, threadId, inReplyTo?,
   references? }`. Build `raw` via `lib/rfc2822.ts`, call
   `corsair.withTenant(ctx.session.user.id).gmail.api.messages.send({ raw,
   threadId })`. Return `{ id, threadId }`. Tenant-scoped, like every other call.

4. **Reply dialog** — `components/reply-dialog.tsx`, mirroring `invite-dialog`:
   props `{ open, onOpenChange, draft }` where `draft` carries `to` (prefilled =
   original sender), `subject` (prefilled `Re: <cleaned subject>`), `body`
   (empty/editable for now; plan 005 fills it), `threadId`, `inReplyTo`,
   `references`. Editable `To` + `body`; **Send** button → `sendReply.mutate`,
   `isPending` → "Sending…", success → toast + close + invalidate inbox. It is a
   draft until Send fires (the one human keypress).

5. **Wire entry points** —
   - `/inbox` reading-pane action bar: a **Reply** action opens `ReplyDialog`
     seeded from the open `gmail.message`.
   - `/today`: the **Approve / Reply** affordance on a Needs-reply row opens the
     same `ReplyDialog` prefilled (replaces the no-op `actionStates` send path).
   Reuse one `cleanSubject`/`Re:` helper; don't duplicate.

## Out of scope (note, don't build)

- Compose-new and save-as-draft (Q2) — add later behind the same `lib/rfc2822.ts`
  + a `drafts.create`/`drafts.send` mutation.
- HTML-body replies — plain text is correct and sufficient for v1.
- LLM draft content — plan 005.

## How this maps to hackathon scoring

- Send / reply / threaded → **Gmail workflow (15)**.
- Completes "Approve, don't read" as a *real* guarantee (was true only by the
  absence of a send) → **Productivity UX (15)**.

## STOP conditions

- Any Gmail/Corsair send contract not covered by `docs/corsair/` — STOP, ask for
  the doc (per `CLAUDE.md`/`AGENTS.md`).
- A reply that lands as a new (unthreaded) email — the threading wiring (step 1 +
  the `In-Reply-To`/`References` headers) is wrong; fix before shipping.
- Hardcoding/faking any send — disqualifying per the brief.
