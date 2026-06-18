# Plan 013: Enforce one shared AI action budget across all model calls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b1947bb..HEAD -- server/api/routers/agent.ts server/api/routers/chat.ts server/api/routers/gmail.ts server/api/routers/workspace.ts server/api/routers/billing.ts server/db/schema server/billing lib app/(app)/chat/_components/chat-client.tsx app/(app)/today/_components/today-client.tsx components/command-bar.tsx components/reply-dialog.tsx components/app-sidebar.tsx`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/005-llm-draft-reply.md, plans/009-agent-propose-then-execute.md, plans/010-ai-native-daily-workspace.md, plans/011-chat-agent.md
- **Category**: direction
- **Planned at**: commit `b1947bb`, 2026-06-18

## Why this matters

SlotNest currently spreads AI spend across several unrelated entry points:
chat turns, reply drafting, the daily brief, and agent proposal generation.
Those paths can each trigger fresh model calls with no shared cap, which makes
demo-day traffic expensive and makes free-vs-paid behavior hard to explain.

The product decision is already settled: use one shared `AI action budget`
across all expensive AI work, charge every fresh model call, reset free usage
daily, reset paid usage monthly, and hard-stop at the cap with an upgrade
prompt. The implementation needs to make that policy structural on the server
and visible in the UI, not just described in copy.

## Current state

Relevant files and what they do today:

- `server/api/routers/agent.ts` - command-bar natural language agent. Runs the
  model directly and returns proposals, but does not check any shared budget.
- `server/api/routers/chat.ts` - persistent chat agent. Runs the chat model and
  then optionally runs the voice rewriter for reply proposals, again with no
  shared budget gate.
- `server/api/routers/gmail.ts` - `draftReply` caches one draft per message and
  reuses it, but fresh generations still run the model without a shared quota.
- `server/api/routers/workspace.ts` - `dailyBrief` caches by signature/model,
  but fresh brief generation still has no shared quota.
- `server/api/routers/billing.ts` - returns plan/subscription state, but no AI
  usage summary or budget ledger.
- `app/(app)/chat/_components/chat-client.tsx` - blocks chat when Gmail and
  Calendar are both disconnected, but knows nothing about AI spend.
- `app/(app)/today/_components/today-client.tsx` - pre-drafts replies and
  fetches the daily brief; again no budget awareness.
- `components/command-bar.tsx` - sends prompts to `api.agent.ask` directly.
- `components/reply-dialog.tsx` - sends `api.gmail.draftReply` directly from
  the UI.
- `components/app-sidebar.tsx` - already surfaces the current plan and upgrade
  CTA, so it is the natural place to expose remaining AI budget later.
- `lib/billing-plans.ts` - only contains plan labels/prices today:
  ```ts
  export const BILLING_PLAN_CATALOG = {
    free: { name: "free", label: "Free", description: "...", priceInr: 0 },
    pro: { name: "pro", label: "Pro", description: "...", priceInr: 299 },
  } as const;
  ```

Concrete call sites that currently run model work:

- `server/api/routers/agent.ts:137-177`
  ```ts
  const agent = new Agent({ ... });
  const result = await run(agent, input.prompt);
  ```
- `server/api/routers/chat.ts:334-460`
  ```ts
  const result = await run(agent, agentInput);
  ...
  body: await draftReplyInVoice(userId, proposal),
  ```
- `server/api/routers/gmail.ts:1061-1108`
  ```ts
  if (!input.force) {
    const [cached] = await db.select(...).from(replyDraft)...
    if (cached && (cached.status === "edited" || cached.model === DRAFT_MODEL)) {
      return { configured: true, text: cached.body };
    }
  }
  ...
  const sourceMessage = ...
  ```
- `server/api/routers/workspace.ts:106-174`
  ```ts
  const [cached] = await db.select(...).from(dailyBriefTable)...
  if (cached && cached.signature === signature && cached.model === BRIEF_MODEL) {
    return { configured: true, brief: cached.brief, highlights: briefHighlights };
  }
  const result = await run(agent, ...);
  ```

Repo convention to follow:

- Keep the accounting server-side and tRPC-driven.
- Reuse existing billing UI patterns instead of inventing a separate upgrade
  flow. See `components/billing-upgrade-button.tsx` and the plan card in
  `components/app-sidebar.tsx`.
- Preserve the approval-first UX. When the budget is exhausted, block new AI
  calls and point the user to upgrade, but do not hide their existing history or
  cached drafts.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Budget helper test | `pnpm exec tsx server/billing/ai-action-budget.test.ts` | exit 0 |
