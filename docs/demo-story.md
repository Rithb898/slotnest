# SlotNest Demo Story

SlotNest is not a faster inbox. It is an approval queue for Gmail and Google
Calendar.

The promise:

> Open SlotNest and immediately know what needs you, what has already been
> prepared, and what to approve next.

## User Problem

Normal Gmail and Calendar users do not wake up wanting a more powerful email
client. They want relief from everyday work friction:

- I do not know which emails actually need my attention.
- I do not know how to word the reply.
- I forgot to follow up.
- Scheduling takes too many back-and-forth messages.
- My inbox and calendar are separate, but the work is connected.
- I do not fully trust AI to send or book things without my approval.

Superhuman helps expert users move faster through email. SlotNest helps
non-technical users avoid starting from a blank decision.

## Product Thesis

SlotNest should make the first screen feel like:

> Good afternoon, Hassan. You have 4 replies waiting, 3 prepared actions, and 2
> open slots today. Start here.

The core loop is:

1. SlotNest reads the user's Gmail and Calendar context.
2. SlotNest surfaces only the work that needs a human decision.
3. SlotNest prepares the reply, scheduling suggestion, or next step.
4. The user approves, edits, or skips.

Nothing important sends or books without the user confirming it.

## Today Page Story

The Today page is the product's first impression. It should answer three
questions without explanation:

- What needs me right now?
- What did SlotNest already prepare?
- What should I approve next?

The page structure:

- Personal greeting: "Good afternoon, Hassan."
- Plain-English brief: "4 replies waiting, 2 events today, 2 open slots."
- Next best action: one clear action at the top.
- Needs your reply: only the 4-5 emails that need action.
- Why this matters: a short trust label like "Asked a direct question" or
  "Scheduling request detected."
- Inline approval: Approve / Edit / Skip without forcing the user to understand
  the whole inbox first.
- Calendar today: today's events plus useful open slots.
- Waiting on others: follow-up threads that may need a later check.
- Ask SlotNest: a plain-English AI entry point, not a technical tool.

## Demo Video Flow

### 1. Hook

"Everyone has the same problem: Gmail tells you what arrived, but not what
needs you. Calendar tells you when you are busy, but not how to solve scheduling
from an email."

Open `/today`.

Show:

- greeting with the user's name
- reply count
- prepared actions
- open calendar slots
- one next best action

### 2. Product Moment

"Instead of reading every email, SlotNest turns the inbox into decisions."

Click the next best action.

Show a reply/scheduling item with:

- sender
- subject
- triage
- prepared action
- why SlotNest chose it
- Approve / Edit / Skip

### 3. Calendar Differentiator

"This is where SlotNest is not just email. It understands calendar time too."

Show the calendar rail:

- today's events
- open slots
- scheduling affordance

Then show a scheduling email with a suggested open slot and open the draft
invite dialog. Emphasize that SlotNest connects email intent with real calendar
availability.

### 4. AI Moment

Open Ask SlotNest.

Example prompt:

> Reply to Sam and find us 30 minutes Thursday.

Explain that the v1 pattern is draft-then-approve: AI proposes, the user
confirms.

### 5. Close

"SlotNest is for people who do not want to manage email and calendar as two
separate jobs. It tells them what needs action, prepares the work, and lets them
approve it."

## Social Post Draft

I built SlotNest: an AI-native command center for Gmail + Google Calendar.

Most email tools make you read faster. SlotNest tries to make you read less.

Open the app and it tells you:

- what needs your reply
- what action is already prepared
- why the action matters
- where your calendar has open time
- which follow-ups may be waiting on someone else
- what to approve next

The idea is simple: inbox-zero by approval, not by reading.

Built for the Corsair hackathon, but designed as a real product for everyday,
non-technical Gmail and Calendar users.

## One-Liner

SlotNest turns Gmail and Google Calendar into a simple approval queue: see what
needs you, approve what is prepared, and stop managing two separate tools.
