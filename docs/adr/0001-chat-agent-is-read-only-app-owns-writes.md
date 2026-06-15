# 1. The Chat agent is read-only; the app owns all writes

Date: 2026-06-16

## Status

Accepted

## Context

We are building **Chat** (`/chat`) — a persistent, multi-turn conversational
surface where a non-technical user tells the Agent what to do in plain English
("find Sam's emails", "reply to the second one about Thursday", "set up a meeting
at 3pm"). The Agent reads Gmail/Calendar, shows its work inline (rendered email
lists, proposed slots), and prepares outbound actions for approval.

The product's spine is **"Trust is the product" / "approve, don't read"**: nothing
outbound sends or books without a human keypress (PRD STOP condition). A
persistent chat that claims "the AI does everything" raises the stakes — for a
non-technical user, an AI that emails their boss without asking is terrifying,
not delightful.

The existing `agent.ask` (plans 003/009) hands the model Corsair's MCP
`run_script` — a single general tool that can execute *any* Corsair operation,
including writes. Write-safety was enforced **only by a sentence in the system
prompt**. Plans 003 and 009 both flagged this as an unresolved caveat. We had to
resolve it before scaling the agent into a persistent "does everything" surface.

Three options were considered:

- **A — App-level curated read-only tools.** The agent holds only read function
  tools (`searchEmails`, `getThread`, `findFreeSlots`, `getEvents`). Writes do
  not exist as tools the agent can call; they happen *outside* the agent, via an
  approval card routed to our existing deterministic mutations (`gmail.sendReply`,
  `calendar.createEvent`).
- **B — Corsair platform permissions.** Keep `run_script`; set plugins to
  `strict`; any write auto-creates a `corsair_permissions` row (frozen args +
  token) and blocks until a human approves, then `executePermission` replays it.
- **Status quo — instruction-only.** Rejected outright: not structural.

## Decision

Go with **A**: the Chat agent is **structurally read-only**, and the **app owns
every write**.

1. The agent is given a curated set of **read-only** function tools — no write
   tool exists in its hands.
2. As a cheap structural backstop, the agent's Corsair instance is configured in
   **`readonly`** permission mode, so even an accidental write path is denied at
   the platform layer, not silently executed.
3. Outbound actions (reply, invite) are produced by the agent only as
   **structured proposals**, rendered in the chat as an **approval card**. The
   actual send/book runs on a human keypress through the existing deterministic
   tRPC mutations, on a normal (non-readonly) Corsair instance.

## Consequences

**Positive**

- The agent **physically cannot send or book** — write-safety is structural, not
  a prompt we hope holds. Closes the caveat carried through plans 003 and 009.
- The real email/invite is built by our **battle-tested deterministic code**
  (plan 004's RFC 2822 threading with Message-ID/References; the invite shape),
  not by raw model-formed args. This protects the core demo moment ("it drafted
  the perfect threaded reply in my voice and I just approved it").
- Clean inline approval-card UX — no agent → blocked → retry async dance.

**Negative / costs**

- More app code than option B: we maintain a `tool()` read-set and reuse the
  plan-009 proposal schema + dialogs, rather than letting Corsair own the whole
  approval lifecycle.
- New write *types* require new proposal plumbing (they are not auto-gated the
  way Corsair `strict` mode would auto-gate any write). Acceptable: the v1 verb
  set is small and known.

**Revisit if** we want an open-ended agent that performs writes we did not
pre-define. At that point Corsair permissions (option B, `strict` mode) becomes
the better fit, since it gates arbitrary writes without per-action plumbing.
