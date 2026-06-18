# Plan 020: Make calendar reads freshness-aware in the no-webhook architecture

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b12ae1..HEAD -- server/api/routers/calendar.ts server/api/agent/tools.ts docs/demo-story.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/016-establish-static-verification-baseline.md, plans/019-make-availability-timezone-safe.md
- **Category**: bug
- **Planned at**: commit `5b12ae1`, 2026-06-18

## Why this matters

This repo intentionally avoids webhook-driven freshness, but the current calendar read paths still treat any non-empty cache as authoritative. The user can create, move, or receive a new event and never see it in `/today`, `/calendar`, or chat scheduling until some unrelated cache refresh happens.

## Current state

- Product story sells live calendar awareness and approval-first scheduling (`docs/demo-story.md:33-40`, `docs/demo-story.md:98-110`).
- `calendar.events` prefers cached rows whenever any cached match exists (`server/api/routers/calendar.ts:172-186`).
- Chat `getCalendarEvents()` does the same thing (`server/api/agent/tools.ts:282-347`).

Excerpts:

```ts
server/api/routers/calendar.ts:172-186
const cached = input?.forceFresh ? [] : await getCachedEvents(...);
const events =
  cached.length > 0
    ? cached
    : await getLiveEvents(...);
```

```ts
server/api/agent/tools.ts:330-347
if (normalizedCached.length > 0) {
  return normalizedCached;
}
const live = await tenant.googlecalendar.api.events.getMany(...);
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
- One small shared freshness helper or policy helper if needed
- One focused regression test file

**Out of scope**:
- Webhook subscription or ingest work
- Gmail cache freshness
- Big UI redesigns

## Steps

### Step 1: Define an explicit freshness policy for calendar reads

Choose and implement one explicit policy that fits the no-webhook design, for example time-bounded cache reuse with live fallback after staleness, merge cached rows with live reads for the requested window, or force live reads for narrow user-facing windows while retaining cache for broader/background use. Document the chosen rule in code comments where the fallback decision happens.

**Verify**: focused test covers a stale-cache case and shows the route falls back to live data.

### Step 2: Apply the same freshness rule to chat scheduling reads

`/calendar`, `/today`, and chat should not disagree about whether the user's calendar is current. Reuse the same freshness policy/helper in `server/api/agent/tools.ts`.

**Verify**: focused test shows route and chat helper make the same freshness decision for the same inputs.

### Step 3: Preserve DB-first behavior where it still helps

Keep the benefits of local cache where valid: connected-state checks, broad cached reads, and graceful fallback when live calls fail. The fix should not turn every call into a blind live-only read.

**Verify**: focused test covers both "cache good enough" and "cache stale, use live" branches.

## Test plan

- Follow the existing `tsx` + Node assert style.
- Cover non-empty fresh cache stays on cache, non-empty stale cache refreshes from live, and live failure degrades predictably if cached data is available.

Verification:

- `pnpm exec tsx <new-test-file>` → exit 0
- `pnpm verify` → exit 0

## Done criteria

- [ ] Calendar route has an explicit freshness policy instead of "any cached rows win"
- [ ] Chat calendar reads use the same policy
- [ ] Focused regression tests exist and pass
- [ ] `pnpm verify` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The cached event rows do not contain enough metadata to judge staleness or merge safely.
- A correct fix requires broader schema changes that do not fit this plan.
- Live provider reads are too slow or unreliable to use as the fallback path.

## Maintenance notes

- Reviewers should ensure this remains a no-webhook solution.
