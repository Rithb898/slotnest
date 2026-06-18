# SlotNest owns approval state; Gmail labels are not used

Date: 2026-06-18

## Status

Accepted

## Context

SlotNest's product loop is "approve, don't read": the app prepares work and the
User decides whether to approve, edit, skip, snooze, resolve, or clear it. Those
decisions are SlotNest workflow state, not Gmail taxonomy. Gmail labels would
make the state visible in the User's mailbox, create cleanup concerns, and pull
the product toward Gmail parity.

## Decision

Store approval state in SlotNest's database. Mutate Gmail only for real Gmail
actions the User expects to affect Gmail itself, such as sending email and
archiving a thread.

## Consequences

SlotNest can evolve its approval loop without leaking labels into Gmail. Gmail
remains the source for message/thread content, while SlotNest owns workflow
visibility decisions such as done, skipped, snoozed, and resolved.
