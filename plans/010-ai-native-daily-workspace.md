# Plan 010: AI-native daily workspace and retention loop

> **Executor instructions**: Read in full before starting. This plan captures the
> confirmed product direction from the dashboard/sidebar discussion. It is not a
> landing-page plan. It turns the authenticated app into the daily workspace:
> AI brief → prioritized decisions → prepared drafts → approve/edit/skip.

## Status

- **Priority**: P0 (product direction)
- **Effort**: L
- **Risk**: MED (AI quality, trust, and write-safety)
- **Depends on**: 003, 004, 005, 009
- **Category**: product / UX / AI workflow
- **Planned at**: 2026-06-14

## Confirmed product direction

SlotNest is a Superhuman-style Gmail + Google Calendar command center with an
AI-native advantage: users should not read every email and decide what matters.
SlotNest should decide what needs attention, explain why, prepare replies in the
user's tone, find calendar time when scheduling is involved, and wait for human
approval before sending or booking.

The app is not a landing page and not a generic dashboard. The first useful
screen is the authenticated `/today` workspace.

The core promise:

> Open SlotNest. It tells you what matters, drafts the response, finds the
> meeting slot if needed, and lets you approve the action.

## Real problem this solves

Normal Gmail + Calendar users lose time on four repeated decisions:

1. Which emails actually need me?
2. What is the sender asking for?
3. How should I reply in my tone?
4. When can this become a real meeting?

SlotNest should remove the decision load. It should say:

- This matters.
- Here is why.
- Here is the reply.
- Here is the meeting slot.
- Approve it, edit it, or skip it.

This is the daily retention loop. Users return because the app saves reading and
decision time within the first few seconds.

## Page strategy

Keep the app small. More pages are only useful if they represent daily workflow
states, not navigation for its own sake.

### Existing core pages

- `/today` — the main AI workspace. This is the product.
- `/inbox` — full two-pane email fallback for reading and manual actions.
- `/calendar` — real calendar, free slots, and invite creation.
- `/settings` — connections, account, and trust controls.

### New pages to add

#### `/drafts`

AI-prepared replies and actions waiting for approval.

Why:

- Proves that AI is doing work before the user asks.
- Gives users a single review queue.
- Reinforces "approve, do not read everything."

Contents:

- Pending reply drafts.
- Pending invite drafts.
- Multi-action proposals from the command bar.
- Approve, edit, skip, and snooze actions.

#### `/waiting`

Threads where the user is waiting for someone else.

Why:

- Solves "did they ever reply?" better than Gmail.
- Creates daily pull even when the inbox is quiet.
- Differentiates SlotNest from a normal inbox clone.

Contents:

- Follow-up candidates.
- Waiting duration.
- Last outbound message context.
- Suggested follow-up draft.
- "Follow up", "Snooze", and "Resolved" actions.

### Pages to defer

#### `/automations`

User-approved rules such as auto-archive newsletters, draft meeting replies, or
remind me if no reply in three days.

Why defer:

- Valuable for retention, but only after approve/edit/skip is trusted.
- Too early automation can reduce trust if drafts are not good yet.

#### `/people`

Contact memory: tone, relationship, recent threads, meeting history.

Why defer:

- Useful for reply quality, but it can begin as hidden context inside draft
  generation instead of a visible page.

#### `/search`

AI/local search across email and calendar.

Why defer:

- Keep search inside the command bar first. Add a page only if users need saved
  search sessions or deep investigation.

## Sidebar direction

The sidebar should stay focused and product-status driven.

Recommended v1 sidebar:

1. Today
2. Inbox
3. Calendar
4. Drafts
5. Waiting
6. Settings

Optional later:

- Automations, after the approval loop is reliable.

Sidebar badges:

- Today: number of items needing approval today.
- Inbox: unread or needs-reply count.
- Calendar: today's event count.
- Drafts: AI drafts waiting for approval.
- Waiting: overdue follow-ups.
- Settings: connection health dot.

The top sidebar command field stays important:

> Ask SlotNest... `Cmd/Ctrl K`

This should feel like the app's primary control, not just search.

## `/today` target design

`/today` should become a hybrid of command center and approval workspace.

### Top: AI daily brief

Replace static greetings and generic hero text with a cheap-model generated
brief from real Gmail + Calendar context.

Example:

> You have 4 emails that need decisions today. Priya is waiting on feedback, Sam
> is trying to schedule, and your 3 PM block is the cleanest meeting slot. I
> prepared 2 replies.

Purpose:

- Immediate value within five seconds.
- Personalized enough to build trust.
- Cheap enough to run daily or on refresh.

### Main: hybrid split workspace

Left pane:

- AI-prioritized queue.
- Sender, subject, triage chips, and short reason.
- Selected state.
- Keyboard navigation.

Right pane:

- Selected item detail.
- Why SlotNest picked it.
- AI-prepared reply in user's tone.
- Calendar suggestion if the email is scheduling-related.
- Approve, edit, skip, snooze.

This should feel like Superhuman speed plus AI decision support.

### Supporting rail

Keep calendar context lightweight:

- Next event.
- Best open slot today.
- Scheduling opportunities from emails.

Do not turn this into a metric-card dashboard.

## AI model strategy

Use AI heavily, but match model cost to task.

### Cheap model

Use for frequent, small, structured decisions:

- Daily brief.
- Email triage labels.
- "Why this matters."
- Short thread summaries.
- Follow-up detection.
- Priority ordering.
- Draft availability hints.

### Bigger model

Use where quality matters more than cost:

- Reply drafting in user's tone.
- Long-thread understanding.
- Multi-step command planning.
- Ambiguous user instructions.
- Combined email + calendar proposals.

### Deterministic code

Keep these out of AI:

- Calendar free-slot calculation.
- Sorting by timestamp/urgency.
- Connection health.
- Count badges.
- Final writes to Gmail/Calendar.

## Write-safety rule

The agent must not directly send email or book calendar events.

Flow:

1. AI proposes.
2. UI renders a structured approval card.
3. User reviews.
4. Deterministic tRPC mutation sends or books.

This preserves trust and matches the confirmed "draft, then approve" product
direction.

## Build order

1. **AI daily brief data contract**
   - Inputs: top needs-reply messages, today's events, open slots, waiting
     threads, existing draft count.
   - Output: short personalized brief plus structured highlights.
   - Use a cheap model.

2. **Redesign `/today` as hybrid workspace**
   - Top daily brief.
   - Left prioritized queue.
   - Right selected action panel.
   - Calendar context rail only if it helps the selected action.

3. **Add `/drafts`**
   - Start with generated reply drafts from plan 005.
   - Include calendar invite proposals from existing `InviteDialog`.
   - Badge the sidebar.

4. **Add `/waiting`**
   - Start heuristic-based: outbound-looking threads, follow-up language, waiting
     language.
   - Later move to cheap-model classification on ingest.
   - Badge overdue items in the sidebar.

5. **Upgrade command bar proposals**
   - Use plan 009's structured proposal model.
   - Render multi-action approval cards, not plain text only.

6. **Add user-tone learning**
   - Infer tone from sent emails once Gmail send/read contracts support it.
   - Keep controls simple: "more formal", "shorter", "warmer".

## Success criteria

- A new connected user understands the product from `/today` without a tutorial.
- The first screen shows personalized AI context, not generic setup copy.
- The user can approve at least one prepared action without opening raw Gmail.
- Scheduling emails can become invite drafts with a suggested slot.
- Drafts and Waiting make the app useful every day, not only when the inbox is
  full.
- The command bar can produce structured proposals that are safe to approve.

## STOP conditions

- Do not add pages that do not represent a recurring workflow state.
- Do not let the AI perform irreversible writes directly.
- Do not fake Gmail or Calendar data for the core workflow.
- Do not make `/today` a metric-card dashboard.
- Do not hide the approval step. Trust is the product.