| Focused lint | `pnpm exec biome check server/api/routers/agent.ts server/api/routers/chat.ts server/api/routers/gmail.ts server/api/routers/workspace.ts server/api/routers/billing.ts server/db/schema server/billing lib app/(app)/chat/_components/chat-client.tsx app/(app)/today/_components/today-client.tsx components/command-bar.tsx components/reply-dialog.tsx components/app-sidebar.tsx` | exit 0 |
| Typecheck | `pnpm exec tsc --noEmit` | no new errors in touched files; keep the pre-existing unrelated baseline noise unchanged |

## Suggested executor toolkit

- Reuse `BillingUpgradeButton` for every upgrade prompt.
- If the executor can add a small helper test first, keep it in the same `tsx`
  style as `lib/gmail-reply-raw.test.ts`.

## Scope

**In scope**:

- `server/db/schema/ai-action-budget.ts` - new ledger table for AI actions.
- `server/db/schema/index.ts` - export the new table.
- `server/billing/ai-action-budget.ts` - shared policy + reservation helper.
- `server/api/routers/billing.ts` - expose budget summary alongside the current
  subscription data.
- `server/api/routers/agent.ts` - charge before `run()`.
- `server/api/routers/chat.ts` - charge before `run()` and before
  `draftReplyInVoice()`.
- `server/api/routers/gmail.ts` - charge before fresh `draftReply` generations.
- `server/api/routers/workspace.ts` - charge before fresh `dailyBrief`
  generations.
- `components/app-sidebar.tsx` - show remaining budget and reset timing.
- `components/command-bar.tsx` - block new agent prompts when budget is empty.
- `components/reply-dialog.tsx` - block `Draft with AI` when budget is empty.
- `app/(app)/chat/_components/chat-client.tsx` - surface the chat lock state.
- `app/(app)/today/_components/today-client.tsx` - surface the daily lock state.
- `lib/billing-plans.ts` or `server/billing/ai-action-budget.ts` - hold the
  free/pro caps in one place.

**Out of scope**:

- Payment provider wiring, checkout flow, or Razorpay subscription work.
- OAuth or connection handling.
- Legal pages, footer copy, or landing page changes.
- Team billing, org billing, or any seat-based metering.
- Any heuristic fallback that lets the app keep generating AI output after the
  cap is reached.

## Steps

### Step 1: Codify the policy and the ledger

Create a single server-side policy module for AI usage:

- Free plan: `5` AI actions per day.
- Paid plan: `300` AI actions per month.
- Budget identity must come from the user account plus the current billing
  period, not from a subscription-row counter.

Add a new ledger table under `server/db/schema/ai-action-budget.ts` that can
record each fresh model call with enough metadata to explain what was charged
later: user id, action kind, period key, source file or route label, model name,
and timestamp. Export it from `server/db/schema/index.ts`.

Add `server/billing/ai-action-budget.ts` with the shared helpers:

- resolve the active plan from the existing billing summary state
- compute the current budget window and its reset timestamp
- count consumed actions for the current window
- reserve one action atomically before a fresh model call
- throw a single, stable error when the budget is exhausted

**Verify**: `pnpm exec tsx server/billing/ai-action-budget.test.ts` -> exit 0.

### Step 2: Surface budget state from billing

Extend `server/api/routers/billing.ts` so `summary` returns one more object for
the active AI budget, for example:

- current period kind (`daily` or `monthly`)
- limit
- used
- remaining
- reset timestamp
- exhausted flag

Keep the existing `currentPlan` and `availablePlans` output intact so the
sidebar and settings continue to work.

If the executor needs a helper for plan lookup, keep it in the billing helper
module, not duplicated in the router.

**Verify**: `pnpm exec biome check server/api/routers/billing.ts server/billing/ai-action-budget.ts server/db/schema` -> exit 0.

### Step 3: Charge every fresh model call

Instrument the existing AI entry points so they all use the shared reservation
helper immediately before `run(...)`:

- `server/api/routers/agent.ts` before the command-bar model call
- `server/api/routers/chat.ts` before the chat agent call
- `server/api/routers/chat.ts` again before `draftReplyInVoice()`
- `server/api/routers/gmail.ts` after the cache miss branch in `draftReply`
- `server/api/routers/workspace.ts` after the cache miss branch in `dailyBrief`

