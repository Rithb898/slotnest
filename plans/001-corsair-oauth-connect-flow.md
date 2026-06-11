# Plan 001: Connect a user's Gmail + Google Calendar through Corsair (multi-tenant OAuth)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 63f0cb3..HEAD -- server/corsair.ts lib/config/env.ts server/auth/server.ts app/api`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction (core hackathon feature — unblocks all Gmail/Calendar work)
- **Planned at**: commit `63f0cb3`, 2026-06-12

## Why this matters

SlotNest is a Corsair hackathon project that must integrate Gmail and Google
Calendar **through Corsair** with real (non-hardcoded) data, or it is
disqualified. Corsair is already initialized in `server/corsair.ts` with the
`gmail()` and `googlecalendar()` plugins and `multiTenancy: true`, but **nothing
connects a user's account yet** — there is no OAuth flow, so every downstream
feature (inbox, calendar, agent chat) has no data to operate on. This plan
builds the per-user OAuth connect flow: a signed-in SlotNest user clicks
"Connect Gmail", authorizes via Google, and Corsair stores their encrypted
tokens scoped to their user ID. After this lands, any server code can call
`corsair.withTenant(userId).gmail.api.*` / `.googlecalendar.api.*` with that
user's real account.

## Background: how Corsair multi-tenant OAuth works

**Read `docs/corsair/concepts/oauth.md` and `docs/corsair/concepts/multi-tenancy.md`
in full before starting.** Summary of the contract this plan relies on:

- The `corsair/oauth` subpath exports two helpers:
  - `generateOAuthUrl(corsair, plugin, { tenantId, redirectUri })` → returns
    `{ url, state }`. `url` is the Google consent screen; `state` is an
    HMAC-signed string that encodes the `tenantId`.
  - `processOAuthCallback(corsair, { code, state, redirectUri })` → exchanges
    the code for tokens, stores them encrypted for the tenant, returns
    `{ plugin }` (the plugin that was connected).
- `tenantId` is any stable user id. **Here it is the better-auth
  `session.user.id`.**
- With `multiTenancy: true`, plugins can only be called via
  `corsair.withTenant(userId).<plugin>.api.*`. Calling `corsair.gmail.*`
  directly is a type error — do not do it.
- OAuth **app** credentials (client id/secret) are stored once, shared across
  tenants, via the Corsair CLI (a manual prerequisite — see Step 0). Per-user
  **tokens** are stored automatically by `processOAuthCallback`.

## Current state

Files involved and their current role:

- `server/corsair.ts` — the single Corsair instance. Plugins lack `authType`.
  Current full contents:
  ```ts
  import { gmail } from "@corsair-dev/gmail";
  import { googlecalendar } from "@corsair-dev/googlecalendar";
  import { createCorsair } from "corsair";
  import { env } from "@/lib/config/env";
  import { conn } from "./db";

  export const corsair = createCorsair({
    plugins: [gmail(), googlecalendar()],
    database: conn,
    kek: env.CORSAIR_KEK,
    multiTenancy: true,
  });
  ```
  Note: `conn` is the `postgres-js` client exported from `server/db/index.ts`.
  Do not change the `database`, `kek`, or `multiTenancy` fields.

- `lib/config/env.ts` — typed env via `@t3-oss/env-nextjs`. Every var is
  declared in BOTH the `server: {}` block and the `runtimeEnv: {}` block. There
  is **no `APP_URL` yet**. Current `server` block keys:
  `NODE_ENV, DATABASE_URL, CORSAIR_KEK, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, EMAIL_FROM`.
  Pattern to match (a single var appears twice):
  ```ts
  // inside server: { ... }
  BETTER_AUTH_URL: z.string(),
  // inside runtimeEnv: { ... }
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  ```

- `server/auth/server.ts` — the way to read the current session on the server.
  Full contents:
  ```ts
  import { headers } from "next/headers";
  import { cache } from "react";
  import { auth } from ".";

  export const getSession = cache(async () =>
    auth.api.getSession({ headers: await headers() }),
  );
  ```
  `getSession()` returns `null` when unauthenticated, otherwise an object whose
  `.user.id` is the SlotNest user id (the tenant id). Use THIS helper — do not
  introduce `getSessionCookie` or read cookies manually.

