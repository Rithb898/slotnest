# Plan 017: Charge Chat AI budget consistently for both chat turns and voice rewrites

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b12ae1..HEAD -- server/api/routers/chat.ts server/billing/ai-action-budget.ts plans/README.md`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/016-establish-static-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `5b12ae1`, 2026-06-18

## Why this matters

The plan index says the shared AI action budget already covers `chat.send`, but the live code does not reserve budget before the main chat model call or the follow-up voice rewrite call. Chat can therefore consume paid/free model usage without decrementing the ledger, which breaks product limits and billing trust.

## Current state

- `plans/README.md` claims plan 013 already added server-side charging for `chat.send` (`plans/README.md:24,64`).
- `server/api/routers/chat.ts` calls `run(agent, ...)` twice without any `reserveAiActionBudget(...)` guard:
  - `draftReplyInVoice()` at `server/api/routers/chat.ts:157-195`
  - main `chat.send` path at `server/api/routers/chat.ts:447-468`
- Other AI entry points already reserve budget:
  - `server/api/routers/agent.ts:166-170`
  - `server/api/routers/gmail.ts:1647-1651`
  - `server/api/routers/workspace.ts:163-167`

Excerpts:

```ts
server/api/routers/chat.ts:194-195
const result = await run(agent, withCurrentTimeContext(prompt));
return cleanBody(result.finalOutput ?? "") || proposal.body;
```

```ts
server/api/routers/chat.ts:447-468
const tenant = corsairReadonly.withTenant(userId);
...
const result = await run(agent, withCurrentTimeContext(agentInput));
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Verification baseline | `pnpm verify` | exit 0 after plan 016 |
| Focused test | `pnpm exec tsx <new-test-file>` | exit 0 |

## Scope

**In scope**:
- `server/api/routers/chat.ts`
- One new focused test file for the budget reservation logic

**Out of scope**:
- Billing UI
- Non-chat AI entry points
- Changing budget limits or copy

## Git workflow

- Branch: `advisor/017-chat-budget`

## Steps

### Step 1: Reserve budget for the main `chat.send` model call

Add a reservation immediately before the main `run(agent, ...)` call in `chat.send`, matching the pattern already used in `agent.ask` and `gmail.draftReply`. Use a distinct `actionKind`/`source` string that clearly identifies the chat turn.

**Verify**: focused test proves the reservation happens before the model call.

### Step 2: Reserve budget for the voice rewrite path

`draftReplyInVoice()` currently makes a second model call when Chat emits a reply proposal. Reserve budget there too, with a separate action kind so usage is attributable. Keep the existing fallback to `proposal.body` if the model returns empty text.

**Verify**: focused test covers the reply-proposal path and asserts that both reservations are recorded/applied.

### Step 3: Prevent silent regressions with a narrow test seam

Add a focused test that exercises:

- plain chat turn with one model call
- reply-proposal flow with the extra voice rewrite call
- exhausted-budget behavior propagating instead of silently running the model

If direct router testing is too heavy, extract the minimum helper(s) needed to test the sequencing with dependency injection. Keep the extraction narrow.

**Verify**: `pnpm exec tsx <new-test-file>` exits 0.

## Test plan

- Model test structure after `lib/admin.test.ts` / `lib/gmail-reply-raw.test.ts`.
- Cover one reservation for normal chat, two reservations for reply-proposal flow, and no model call when reservation throws exhausted-budget.

Verification:

- `pnpm exec tsx <new-test-file>` → exit 0
- `pnpm verify` → exit 0

## Done criteria

- [ ] `chat.send` reserves budget before its model call
- [ ] `draftReplyInVoice()` reserves budget before its model call
- [ ] Focused regression test exists and passes
- [ ] `pnpm verify` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- Chat budget charging turns out to be intentionally omitted for product reasons not reflected in `plans/README.md`.
- Adding the reservation requires a cross-cutting billing redesign rather than a localized fix.
- A reliable focused test cannot be added without introducing a broader test harness.

## Maintenance notes

- Reviewers should specifically check ordering: reserve first, then call the model.
