# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into SlotNest. A client-side PostHog instance is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy through `/ingest`. A server-side client (`lib/posthog-server.ts`) is used for API route tracking. User identification is called on sign-up, sign-in, and on every app load (via the `AccountMenu` component in the sidebar). Twelve events were instrumented across auth, chat, email, calendar, billing, and integration flows.

| Event name | Description | File |
|---|---|---|
| `user_signed_up` | User successfully creates an account via email or Google OAuth. | `app/(auth)/sign-up/_components/signup-form.tsx` |
| `user_signed_in` | User successfully signs in via email or Google OAuth. | `app/(auth)/sign-in/_components/signin-fom.tsx` |
| `password_reset_requested` | User requests a password reset email. | `app/(auth)/forgot-password/_components/forgot-password-form.tsx` |
| `integration_connected` | User successfully completes OAuth flow to connect Gmail or Google Calendar. | `app/api/corsair/callback/route.ts` |
| `integration_disconnected` | User disconnects Gmail or Google Calendar from their account. | `app/(app)/settings/_components/settings-client.tsx` |
| `chat_message_sent` | User sends a prompt to the AI chat assistant. | `app/(app)/chat/_components/chat-client.tsx` |
| `chat_ai_action_approved` | User clicks Review/Approve on an AI-proposed email reply or calendar invite. | `app/(app)/chat/_components/chat-client.tsx` |
| `email_archived` | User archives an email or thread from the inbox. | `app/(app)/inbox/_components/inbox-client.tsx` |
| `email_reply_sent` | User sends an email reply or new email via the reply dialog. | `components/reply-dialog.tsx` |
| `calendar_invite_sent` | User creates a calendar event or sends a meeting invite. | `components/invite-dialog.tsx` |
| `billing_upgrade_initiated` | User opens Razorpay checkout to upgrade to a paid plan. | `components/billing-upgrade-button.tsx` |
| `billing_upgrade_completed` | User completes payment and subscription is successfully verified. | `components/billing-upgrade-button.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/141441/dashboard/1732431)
- [New user signups](https://us.posthog.com/project/141441/insights/Eu33Ywe4) — Daily signups vs sign-ins
- [Signup to chat activation funnel](https://us.posthog.com/project/141441/insights/dP5GXdGE) — Signup → integration connected → first chat
- [Billing upgrade funnel](https://us.posthog.com/project/141441/insights/EnnqHl9w) — Checkout opened → payment completed
- [Chat usage over time](https://us.posthog.com/project/141441/insights/01HDRJp4) — Chat messages and AI approvals per day
- [Email & calendar activity](https://us.posthog.com/project/141441/insights/5wyXEoa1) — Replies, archives, and calendar invites per day

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `AccountMenu` component now handles this, but verify it fires before any meaningful user action in your staging environment.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