- `app/api/auth/[...all]/route.ts` — **better-auth owns `/api/auth/*`.** This is
  why the Corsair routes in this plan live under `/api/corsair/*`, NOT
  `/api/auth`. (The Corsair docs example uses `/api/auth`; that path is taken in
  this repo — do not follow the doc's path literally.) Existing route-handler
  style to match (a Next.js App Router Route Handler that exports HTTP verbs):
  ```ts
  import { toNextJsHandler } from "better-auth/next-js";
  import { auth } from "@/server/auth";

  export const { GET, POST } = toNextJsHandler(auth.handler);
  ```

- `app/page.tsx` — the app's root page; currently the Create-Next-App starter.
  This plan adds a small "Connections" UI in a new route (see Step 6). It is a
  Server Component by default in this Next version.

- tRPC is already fully wired (T3-style). The OAuth redirect routes do NOT use
  tRPC (browser redirects + cookies can't go through RPC), but the
  **connection-status query does**. Relevant files:
  - `server/api/trpc.ts` — defines `createTRPCRouter`, `publicProcedure`, and
    `protectedProcedure`. `protectedProcedure` guarantees `ctx.session.user` is
    non-null and also exposes `ctx.db` (the Drizzle client) and `ctx.session`.
  - `server/api/root.ts` — the root router. Currently **empty** (the `post`
    router is commented out):
    ```ts
    import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

    export const appRouter = createTRPCRouter({
      //   post: postRouter,
    });

    export type AppRouter = typeof appRouter;
    export const createCaller = createCallerFactory(appRouter);
    ```
  - `server/api/routers/post.ts` — the example router; use it as the structural
    pattern for a new router (imports `createTRPCRouter` + `protectedProcedure`
    from `@/server/api/trpc`, uses `zod` for input).
  - `trpc/server.ts` — exports `api` (a server-side caller) and `HydrateClient`
    for **React Server Components**. Call procedures directly:
    `import { api } from "@/trpc/server"; const x = await api.connections.list();`
  - `trpc/react.tsx` — exports `api` (React Query hooks) for **client
    components**. Not needed for this plan; the connections page reads status in
    the RSC via `@/trpc/server` and passes it to the client buttons as a prop.
  - `ctx.db` is a Drizzle instance whose schema includes the Corsair tables.
    Import the table objects from `@/server/db/schema` (e.g. `corsairAccounts`,
    `corsairIntegrations`) and `eq` from `drizzle-orm`.

Repo conventions to follow:
- Path alias `@/` maps to the repo root (e.g. `@/server/corsair`,
  `@/lib/config/env`). Use it for cross-directory imports.
- This is a **modified Next.js** — APIs may differ from training data. Before
  writing any Next-specific code (route handlers, `cookies()`, `redirect`,
  reading `request`), read the matching guide under
  `node_modules/next/dist/docs/` (per `AGENTS.md`). In particular confirm the
  Route Handler signature and how to set cookies on a `NextResponse`.
- For anything Corsair-related, `docs/corsair/` is the source of truth (per
  `AGENTS.md` / `CLAUDE.md`). Do not read `node_modules` for Corsair APIs; if a
  needed Corsair behavior is not documented there, treat it as a STOP condition.
- UI primitives live in `components/ui/*` (shadcn-style). The `Button` is a
  **base-ui** component WITHOUT an `asChild` prop — to render a link as a
  button, put `buttonVariants()` (exported from `@/components/ui/button`) as the
  `className` on a `next/link` `<Link>`, e.g.
  `<Link href="..." className={buttonVariants()}>`. (Confirmed convention — see
  `app/(auth)/reset-password/_components/reset-password-form.tsx`.)

## Commands you will need

| Purpose   | Command                  | Expected on success      |
|-----------|--------------------------|--------------------------|
| Install   | `pnpm install`           | exit 0                   |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no errors        |
| Lint      | `pnpm lint`              | exit 0 (runs `biome check`) |
| Build     | `pnpm build`             | exit 0 (`next build`)    |

There is **no test suite** in this repo (no `test` script, no test files).
Verification is typecheck + lint + build + the manual smoke test in "Test plan".

## Suggested executor toolkit

- Read `docs/corsair/concepts/oauth.md`, `docs/corsair/concepts/multi-tenancy.md`,
  and `docs/corsair/plugins/gmail/get-credentials.md` before Step 1.
- Before writing the Route Handlers, read the App Router route + middleware
  request/response docs under `node_modules/next/dist/docs/` to confirm the
  exact `cookies` API on `NextRequest`/`NextResponse` in this Next version.

## Scope

**In scope** (the only files you should modify or create):
- `server/corsair.ts` (modify — add `authType`)
- `lib/config/env.ts` (modify — add `APP_URL`)
- `app/api/corsair/connect/route.ts` (create)
- `app/api/corsair/callback/route.ts` (create)
- `server/api/routers/connections.ts` (create — tRPC status router)
- `server/api/root.ts` (modify — register the `connections` router)
- `app/(app)/connections/page.tsx` (create — the Connect UI; see Step 6)
- `app/(app)/connections/_components/connect-buttons.tsx` (create)
- `.env.example` (create or modify — document new env vars, NO real values)
- `plans/README.md` (update status row at the end)

**Out of scope** (do NOT touch, even though they look related):
- `server/auth/*` and `app/api/auth/[...all]/route.ts` — better-auth; unrelated
  to Corsair OAuth. Reusing `getSession` (read-only import) is fine; editing
  these files is not.
- `server/db/schema/corsair.ts` and any Drizzle migration — Corsair manages its
  own tables; this flow needs no schema change. (Step 5 *reads* `corsairAccounts`
  / `corsairIntegrations` via `ctx.db` — reading is fine; do NOT edit the schema
  or write a migration.)
- Reading/listing actual Gmail messages or Calendar events — that is the NEXT
  plan. This plan stops at "account connected and tokens stored".
- `proxy.ts` — its matcher does not include `/connections` or `/api/*`; leave it.

## Git workflow

- Branch: `advisor/001-corsair-oauth-connect-flow`.
- This repo has a single starter commit; commit style is not strongly
  established. Use clear conventional-style messages, e.g.
  `feat(corsair): add multi-tenant OAuth connect + callback routes`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0 (MANUAL PREREQUISITE — for the human operator, not code)

Corsair needs Google OAuth **app** credentials stored before the flow works at
runtime. This requires real secrets and a browser, so the executor cannot do it
— but the CODE in later steps can be written and typechecked without it.

The operator must, once:
1. Create a Google Cloud OAuth 2.0 **Web application** client with the Gmail +
   Calendar scopes and consent screen described in
   `docs/corsair/plugins/gmail/get-credentials.md` and
   `docs/corsair/plugins/googlecalendar/get-credentials.md`.
2. Add the redirect URI `${APP_URL}/api/corsair/callback` (e.g.
   `http://localhost:3000/api/corsair/callback` for local dev) to the client's
   Authorized redirect URIs.
3. Store the client id/secret in Corsair via the CLI (run from repo root):
   ```bash
   pnpm corsair setup --plugin=gmail client_id=... client_secret=...
   pnpm corsair setup --plugin=googlecalendar client_id=... client_secret=...
   ```
   (Gmail and Calendar may share one Google client if its consent screen
   includes both scope sets; if so, run setup for each plugin with the same
   values.)

**Executor**: do not attempt Step 0. Note in your hand-off that it is required
for the runtime smoke test. Proceed to Step 1 regardless.

### Step 1: Enable OAuth on the Corsair plugins

In `server/corsair.ts`, pass `{ authType: "oauth_2" }` to both plugin
factories. Change only the `plugins` array; leave `database`, `kek`,
`multiTenancy` untouched.

Target shape:
```ts
plugins: [
  gmail({ authType: "oauth_2" }),
  googlecalendar({ authType: "oauth_2" }),
],
```

**Verify**: `pnpm exec tsc --noEmit` → exit 0. (If `authType` is rejected by the
plugin's types, STOP — re-read `docs/corsair/plugins/gmail/get-credentials.md`
and `docs/corsair/concepts/oauth.md`; do not guess another option name.)

### Step 2: Add `APP_URL` to the typed env

In `lib/config/env.ts`, add `APP_URL: z.url()` to the `server: {}` block and
`APP_URL: process.env.APP_URL` to the `runtimeEnv: {}` block, matching the
existing two-place pattern shown in "Current state". `APP_URL` is the public
base URL of the app (no trailing slash), used to build the OAuth redirect URI.

Also create/update `.env.example` to document (with placeholder, NOT real
values): `APP_URL=http://localhost:3000`. If other vars are already documented
there, append; do not remove existing lines.

**Verify**: `pnpm exec tsc --noEmit` → exit 0. Then confirm both occurrences
exist: `grep -n "APP_URL" lib/config/env.ts` → exactly 2 matches.

### Step 3: Create the connect route — `app/api/corsair/connect/route.ts`

A `GET` Route Handler that:
1. Reads the session via `getSession()` from `@/server/auth/server`. If null,
   redirect to `/sign-in` (use the App Router redirect/response approach you
   confirmed from the Next docs).
2. Reads the `plugin` query param (`gmail` or `googlecalendar`). If missing or
   not one of those two values, return a 400 response.
3. Calls `generateOAuthUrl(corsair, plugin, { tenantId: session.user.id,
   redirectUri: \`${env.APP_URL}/api/corsair/callback\` })` (import
   `generateOAuthUrl` from `corsair/oauth`, `corsair` from `@/server/corsair`,
   `env` from `@/lib/config/env`).
4. Builds a redirect response to the returned `url`, and sets an httpOnly cookie
   `corsair_oauth_state` = the returned `state` with:
   `httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production",
   path: "/", maxAge: 600`.
5. Returns that response.

Follow the cookie/redirect pattern from the Corsair doc
`docs/corsair/concepts/oauth.md` §"2. Generate the authorization URL", adapted
to this repo's route path and the `getSession` helper.

**Verify**: `pnpm exec tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 4: Create the callback route — `app/api/corsair/callback/route.ts`

A `GET` Route Handler that:
1. Reads `code` and `state` from the request URL search params. If either is
   missing, delete the `corsair_oauth_state` cookie and return a 400.
2. Reads the `corsair_oauth_state` cookie. If absent or `!== state`, delete the
   cookie and return a 400 ("Invalid state").
3. Calls `processOAuthCallback(corsair, { code, state, redirectUri:
   \`${env.APP_URL}/api/corsair/callback\` })` (import from `corsair/oauth`).
4. On success: redirect to `/connections?connected=${result.plugin}` and delete
   the `corsair_oauth_state` cookie.
5. On thrown error: delete the cookie and redirect to
   `/connections?error=oauth_failed` (do not leak the error message to the
   client; `console.error` it server-side).

Follow `docs/corsair/concepts/oauth.md` §"3. Handle the callback".

**Verify**: `pnpm exec tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 5: Add the `connections` tRPC status router

Create `server/api/routers/connections.ts`, modeled structurally on
`server/api/routers/post.ts`. It exposes one `protectedProcedure` query,
`list`, that returns which Corsair plugins the current user has connected.

Behavior:
- Import `createTRPCRouter` and `protectedProcedure` from `@/server/api/trpc`,
  `corsairAccounts` and `corsairIntegrations` from `@/server/db/schema`, and
  `eq` from `drizzle-orm`.
- `list`: query `ctx.db` for rows in `corsairAccounts` where
  `tenantId === ctx.session.user.id`, joined to `corsairIntegrations` on
  `corsairAccounts.integrationId = corsairIntegrations.id`, selecting the
  integration `name`. Return a deduplicated `string[]` of connected integration
  names. Target shape:
  ```ts
  export const connectionsRouter = createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ name: corsairIntegrations.name })
        .from(corsairAccounts)
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(eq(corsairAccounts.tenantId, ctx.session.user.id));
      return [...new Set(rows.map((r) => r.name))];
    }),
  });
  ```

Then register it in `server/api/root.ts`:
```ts
import { connectionsRouter } from "@/server/api/routers/connections";
// ...
export const appRouter = createTRPCRouter({
  connections: connectionsRouter,
});
```

> **Assumption to verify at runtime, not now**: the integration `name` stored by
> Corsair is expected to be `"gmail"` / `"googlecalendar"` (matching the plugin
> keys). The UI in Step 6 compares against those literals. If, after a real
> connection (Step 0 + smoke test), the `name` values differ, that is a STOP
> condition — report the actual values so the comparison can be corrected. Do
> NOT hardcode a guess beyond these two literals.

**Verify**: `pnpm exec tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 6: Build the Connections UI

