# Plan 012: Settings, trust, and Razorpay billing

> **Executor instructions**: Read this plan fully before starting. This is a
> product surface spec, not a cosmetic tweak. Build the settings surface as a
> calm control center, and keep billing separate from the Gmail/Calendar
> connection flow. Do not turn `/settings` into a dashboard.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001, 003, 010
- **Category**: product / UX / billing
- **Planned at**: 2026-06-17

## Confirmed direction

SlotNest settings should answer three user questions:

1. What is connected?
2. What am I paying for?
3. What can SlotNest do with my data?

The page should stay quiet, readable, and task-oriented. It is a control room,
not an account portal dump.

### Assumptions for v1

- Billing is **individual first**.
- Team / organization billing is deferred unless the product introduces shared
  workspaces later.
- Razorpay is used for **subscriptions** first, not one-time payments.
- The existing Better Auth session remains the identity source; Razorpay is a
  billing layer on top.

## Current state

- `/settings` already exists with two tabs:
  - `Connections` for Gmail + Google Calendar OAuth state.
  - `Account` for profile and sign-out.
- The settings page already handles OAuth callback toasts and shows connection
  state for Gmail and Calendar.
- Missing pieces:
  - billing / subscription UI
  - disconnect actions
  - trust / safety messaging
  - preference controls
  - payment failure / invoice state

## Product scope

### Settings sections

Recommended v1 sections:

1. **Connections**
2. **Billing**
3. **Account**
4. **Trust & Safety**

Optional later:

- Preferences
- Advanced
- Data export / delete

## Surface specs

### 1) Connections

Keep the existing Gmail and Google Calendar cards, but make them complete:

- Show `connected`, `partial`, or `missing` state at the section level.
- Allow connect / reconnect / disconnect per provider.
- Show a short sentence explaining what each connection powers.
- Show a compact trust note: tokens are encrypted, reads are scoped to the
  user's account, and nothing sends / books without approval.
- Preserve the one-click “connect both” path when both providers are missing.

### 2) Billing

Billing should be driven by Razorpay through Better Auth, and it should answer:

- What plan am I on?
- Is my subscription active?
- When is the next renewal?
- Are there any payment issues?
- What invoices exist?

Required billing UI:

- Current plan card
- Subscription status badge
- Upgrade / downgrade / cancel action
- Invoice history
- Trial state if present
- Payment-failure state if present

Recommended billing behavior:

- If no paid plan exists yet, show a clean “Start paid plan” CTA.
- If a subscription is active, show the plan and renewal period first.
- If payment fails, show a prominent recovery state before any secondary copy.
- Keep pricing decisions in plan config, not scattered across the UI.

### 3) Account

Keep the existing account card, but make it the identity anchor:

- Avatar
- Name
- Email
- Sign out

Optional later:

- Password / auth method management if supported by Better Auth setup
- Session controls

### 4) Trust & Safety

This section should reduce anxiety about automation.

It should explicitly say:

- SlotNest reads only what it needs to triage and draft.
- Outbound email and calendar actions require human approval in v1.
- Tokens are encrypted at rest.
- The user can disconnect providers at any time.
- Billing and account identity are separate from Gmail / Calendar access.

Suggested contents:

- Data access summary
- Approval policy summary
- Disconnect consequences
- Billing / privacy note

## Razorpay integration spec

### Auth layer

Add the Razorpay Better Auth plugin to the auth stack so billing state is
available through the existing session/auth model.

Expected integration pieces:

- server auth plugin setup
- client auth plugin setup
- Razorpay subscription endpoints
- webhook receiver for subscription lifecycle updates
- env vars for Razorpay key id, key secret, and webhook secret

### Data shown in UI

The settings page should surface subscription data from the auth/billing layer:

- plan name
- status
- renewal dates
- cancellation state
- trial dates
- invoice list

### Billing actions

The UI should support:

- create / start subscription
- upgrade plan
- cancel subscription
- resume if supported
- open invoice links

## Recommended file-level shape

- Keep `/settings/page.tsx` as the streamed shell.
- Expand `settings-client.tsx` into tabbed or sectioned panels.
- Add a billing data query or auth-derived subscription fetch.
- Keep Razorpay config in auth setup, not inside the page component.

## Build order

1. Add billing auth plumbing and subscription read model.
2. Add billing UI inside `/settings`.
3. Expand connections into full connect / disconnect / health states.
4. Add trust & safety section.
5. Add optional preferences later only if the settings page still feels quiet.

## Acceptance criteria

- A user can understand their connection state in under 5 seconds.
- A user can understand their paid plan and next billing action in under 5
  seconds.
- A user can sign out from settings.
- A user can see a clear summary of what SlotNest can access and do.
- Razorpay subscription state is represented without adding a separate billing
  app area.

## Out of scope for v1

- One-time payments
- Coupons / promo codes
- Team / organization billing
- Usage-based metering
- Deep preference center
- Full privacy/legal center

## STOP conditions

- If the Razorpay Better Auth plugin API differs from this spec, verify against
  upstream docs before coding.
- If team billing becomes required, stop and define the account model first.
- Do not move billing into the Gmail/Calendar connection flow.
