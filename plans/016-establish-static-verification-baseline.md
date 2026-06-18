# Plan 016: Establish a supported static verification baseline without `dev` or `build`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5b12ae1..HEAD -- README.md package.json components/ui app/layout.tsx server/auth/actions.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `5b12ae1`, 2026-06-18

## Why this matters

The repo currently has no reliable verification contract for executor agents. `README.md` is still the stock create-next-app template, `package.json` has no `typecheck` or `test` script, and the only repo-wide lint command currently fails in shared UI/auth files. Every follow-up plan in this batch needs a known-good static verification path that does not rely on `pnpm dev` or `pnpm build`.

## Current state

- `README.md` still tells developers to run the dev server (`README.md:1-36`).
- `package.json` has `lint`, `format`, DB, and embeddings scripts, but no explicit `typecheck`, `test`, or `verify` flow (`package.json:5-17`).
- Repo-wide `pnpm lint` currently fails in shared primitives and auth/layout files.

Excerpts:

```text
README.md:1-15
This is a [Next.js] project bootstrapped with create-next-app.
...
First, run the development server:
pnpm dev
```

```json
package.json:5-17
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check",
  "format": "biome format --write",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio",
  "embeddings:backfill": "tsx scripts/backfill-message-embeddings.ts",
  "embeddings:backfill-sent": "tsx scripts/backfill-sent-embeddings.ts"
}
```

Repo conventions to match:

- Use `pnpm`.
- Prefer static verification only; do not add `dev`/`build` instructions.
- Existing focused tests use `tsx` + Node assert, for example `lib/admin.test.ts` and `lib/gmail-reply-raw.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Current lint baseline | `pnpm lint` | currently fails; record current blockers before editing |
| Current type baseline | `pnpm exec tsc --noEmit --pretty false` | may currently fail or be slow; record current behavior before editing |
| Focused unit-test pattern | `pnpm exec tsx lib/admin.test.ts` | exit 0 |
| New baseline command | `pnpm verify` | exit 0 after this plan lands |

## Scope

**In scope**:
- `package.json`
- `README.md`
- Any small helper script(s) added under `scripts/` solely to support static verification
- The minimum code needed to make the supported baseline green

**Out of scope**:
- Product logic in `server/api/routers/*`
- Running `pnpm dev` or `pnpm build`
- Large refactors across unrelated UI primitives

## Git workflow

- Branch: `advisor/016-verification-baseline`
- Commit per logical unit.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Define the supported verification contract in `package.json`

Add explicit scripts for repo typecheck, unit-test execution for existing `tsx`-style tests, and one top-level `verify` command that chains only the supported static checks. If repo-wide Biome cannot be made green cheaply, define a named supported alternative such as a curated wrapper script; do not pretend `pnpm lint` is green if it is not.

**Verify**: `pnpm run` shows the new verification scripts.

### Step 2: Make the supported static baseline actually pass

Fix only the minimum code needed so the newly documented verification commands exit 0. The audit evidence currently points at shared UI/auth/layout files as the blockers, so expect to touch a narrow set there.

**Verify**: `pnpm verify` exits 0.

### Step 3: Replace the stock README workflow with the real one

Rewrite the top of `README.md` so a fresh executor learns the real stack, the no-`dev`/no-`build` workflow for agent work, and the supported verification command(s).

**Verify**: `rg -n "create-next-app|pnpm dev|npm run dev" README.md` returns no matches.

## Test plan

- Reuse the existing `tsx` + Node assert test style.
- Verify at least one existing focused test still runs, modeled after `lib/admin.test.ts`.

Verification:

- `pnpm verify` → exit 0
- `pnpm exec tsx lib/admin.test.ts` → exit 0

## Done criteria

- [ ] `package.json` defines an explicit static verification workflow
- [ ] `pnpm verify` exits 0
- [ ] `README.md` documents the real workflow for this repo
- [ ] The README no longer tells executors to run `dev`
- [ ] No files outside the in-scope list are modified except the minimum blockers required to make the supported baseline pass
- [ ] `plans/README.md` status row updated

## STOP conditions

- `pnpm verify` can only be made green by touching broad product areas outside the baseline blockers.
- The real blocker is a framework/tooling incompatibility that requires dependency upgrades.
- A green baseline would require running `dev` or `build`.

## Maintenance notes

- Subsequent plans in this batch assume this verification contract exists.
- Reviewers should check that the new scripts are honest and not merely narrowed to hide important failures.