Create a route group page so the connect buttons have a home. Use
`app/(app)/connections/page.tsx` (a new `(app)` route group for authenticated
app pages; this keeps it separate from the existing `(auth)` group). The page:
- Is a Server Component. Calls `getSession()`; if null, redirect to `/sign-in`.
- Reads connection status via the server-side tRPC caller:
  `import { api } from "@/trpc/server";` then
  `const connected = await api.connections.list();` (returns `string[]`).
- Renders a heading and the client child
  `<ConnectButtons connected={connected} />`, wrapped in a `<Suspense>`
  boundary (the child uses `useSearchParams()`), matching
  `app/(auth)/reset-password/page.tsx`.

Create `app/(app)/connections/_components/connect-buttons.tsx` (`"use client"`),
accepting `{ connected: string[] }`:
- For each of `gmail` and `googlecalendar`: if `connected.includes(<key>)`,
  show a "Connected ✓" disabled/secondary state; otherwise a link styled as a
  button (use `buttonVariants()` on `next/link` `<Link>`, per the convention in
  "Current state" — `Button` has no `asChild`):
  - `href="/api/corsair/connect?plugin=gmail"` → "Connect Gmail"
  - `href="/api/corsair/connect?plugin=googlecalendar"` → "Connect Google Calendar"
- Read `useSearchParams()` for `connected` / `error` query params and show a
  `toast` (the project uses `sonner` — `import { toast } from "sonner"`,
  already a dependency; see its use in
  `app/(auth)/sign-in/_components/signin-fom.tsx`). Note the `?connected=` query
  param (a one-shot success flag from the callback) is distinct from the
  `connected` prop (the persisted status list) — don't conflate them.

