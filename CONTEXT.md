# SlotNest — Context Glossary

The shared language for SlotNest. Terms only — no implementation details.

## Core terms

- **SlotNest** — An AI-native, keyboard-first command center for Gmail + Google Calendar, built on Corsair. Not a clone; it reshapes email/calendar workflows around speed and AI assistance.
- **Approve, don't read** — The core interaction model. The AI prepares a decision (triage, draft reply, proposed invite); the User confirms it with one keypress. Surfaces present actions, not raw messages. Inbox-zero by approval, not by reading. For v1, nothing outbound sends or books without a human keypress.
- **Today** — The home surface (`/today`) for a connected User. Shows what needs the User now: emails needing reply (with drafts ready to approve), today's events with free gaps surfaced, and an inline entry into the Agent. Triages; the dedicated pages do the work. Not a metric-card dashboard.
- **User** — A person with a SlotNest account (authenticated via better-auth). The unit of identity inside SlotNest.
- **Tenant** — A User as seen by Corsair. The Corsair tenant id equals the better-auth `session.user.id`. All integration calls are scoped to a tenant.
- **Connection** — A User's authorized link to one external provider (Gmail or Google Calendar) through Corsair OAuth. v1: at most one of each provider per User.
- **Command bar** — The unified cmd-K surface. Accepts both discrete commands (fuzzy actions/navigation) and natural-language sentences, which are routed to the Agent. The single primary entry point for the app.
- **Agent** — The LLM-driven assistant (OpenAI Agents SDK + Corsair MCP) that performs email/calendar actions from natural language.
- **Chat** — The dedicated conversational surface (`/chat`) where the User talks to the Agent in multi-turn natural language. The non-technical front door to the Agent: it shows its work inline (the emails it found, the slot it picked, the draft it wrote) and ends every outbound action in an approval card — it proposes, the User approves. Distinct from the Command bar (one-shot, keyboard-first); both reach the same Agent.
- **Triage** — Classification of an incoming email along two axes: an **Action** label and an **Urgency** level. Combined into a sortable priority.
  - **Action** — What the User must do about an email: `Needs reply` | `FYI` | `Ignore`.
  - **Urgency** — How time-sensitive an email is: `Urgent` | `Normal` | `Low`.
- **Draft reply** — A context-aware LLM-generated reply, editable before the User sends it, for `Needs reply` emails.
- **User voice** — How the User actually writes, learned from their own Sent mail. When drafting a reply, the Agent retrieves a few of the User's past sent emails to similar recipients (recipient-scoped) and uses them as style examples so the draft reads like the User wrote it. Grounded in real sent emails, never an invented persona.
- **AI action budget** — The shared monthly or daily allowance for expensive AI-driven work in SlotNest. Draft replies, chat turns, and other AI-assisted generation draw from the same pool so the app can cap cost without exposing separate confusing counters.
- **Free-slot scheduling** — Finding open time on the User's calendar and proposing/sending an invite at a real free slot, from natural language.
- **Email→invite** — A one-shot workflow turning an open email into a calendar invite to the sender (time/title extracted by LLM).
- **Local cache** — Emails/events pushed via Corsair webhooks and persisted in Postgres; the source for fast local search (not live Gmail polling).
- **Hybrid search** — Search combining semantic (Qdrant embeddings) and keyword (Corsair/Postgres contains filters) over the local cache.
