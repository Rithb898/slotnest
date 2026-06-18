# Plan 019: Make calendar availability and free-slot math honor the requested timezone

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b12ae1..HEAD -- server/api/routers/calendar.ts server/api/agent/tools.ts lib/prompts.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/016-establish-static-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `5b12ae1`, 2026-06-18

## Why this matters

The product explicitly promises availability answers in the user's local timezone, but both the app router and chat tools build day windows with the server runtime timezone. For users outside the server timezone, "Thursday 9 to 5" can shift to the wrong wall-clock window, producing incorrect open slots and wrong meeting proposals.

## Current state

- Prompt contract says availability defaults to the user's local timezone (`lib/prompts.ts:49-50,96-97`).
- `calendar.availability` passes `timeZone` to Corsair, but then builds daily windows with plain `Date` and `setHours()` in server time (`server/api/routers/calendar.ts:220-289`).
- Chat duplicates the same bug in `getFreeSlots()` (`server/api/agent/tools.ts:367-439`).

Excerpts:

```ts
server/api/routers/calendar.ts:220-289
const res = await tenant.googlecalendar.api.calendar.getAvailability({ ..., timeZone: input?.timeZone });
...
const day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
windowStart.setHours(dayStartHour, 0, 0, 0);
windowEnd.setHours(dayEndHour, 0, 0, 0);
```

```ts
server/api/agent/tools.ts:367-439
const res = await tenant.googlecalendar.api.calendar.getAvailability({ ..., timeZone });
...
const day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
windowStart.setHours(dayStartHour, 0, 0, 0);
windowEnd.setHours(dayEndHour, 0, 0, 0);
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Verification baseline | `pnpm verify` | exit 0 after plan 016 |
| Focused test | `pnpm exec tsx <new-test-file>` | exit 0 |

## Scope

**In scope**:
- `server/api/routers/calendar.ts`
- `server/api/agent/tools.ts`
- One small shared helper file if needed
- One focused regression test file

**Out of scope**:
- Invite dialog formatting
- General date-display formatting across the UI

## Steps

### Step 1: Extract or introduce one timezone-safe free-slot helper

Move the "invert busy intervals into free slots" logic into a shared helper used by both `calendar.availability` and chat `getFreeSlots()`. The helper must honor the requested `timeZone` when deriving each day's work window.

**Verify**: focused test covers at least one non-server timezone case.

### Step 2: Update both call sites to use the same helper

Replace the duplicated logic so the app route and chat agent produce the same slots for the same input. Preserve existing defaults for `minMinutes`, `dayStartHour`, and `dayEndHour`.

**Verify**: focused test shows matching outputs across both call paths or the shared helper seam they use.

### Step 3: Add regression coverage for cross-timezone day boundaries

Cover a user timezone ahead of the server timezone, a user timezone behind the server timezone, and busy intervals near midnight where the wrong local day would previously be chosen.

**Verify**: `pnpm exec tsx <new-test-file>` exits 0.

## Test plan

- Follow the existing `tsx` + Node assert style.
- Cover same-day working window in a named timezone, no negative slots, and identical slot calculation for app router and chat helper.

Verification:

- `pnpm exec tsx <new-test-file>` → exit 0
- `pnpm verify` → exit 0

## Done criteria

- [ ] Slot generation honors the provided timezone
- [ ] App route and chat use the same slot-generation logic
- [ ] Cross-timezone regression tests exist and pass
- [ ] `pnpm verify` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The current runtime/framework does not expose enough timezone support to compute local-day windows correctly without adding a dependency.
- The two call sites require intentionally different business rules.
- Fixing this safely also requires changing user-facing date formatting contracts beyond the scoped server logic.

## Maintenance notes

- Reviewers should scrutinize DST and named-timezone handling, not just UTC offsets.