**Verify**: `pnpm exec tsc --noEmit` → exit 0; `pnpm lint` → exit 0;
`pnpm build` → exit 0.

## Test plan

No automated test suite exists; do not add a test framework in this plan.
Verification is the build/typecheck/lint gates above plus this manual smoke test
(requires Step 0 done and `pnpm dev` running with `APP_URL` set):

1. Sign in, navigate to `/connections`.
2. Click "Connect Gmail" → you are redirected to Google's consent screen for the
   Gmail scopes.
3. Approve → you land back on `/connections?connected=gmail` and see a success
   toast.
4. In a DB client, confirm a row now exists in `corsair_accounts` with
   `tenant_id` = your user id (do not print token/dek values).
5. Repeat for "Connect Google Calendar".

Record in the hand-off whether the smoke test was run or deferred (it depends on
the operator completing Step 0).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `server/corsair.ts` passes `authType: "oauth_2"` to both `gmail(` and
      `googlecalendar(` — `grep -n "authType" server/corsair.ts` → 2 matches
- [ ] `grep -n "APP_URL" lib/config/env.ts` → 2 matches
- [ ] Files `app/api/corsair/connect/route.ts` and
      `app/api/corsair/callback/route.ts` exist and export a `GET` handler
- [ ] `server/api/routers/connections.ts` exists; `server/api/root.ts`
      registers it — `grep -n "connections" server/api/root.ts` → ≥1 match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts (especially `server/corsair.ts`,
  `lib/config/env.ts`, `server/auth/server.ts`) don't match the live code — the
  repo has drifted since commit `63f0cb3`.
