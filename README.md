# SlotNest

SlotNest is a Next.js 16 app for a quieter inbox and calendar workflow. It combines a public marketing site with an authenticated workspace for Gmail and Google Calendar triage, replies, scheduling, and approval-gated actions.

## What it does

- Public landing page with product sections and signup links
- Authentication flows for sign in, sign up, password reset, and email verification
- Protected app shell with sidebar navigation and a global command bar
- Workspace views for:
  - Today
  - Chat
  - Inbox
  - Drafts
  - Waiting
  - Calendar
  - Archive
  - Sent
  - Settings
- Gmail and Google Calendar connection flows through Corsair
- Approval-first outbound actions for replies and calendar invites
- AI action budget tracking and billing-aware gating

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- tRPC
- Better Auth
- Drizzle ORM
- Tailwind CSS v4
- shadcn-style component set
- Corsair integrations for Gmail and Google Calendar
- Qdrant for embeddings / retrieval

## Project Structure

- `app/` - route groups, pages, layouts, and API routes
- `components/` - shared UI, shell, and landing page components
- `server/` - auth, tRPC routers, billing, email, database, and integration logic
- `plans/` - product and implementation plans
- `docs/corsair/` - integration docs for Corsair-related flows

## Key Routes

- `/` - public landing page
- `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` - auth pages
- `/today` - workspace home
- `/chat` - conversational triage and action entry point
- `/inbox` - mail triage
- `/drafts` - draft review
- `/waiting` - follow-up queue
- `/calendar` - scheduling views
- `/sent` - sent mail history
- `/archive` - archived items
- `/settings` - account, billing, and connections

## Auth and Routing

- The public auth routes are handled under `app/(auth)/`
- Signed-in app routes live under `app/(app)/`
- `proxy.ts` redirects unauthenticated users away from protected app routes and sends them to `/sign-in`
- `app/(app)/layout.tsx` also enforces the server-side auth boundary for the workspace shell

## Integrations

- Better Auth powers authentication
- Corsair powers Gmail and Google Calendar connections
- The API surface includes auth, tRPC, and Corsair callback/connect routes

## Scripts

Use `pnpm` for all commands.

- `pnpm typecheck` - TypeScript check without emitting files
- `pnpm test` - focused assertion tests
- `pnpm verify` - runs `typecheck` then `test`
- `pnpm lint` - Biome checks
- `pnpm format` - Biome formatting
- `pnpm db:generate` - generate Drizzle migrations
- `pnpm db:migrate` - apply migrations
- `pnpm db:push` - push schema changes
- `pnpm db:studio` - open Drizzle Studio
- `pnpm embeddings:backfill` - backfill message embeddings
- `pnpm embeddings:backfill-sent` - backfill sent-message embeddings

## Development Notes

- Do not run `pnpm dev` or `pnpm build` in this repo for agent work
- Keep changes scoped to the current task
- Prefer static verification with `pnpm typecheck` and `pnpm test`
- The app uses route groups heavily, so quoted paths are often required in shell commands

## Environment

The app expects the usual Next.js runtime and the external services required by auth, database, and integration flows. Check the relevant server and integration files before changing env-related behavior.
