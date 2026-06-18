# Plan 014: Add a hardcoded admin-only settings tab for user search and manual subscription upgrades

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat f7f2004..HEAD -- app/(app)/settings/page.tsx app/(app)/settings/_components/settings-client.tsx server/api/root.ts server/api/trpc.ts server/api/routers server/db/schema/auth.ts server/db/schema/billing.ts lib`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 012, 013
- **Category**: direction
- **Planned at**: commit `f7f2004`, 2026-06-18

## Why this matters

SlotNest currently has no operator/admin surface for subscription support.
You need a controlled way to look up users and manually upgrade their plan
without touching the database by hand. The requested behavior is intentionally
small: a single hardcoded email address unlocks an extra Settings tab, and that
tab lets you search all platform users and upgrade any one of them.

This must be server-gated, not just hidden in the client, because the action is
security-sensitive and changes billing state. The change should stay inside the
existing settings surface and reuse the current billing tables and styling
patterns instead of adding a separate admin app.

## Current state

- `server/db/schema/auth.ts` already has a non-null, unique `user.email`, so a
  hardcoded allowlist can compare against the signed-in session email without a
  schema change.
  ```ts
  export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
  });
  ```
- `app/(app)/settings/page.tsx` currently streams only `connections.list()` and
  `billing.summary()` into the client settings shell.
  ```ts
  async function SettingsData() {
    const [connected, billing] = await Promise.all([
      api.connections.list(),
      api.billing.summary(),
    ]);
    return <SettingsClient billing={billing} connected={connected} />;
  }
  ```
- `app/(app)/settings/_components/settings-client.tsx` currently exposes only
  four tabs: `connections`, `billing`, `trust`, and `account`. There is no
  admin gate or admin tab today.
  ```ts
  type SettingsTab = "connections" | "billing" | "trust" | "account";
  ...
  <TabsList className="w-full flex-wrap justify-start gap-1 sm:w-auto">
    <TabsTrigger value="connections" className="flex-1">...</TabsTrigger>
    <TabsTrigger value="billing" className="flex-1">...</TabsTrigger>
    <TabsTrigger value="trust" className="flex-1">...</TabsTrigger>
    <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
  </TabsList>
  ```
- `server/api/root.ts` already registers the existing routers, so the new admin
  surface belongs in a separate router file and then gets wired in here.
  ```ts
  export const appRouter = createTRPCRouter({
    agent: agentRouter,
    calendar: calendarRouter,
    chat: chatRouter,
    billing: billingRouter,
    connections: connectionsRouter,
    gmail: gmailRouter,
    workspace: workspaceRouter,
  });
  ```
- `server/api/trpc.ts` only enforces authentication through `protectedProcedure`;
  it does not know anything about an allowed admin email. The admin check must
  be layered on top of that.
- `server/db/schema/billing.ts` is the canonical subscription table. Manual
  upgrades must update this table, not a parallel store.
  ```ts
  export const subscription = pgTable("subscription", {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    referenceId: text("reference_id").notNull(),
    razorpayCustomerId: text("razorpay_customer_id"),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    status: text("status").default("created").notNull(),
    ...
  });
  ```
- Existing reusable UI primitives already cover what this tab needs: `Input`
  (`components/ui/input.tsx`), `Table` (`components/ui/table.tsx`), `Button`,
  `Badge`, and the current tab shell in the settings client. Do not invent a new
  design system.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Typecheck | `pnpm exec tsc --noEmit`    | exit 0, no errors   |
| Lint      | `pnpm lint`                | exit 0              |
| Test      | `pnpm exec tsx lib/admin.test.ts` | exit 0, assertions pass |

Do **not** run `dev` or `build` commands.

## Suggested executor toolkit

- Read `app/(app)/settings/_components/settings-client.tsx`, `server/api/root.ts`,
  `server/api/trpc.ts`, `server/db/schema/auth.ts`, and
  `server/db/schema/billing.ts` before editing.
- Reuse the existing `Tabs`, `Input`, `Table`, `Badge`, and `Button` primitives
  rather than adding new dependencies.

## Scope

**In scope** (the only files you should modify or create):
- `lib/admin.ts` (create - hardcoded allowlist helper; default `null`)
- `lib/admin.test.ts` (create - verify the gate helper)
- `app/(app)/settings/page.tsx` (modify - fetch session and compute admin flag)
- `app/(app)/settings/_components/settings-client.tsx` (modify - show/hide admin tab and render admin panel)
- `server/api/routers/admin.ts` (create - server-gated user search + upgrade mutation)
- `server/api/root.ts` (modify - register the admin router)
- `plans/README.md` (update index row/status only)

**Out of scope** (do NOT touch, even though they look related):
- `server/db/schema/auth.ts` - no schema migration, no role column, no DB-backed allowlist.
- `server/db/schema/billing.ts` - do not change the subscription schema.
- `server/api/routers/billing.ts` - keep the existing public billing flow untouched.
- Razorpay checkout, callbacks, or webhooks - this plan is only for manual ops.
- Any new settings tab visible to non-admin users - the new tab must stay hidden unless the hardcoded email matches.
- Any client-side-only authorization check - the server must enforce the same gate.

## Git workflow

- Branch: follow the repo's usual `codex/` prefix if you create one, but do not
  change branches unless the operator asks.
- Commit style: match the repo's existing conventional commits if a commit is
  needed later.
- Do **not** push or open a PR from this plan.

## Steps

### Step 1: Add the server-only admin gate helper

Create `lib/admin.ts` with a single hardcoded email constant and a helper that
normalizes email comparison. Keep the default value `null` so the admin tab is
disabled until the maintainer fills the email in. The helper should return
`false` when the allowlist is unset, and it should compare case-insensitively
after trimming the session email.

Add `lib/admin.test.ts` with a tiny Node `assert`-based test file that proves:

- `null` allowlist returns `false`
- matching email returns `true`
- mismatched email returns `false`
- comparison is case-insensitive

**Verify**: `pnpm exec tsx lib/admin.test.ts` -> exit 0, no assertion failures.

### Step 2: Thread the admin flag through the settings page

Update `app/(app)/settings/page.tsx` to read the current session on the server
with the existing `getSession()` helper and compute `isAdmin` from the session
email and `lib/admin.ts`.

Pass `isAdmin` down to `SettingsClient`. Keep the streamed shell and existing
`connections` / `billing` data flow intact.

Update `app/(app)/settings/_components/settings-client.tsx` so:

- `SettingsTab` includes an `admin` value
- the tab is only rendered when `isAdmin` is true
- `tab=admin` in the URL is ignored unless `isAdmin` is true
- when `isAdmin` is false, the current tabs behave exactly as before

Use the existing tab styling and keep the admin tab visually consistent with the
other settings tabs.

**Verify**: `pnpm lint` -> exit 0, no style or import errors in the touched
settings files.

### Step 3: Add a server-gated admin router for user search and upgrades

Create `server/api/routers/admin.ts` and gate every procedure with both
`protectedProcedure` and the shared admin helper. Non-admin callers should get
`FORBIDDEN`.

Add one query for user lookup:

- search by name or email
- server-side pagination
- return only the fields the UI needs, plus the current subscription summary
- keep the query bounded; do not load the entire user table into the client

Add one mutation for manual plan upgrades:

- target a specific user by id
- upsert the user's `subscription` row if needed
- set the plan to `pro`
- set a paid status that the existing billing code treats as active
- keep the manual override independent of Razorpay by not creating or fetching a
  Razorpay subscription
- if the user already has a subscription row, update that row instead of
  creating duplicates

Use the existing billing constants and subscription shape as the source of
truth. Do not add a new billing model.

Register the new router in `server/api/root.ts`.

**Verify**: `pnpm exec tsc --noEmit` -> exit 0, no type errors from the new
router or root registration.

### Step 4: Build the admin panel UI inside Settings

Add an admin-only panel component to the settings surface. Keep it within the
existing settings route/component tree, and use the same card and table rhythm
already used on the page.

The panel should include:

- a search field
- a results table of users
- the current subscription/plan state per row
- an `Upgrade to Pro` action for each user that is not already on Pro
- loading, empty, and error states that match the project's existing tone

Use the existing `Input`, `Table`, `Button`, and `Badge` primitives. Keep the
implementation server-side searchable, and wire the action to the new admin
mutation.

After a successful upgrade, refresh the list and surface a compact confirmation
toast. If the mutation fails, show a direct error message and do not partially
update the table.

**Verify**: `pnpm lint` -> exit 0, and the new panel files remain within the
existing style system.

### Step 5: Update the plan index and confirm the repo stays clean

Update `plans/README.md` with the new plan row and dependency note. Keep the
status row aligned with the other entries in the table and do not rewrite the
existing plan history.

Then do a final repo-level check that only the intended files changed.

**Verify**:

- `git status --short` -> only the scoped plan files and the intended source
  files are modified
- `pnpm exec tsc --noEmit` -> exit 0
- `pnpm lint` -> exit 0

## Test plan

- Add `lib/admin.test.ts` as the small regression test for the hardcoded email
  gate.
- If the admin router naturally yields a pure helper for subscription payload
  shaping, test that helper too. Otherwise, keep the router verified through
  typecheck and lint only.
- Do not add broad integration tests unless the repo already has a lightweight
  pattern for them.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] A single hardcoded email gate exists in `lib/admin.ts` and defaults to
      `null`
- [ ] The Settings page only shows the new admin tab to the allowed email
- [ ] The server rejects non-admin access to the admin search/upgrade actions
- [ ] The admin tab can search users and upgrade a user's subscription to Pro
- [ ] No DB schema or migration files were added
- [ ] `pnpm exec tsx lib/admin.test.ts` exits 0
- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts
  (the codebase has drifted since this plan was written).
- You find a pre-existing admin/user-management router that already owns this
  surface; do not create a duplicate admin API.
- The existing billing summary logic makes a manual subscription override
  impossible without touching Razorpay or a schema migration. If so, stop and
  state the smallest extra change required.
- The admin gate would have to live in client-only code to work. It must remain
  server-enforced.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The hardcoded email gate is intentionally simple and fragile. Review it when
  the maintainer email changes, and keep it in server-only code.
- Future billing changes should preserve the manual admin override path unless
  the product formally replaces it with a role system or a proper ops console.
- Reviewers should pay special attention to the server-side authorization check
  and to the subscription upsert behavior. The highest-risk bug here is a
  client-only gate that looks hidden but remains callable by another user.
