# Plan 003: Dashboard design — the "approve, don't read" command center

> **Executor instructions**: This is a design + build-sequencing plan, not a
> single mechanical change. Read it in full before starting. Build in the order
> in "Build order". Each numbered step is shippable on its own — land the shell
> before the surfaces that hang off it. When a step is done, update the status
> row for this plan in `plans/README.md`. If a STOP condition occurs, stop and
> report — do not improvise the Corsair or agent contracts.

## Status

- **Priority**: P1
- **Effort**: L (multi-surface; build incrementally)
- **Risk**: MED
- **Depends on**: 001 (OAuth connect — DONE), 002 (Gmail inbox read — DONE)
- **Category**: direction (defines the product the rest of the app builds toward)
- **Planned at**: 2026-06-14

## The thesis (why this plan exists)

**Superhuman is a faster cockpit for pilots. SlotNest is autopilot for people
who don't want to fly.**

Superhuman's "keyboard-first" means *memorize 40 shortcuts* — expert-only, which
is in our own anti-references. SlotNest's keyboard-first + AI-native is the
opposite: **one box, plain English, zero to memorize.** The keyboard is the fast
path; the AI is what makes it usable without a tutorial.

We are not building a faster inbox. We are building a tool that **tells a normal,
non-technical user what needs them, prepares the action, and lets them approve it
with one keypress.** Inbox-zero by approval, not by reading.

### Three principles that drive every screen

1. **Don't read — approve.** Surfaces show *decisions*, not messages. Each item
   is a pre-drafted action plus one keypress to confirm.
2. **Plain English > shortcuts.** The command bar takes "archive all
   newsletters" / "reply yes to Alice". Shortcuts exist for speed, never as a
   requirement. Keyboard-first ≠ expert-only.
3. **Draft, then approve.** The AI prepares everything (replies, invites,
   triage); nothing sends or books without a human keypress. Non-tech users fear
   the AI acting irreversibly in their name — for v1, it never does.

### Real non-tech problems Superhuman doesn't touch

| Normal-person pain | Superhuman | SlotNest (AI-native) |
|---|---|---|
| "What do I actually need to do?" | Faster inbox; you still read everything | The 3 things, drafts ready, hit ↵ |
| Scheduling ping-pong (6 emails) | Nothing — email-only | "Meet Sam Thursday" → real free slot → invite sent |
| "I don't know how to word this" | Snippets you write yourself | Draft in *your* voice, ready to approve |
| "Did they ever reply?" | Manual reminders | Auto-surfaces threads where you're waiting |
| "20-message thread — what's the ask?" | You read it | "Sam needs the invoice by Friday." |
| $30/mo, needs onboarding | Expert tool | Just works, plain language |

## Demo arc (what the design must make possible)

1. **Hook (relatable):** open `/today` → "3 things need you, drafts ready, ↵" →
   inbox cleared in ~20s. Every judge feels "I'm drowning in email."
2. **Climax (impossible in Superhuman):** type one sentence in ⌘K —
   *"Invite Sam 9am Thursday and email him I'm looking forward to it"* → free
   slot found, invite booked, email sent, all from one line.

Approve-don't-read is the **emotional hook**; the one-sentence multi-step is the
**signature/hero**.

## Page map

```
(app) shell  →  left sidebar + ⌘K command bar (global; the real interface)
├── /today        HOME — "what needs you", drafts ready, ↵ to approve
├── /inbox        full two-pane mail (click-fallback) + triage chips + action bar
├── /calendar     week/agenda + free-slot finder + send-invite
└── /connections  settings, quiet
```

Sidebar items: **Today · Inbox · Calendar**, a divider, then **Connections** at
the bottom. Active item = honey-ink text + 2px honey rail (the only persistent
honey on the page, per DESIGN). A ⌘K hint is pinned near the top. On mobile the
sidebar collapses to a bottom bar / sheet (touch targets ≥44px).

`/today` is the home route for a connected user (not a metric-card dashboard —
DESIGN forbids hero-metric dashboards). The other pages are the "I'd rather
click" fallback; the command bar + Today are the product.

## Current state

- `app/(app)/layout.tsx` — **empty passthrough** (`return <>{children}</>`). No
  shell, no sidebar, no command bar yet. This is step 1.
- `app/(app)/inbox/` — working two-pane read UI via `api.gmail.inbox` /
  `api.gmail.message` (plan 002). No triage chips, no action bar, no keyboard nav.
- `app/(app)/connections/` — working Corsair OAuth connect (plan 001). Keep quiet.
- No `/today`, no `/calendar`, no command bar, no triage classifier, no agent.
- Design tokens + component vocabulary fully specced in `DESIGN.md`; shadcn
  primitives already vendored in `components/ui/` (including `command.tsx`,
  `calendar.tsx`, `sidebar.tsx`, `dialog.tsx`).