- `authType: "oauth_2"` is not accepted by the plugin types, OR `corsair/oauth`
  does not export `generateOAuthUrl` / `processOAuthCallback` as the docs
  describe. Do NOT search `node_modules` or invent an alternative — report that
  `docs/corsair/` and the installed package disagree so the operator can update
  the docs.
- A verification command fails twice after a reasonable fix attempt.
- The flow appears to require editing an out-of-scope file (e.g. a Corsair
  schema/migration change) — that signals a wrong assumption.
- The Next.js Route Handler / cookie API differs from what the docs under
  `node_modules/next/dist/docs/` describe in a way the plan didn't anticipate.

## Maintenance notes

For whoever owns this next:

- **This plan stops at "connected".** The next plan reads data:
  `corsair.withTenant(userId).gmail.api.messages.list(...)` and
  `.googlecalendar.api.*`. It will depend on this one.
- The OAuth redirect URI is derived from `APP_URL`. When deploying, `APP_URL`
  must exactly match a redirect URI registered in the Google Cloud OAuth client,
  or Google returns `redirect_uri_mismatch`. Document the prod URL in Step 0's
  checklist when you deploy.
- Reviewer should scrutinize: (a) the `state` cookie is httpOnly and validated
  before `processOAuthCallback`; (b) `tenantId` is always `session.user.id`,
  never a client-supplied value; (c) the callback never echoes the raw error to
  the client.
- Token refresh is automatic (Corsair handles expiry) — no cron needed.
- The connection-status query (`connections.list`) reads Corsair's own
  `corsair_accounts`/`corsair_integrations` tables directly via Drizzle. If a
  future Corsair version changes those table/column names, this query breaks —
  it is coupled to Corsair's internal schema by design (there's no public
  "list my connections" SDK call documented in `docs/corsair/`).
- All future Gmail/Calendar data procedures should follow the same tRPC pattern:
  `protectedProcedure` → `corsair.withTenant(ctx.session.user.id).<plugin>.api.*`.
  The OAuth redirect routes stay as Route Handlers; everything that reads/acts on
  data goes through tRPC.
