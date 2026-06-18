# Plan 018: Fix inbox pagination so cached and live pages use compatible tokens

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b12ae1..HEAD -- server/api/routers/gmail.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/016-establish-static-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `5b12ae1`, 2026-06-18

## Why this matters

The inbox route mixes Gmail API page tokens with cache-offset page tokens. After page 1 comes from the live API, page 2 is forced through the cache path and tries to parse Gmail's opaque token as a number. The result can be repeated messages, empty pages, or skipped messages.

## Current state

- Live inbox pagination returns Gmail's opaque token (`server/api/routers/gmail.ts:298-333`).
- Cached inbox pagination interprets `pageToken` as a numeric offset (`server/api/routers/gmail.ts:336-365`).
- The route forces any paginated request onto the cached branch (`server/api/routers/gmail.ts:1059-1067`).

Excerpts:

```ts
server/api/routers/gmail.ts:309-333
const list = await tenant.gmail.api.messages.list({ ..., pageToken });
...
return {
  messages,
  nextPageToken: list.nextPageToken ?? null,
};
```

```ts
server/api/routers/gmail.ts:347-365
const offset = pageToken ? Number(pageToken) : 0;
...
nextPageToken: filtered.length > nextOffset ? String(nextOffset) : null,
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Verification baseline | `pnpm verify` | exit 0 after plan 016 |
| Focused test | `pnpm exec tsx <new-test-file>` | exit 0 |

## Scope

**In scope**:
- `server/api/routers/gmail.ts`
- One focused regression test file for inbox pagination token handling

**Out of scope**:
- Sent pagination
- Archived pagination
- Gmail search ranking/triage logic

## Steps

### Step 1: Pick one token contract and apply it consistently

Choose a single valid strategy for inbox pagination. Either keep cache-only pagination tokens internal and never feed Gmail tokens into the cache path, or encode a source-aware token that explicitly distinguishes live vs cached pagination. Do not rely on `Number(pageToken)` for opaque Gmail tokens.

**Verify**: focused test covers a live first page followed by a second page.

### Step 2: Update the inbox route selection logic

Adjust `inbox` so page-2 requests continue with the correct source/token contract instead of unconditionally preferring the cached path whenever a token is present.

**Verify**: focused test proves page 2 does not repeat page 1 and does not go empty.

### Step 3: Add a narrow regression test

Cover cached pagination with offset-style tokens, live pagination with opaque Gmail-style tokens, and the transition from a live first page to a second page using the returned token.

**Verify**: `pnpm exec tsx <new-test-file>` exits 0.

## Test plan

- Follow the existing `tsx` + Node assert style.
- Cover live token round-trip, cached token round-trip, and the current mixed-source bug case.

Verification:

- `pnpm exec tsx <new-test-file>` → exit 0
- `pnpm verify` → exit 0

## Done criteria

- [ ] Inbox route no longer parses Gmail page tokens as numbers
- [ ] Page 2 after a live page 1 returns the correct next slice
- [ ] Focused regression test exists and passes
- [ ] `pnpm verify` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The UI depends on the current token shape in a way the router cannot change safely.
- A safe fix requires reworking sent/archive pagination too.
- The live Gmail plugin does not actually return stable opaque tokens in this environment.

## Maintenance notes

- Reviewers should inspect token shape changes carefully because this is a client-server contract.