Important rules:

- Cached reads do not consume budget.
- A forced regeneration does consume budget.
- If the reservation fails, stop before the model call and return the shared
  budget-exhausted error.
- Do not add any fallback model call after the cap is hit.

After wiring the known call sites, run a repo search for fresh model calls and
verify there are no unguarded `run(` paths left in the server routers.

**Verify**: `rg -n "await run\\(|run\\(" server/api/routers` -> only the
budgeted call sites remain.

### Step 4: Make the UI explain the lock

Use the new `billing.summary` budget payload to block AI entry points in the UI:

- `components/app-sidebar.tsx` should show a compact remaining-usage line under
  the current plan, plus the existing upgrade CTA when the user is on Free.
- `components/command-bar.tsx` should stop `api.agent.ask` when the budget is
  exhausted and show the upgrade prompt instead of sending the request.
- `components/reply-dialog.tsx` should disable `Draft with AI` and explain that
  the user has hit the shared cap.
- `app/(app)/chat/_components/chat-client.tsx` should keep chat history readable
  but disable composer actions when the budget is empty, while preserving the
  existing connection gate as the stronger block.
- `app/(app)/today/_components/today-client.tsx` should disable the AI draft and
  daily-brief refresh paths when the budget is empty, but keep the non-AI
  content visible.

Use the existing `BillingUpgradeButton` for every upgrade call to action rather
than introducing a new purchase flow.

**Verify**: `pnpm exec biome check components/app-sidebar.tsx components/command-bar.tsx components/reply-dialog.tsx "app/(app)/chat/_components/chat-client.tsx" "app/(app)/today/_components/today-client.tsx"` -> exit 0.

### Step 5: Add regression tests and smoke checks

Add a focused test file for the budget helper, following the repo's small
`tsx` test style:

- daily reset selection for Free
- monthly reset selection for Pro
- shared limit selection from plan state
- consumed count and remaining count math
- exhausted-state error
- forced regeneration counts as a separate action

If the executor can reasonably add a second small test, make it assert that the
budget check happens after cache hits but before fresh model calls in at least
one consumer.

Finish with the standard static checks. Do not run `dev` or `build`.

**Verify**:

- `pnpm exec tsx server/billing/ai-action-budget.test.ts` -> exit 0
- `pnpm exec tsc --noEmit` -> no new errors in touched files

## Test plan

- New helper test file: `server/billing/ai-action-budget.test.ts`
- Cover:
  - free plan returns a daily limit of 5
  - pro plan returns a monthly limit of 300
  - reset timestamps move at the correct boundary
  - repeated fresh calls decrement remaining usage
  - exhausted budget throws the shared error
  - cache-hit paths skip charging, while forced regenerations do not
- Use `lib/gmail-reply-raw.test.ts` as the structural style reference for a
  tiny self-contained `tsx` assertion test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `server/billing/ai-action-budget.ts` exists and is the only place that
  knows the free/pro caps.
- [ ] Every fresh model call in `agent`, `chat`, `gmail.draftReply`, and
  `workspace.dailyBrief` reserves budget before `run(...)`.
- [ ] Cached replies and cached daily briefs do not consume budget.
- [ ] The UI shows an explicit upgrade or reset state when the shared budget is
  empty.
- [ ] `pnpm exec tsx server/billing/ai-action-budget.test.ts` exits 0.
- [ ] `pnpm exec biome check` on the touched files exits 0.
- [ ] `pnpm exec tsc --noEmit` does not introduce any new errors in the touched
  files.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report back if:

- The code at the locations in "Current state" does not match the excerpts
  above.
- The database layer cannot support an atomic per-period reservation without
  adding an ad hoc in-memory counter.
- A route is discovered that makes a fresh model call but is not one of the
  current AI entry points listed here.
- The budget-exhausted UI would have to replace the existing connection gate or
  approval-first flow instead of layering on top of it.
- The executor finds a path that would keep generating AI output after the cap
  is hit.

## Maintenance notes

- Any new AI feature must call the shared reservation helper before the first
  expensive model call.
- If a future feature reuses cached model output, it should not reserve budget
  again.
- If the product later introduces team or shared-workspace billing, stop and
  define the account model first. This plan is explicitly single-user.
- Keep the upgrade CTA centralized on `BillingUpgradeButton`; do not copy Razorpay
  checkout code into the lock screens.
- The ledger is for accounting and supportability. Do not use it as the only
  source of truth for plan identity or subscription status.