## Surface specs

### App shell (`app/(app)/layout.tsx`)
- Left sidebar on `panel` background, Title-weight ghost rows, active = honey-ink
  + 2px leading honey rail. Items: Today, Inbox, Calendar, divider, Connections.
- Global ⌘K command bar mounted here so it's available on every `(app)` route.
- Server layout should confirm the user is signed in (better-auth) and, ideally,
  has at least one Connection; if not connected, route guidance toward
  `/connections`.

### `/today` — approve-don't-read (the home)
One calm column (readable max-width, not a grid of metric cards). Three zones:

1. **Needs your reply** — triaged emails that need action, each row showing the
   sender, an Action + Urgency chip (semantic trio, never honey), and a
   pre-drafted reply that can be approved (↵ to send) or skipped (e). Clicking a
   row deep-links into `/inbox`.
2. **On your calendar today** — today's events in order, with **free gaps made
   visible** and a "schedule" affordance on a gap (entry point to free-slot).
3. **Ask SlotNest** — an inline prompt box that opens ⌘K / the agent; seeded with
   an example like the hero sentence.

Today *triages*; the dedicated pages *do the work*. Keep it quiet.

### `/inbox` upgrades (on top of plan 002)
- **Triage chips** per row: Action (`Needs reply` / `FYI` / `Ignore`) + Urgency
  (`Urgent` / `Normal` / `Low`) — semantic colors, never honey.
- **Smart-view tabs**: Needs reply · FYI · All.
- **Reading-pane action bar**: Draft reply · → Invite (email→invite) · Archive ·
  Reply.
- **Keyboard nav**: `j/k` move, `↵` open, `e` archive, `r` reply, `c` compose —
  hints visible, never required.

### `/calendar`
Week or agenda view of real events via Corsair Google Calendar API. **Free-slot
finder** highlighting open gaps; **send-invite** (the destination of
email→invite). Reuse `components/ui/calendar.tsx`.

### ⌘K command bar (global, signature)
One overlay (`Float` shadow per DESIGN), two modes in one input:
- **Discrete commands** — fuzzy actions/navigation (Go to Inbox, Compose,
  Archive…), mono shortcut hints right-aligned, honey rail on the active result.
- **Natural language** — routed to the **Agent (OpenAI Agents SDK + Corsair
  MCP)**, e.g. the hero sentence. Multi-step: book a real free slot + send an
  email from one line.

## Triage classifier (shared dependency)

Both `/today` and `/inbox` chips need an Action + Urgency label per email. A
cheap-LLM pass over subject + snippet/body returns `{ action, urgency }`
(see `CONTEXT.md` for the exact label sets). Build this before the surfaces that
render chips. Persist results against the local cache so it isn't recomputed on
every render. **Stub-first is acceptable**: a deterministic heuristic
(unread + recency) can stand in so the shell/Today UI can land independently,
then swap in the LLM classifier.

## Build order

1. **App shell** — sidebar + global ⌘K command bar in `app/(app)/layout.tsx`.
   Everything else hangs off this. (Command bar can ship with discrete
   commands/navigation first, agent wired later in step 6.)
2. **Triage classifier** — Action + Urgency pass (stub heuristic OK to start),
   persisted to the local cache.
3. **/today** — the three zones, approve-don't-read, wired to triage.
4. **/inbox upgrades** — chips, smart-view tabs, reading-pane action bar,
   keyboard nav.
5. **/calendar** + free-slot finder + send-invite.
6. **⌘K agent (MCP)** — natural-language routing, the one-sentence multi-step
   climax.

## How this maps to hackathon scoring

- Command bar + agent chat → **AI/MCP (15) + Productivity UX (15)**
- Triage chips + draft reply → **Gmail workflow (15)**
- Free-slot + email→invite → **Calendar workflow (15)**
- Today view + keyboard-first, no-onboarding → **Productivity UX (15)**

## Out of scope for v1 (note, don't build first)

- **Mixed-by-stakes autonomy** (auto-archive newsletters, approve only outbound).
  v1 is strictly draft-then-approve. Revisit if time allows.
- **Hybrid/pgvector local search** as a dedicated surface — ⌘K search can start
  over the existing data; the "under 1 second" local search is a later bonus.
- **Follow-up memory** ("did they reply?") — strong differentiator, but layer it
  after the core approve-don't-read loop works.

## STOP conditions

- Any Corsair, Gmail, Google Calendar, MCP, or agent API whose contract isn't
  covered by `docs/corsair/` — STOP and ask for the doc rather than guessing
  (per `CLAUDE.md` / `AGENTS.md`).
- Hardcoding Gmail/Calendar data to fake a surface — disqualifying per the brief.
  Every surface reads real data through Corsair.
- Honey used for triage urgency, or as more than one meaning per screen — that
  violates DESIGN's One Light Rule.
```
