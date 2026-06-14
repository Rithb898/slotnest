# Plan 009: Agent propose → approve → execute (the hero "one sentence" flow)

> **Executor instructions**: Read in full before starting. This turns the
> read-only ⌘K agent into the PRD's hero: one sentence → a *structured proposal*
> → one keypress → real invite + email. It reuses the deterministic write paths
> from plans 004 (reply) and the existing `calendar.createEvent` — the agent
> never writes directly. Lowest priority; only after the core loop ships.

## Status

- **Priority**: P2 (PRD "Definition of Done" hero, but built on 004's writes)
- **Effort**: M
- **Risk**: MED (structured-output reliability; keeping writes off the agent)
- **Depends on**: 004 (`gmail.sendReply`), existing `calendar.createEvent`
- **Category**: signature / demo
- **Planned at**: 2026-06-14

## Decision provenance (grill session 2026-06-14)

- **Q11**: the Agent **stays read-only**. Corsair's MCP `run_script` is a single
  general tool that can call writes, and the provider exposes **no per-tool
  approval hook** (see `agent.ts` caveat), so draft-then-approve cannot be
  enforced structurally inside the agent. Therefore the agent only *proposes*;
  the app executes via the deterministic tRPC mutations.

## The gap this closes

Today `agent.ask` returns **plain text**, rendered in the command-bar panel. The
hero ("invite Sam 9am Thursday and email him…") can't complete because (a) the
agent is instructed never to write, and (b) the UI has nothing structured to turn
into an Approve button. The fix is structured proposals + the existing approve
surfaces.

## Build order

1. **Structured proposal output** — extend the agent to return, alongside its
   prose, a typed proposal: a discriminated union like
   `{ kind: "invite", summary, start, end, attendees[] }` or
   `{ kind: "reply", to, subject, body, threadId? }` (and a `none` case). The
   agent still only *reads* via Corsair MCP to ground times/attendees/free slots;
   it emits the proposal, it does not send. Validate with zod.
2. **Render proposal as an approve card** — in the command bar, when a proposal
   comes back, show it as a confirm card that opens the existing `InviteDialog`
   (invite) or `ReplyDialog` (reply, plan 004) **prefilled**. The user reviews and
   hits Send/Approve.
3. **Execute deterministically** — Send fires the existing `calendar.createEvent`
   / `gmail.sendReply` mutations (the only write path). One sentence → reviewed
   card → one keypress → real actions.
4. **Multi-action sentences** — if a sentence implies both an invite *and* an
   email, return both proposals; the user approves each (or a combined confirm).
   Keep each write behind its own keypress.

## How this maps to hackathon scoring

- One-sentence multi-step, executed safely → **AI/MCP (15)** + **Calendar (15)**
  + **Gmail (15)** + **Productivity UX (15)**. This is the demo climax.

## STOP conditions

- The agent performing any write itself (sending/booking) — it proposes only;
  writes go through the deterministic mutations behind a human keypress.
- Free-text-only output with no structured proposal — then there's nothing to
  approve and the hero flow can't complete.
