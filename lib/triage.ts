/**
 * Triage classifier — heuristic stub.
 *
 * Both /today and the /inbox chips need an Action + Urgency label per email
 * (see CONTEXT.md). For this version the classifier is a deterministic
 * heuristic over the metadata we already have from `gmail.inbox` (unread,
 * recency, simple subject/snippet keyword cues). It does NOT call an LLM.
 *
 * This is intentionally kept as a small, pure helper so the LLM-backed version
 * can swap in behind the same `triage()` signature later.
 */

// Action label: what the user must do about an email.
export type TriageAction = "Needs reply" | "FYI" | "Ignore";
// Urgency level: how time-sensitive an email is.
export type TriageUrgency = "Urgent" | "Normal" | "Low";

export type Triage = {
  action: TriageAction;
  urgency: TriageUrgency;
};

/** The subset of an email's metadata the heuristic reads. */
export type TriageInput = {
  subject: string;
  snippet: string;
  fromEmail: string;
  unread: boolean;
  date: Date | string | null;
};

const URGENT_CUES = [
  "urgent",
  "asap",
  "immediately",
  "today",
  "eod",
  "deadline",
  "reminder",
  "action required",
  "past due",
  "overdue",
  "expires",
  "final notice",
];

const REPLY_CUES = [
  "?",
  "can you",
  "could you",
  "please",
  "let me know",
  "thoughts",
  "what do you think",
  "are you available",
  "confirm",
  "review",
  "feedback",
  "rsvp",
  "reply",
];

// Senders/subjects that are almost never worth a reply.
const IGNORE_CUES = [
  "unsubscribe",
  "newsletter",
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
  "notifications@",
  "digest",
  "promotion",
  "sale",
  "% off",
  "receipt",
  "invoice",
];

const FYI_CUES = [
  "fyi",
  "heads up",
  "for your information",
  "update",
  "announcement",
  "shipped",
  "delivered",
  "confirmed",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function hasCue(haystack: string, cues: string[]): boolean {
  return cues.some((c) => haystack.includes(c));
}

/**
 * Classify a single email into { action, urgency }. Pure and deterministic.
 */
export function triage(input: TriageInput): Triage {
  const text = `${input.subject} ${input.snippet}`.toLowerCase();
  const from = input.fromEmail.toLowerCase();

  // --- Action ---
  let action: TriageAction;
  if (hasCue(from, IGNORE_CUES) || hasCue(text, IGNORE_CUES)) {
    action = "Ignore";
  } else if (hasCue(text, REPLY_CUES)) {
    action = "Needs reply";
  } else if (hasCue(text, FYI_CUES) || !input.unread) {
    action = "FYI";
  } else {
    // Unread, no clear cue — default to needing attention.
    action = "Needs reply";
  }

  // --- Urgency ---
  const ageMs = ageInMs(input.date);
  let urgency: TriageUrgency;
  if (action === "Ignore") {
    urgency = "Low";
  } else if (hasCue(text, URGENT_CUES) || (input.unread && ageMs < DAY_MS)) {
    urgency = "Urgent";
  } else if (input.unread && ageMs < 3 * DAY_MS) {
    urgency = "Normal";
  } else {
    urgency = "Low";
  }

  return { action, urgency };
}

function ageInMs(date: Date | string | null): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

/**
 * Sortable priority — higher means "surface sooner". Used by /today to order
 * the "Needs your reply" zone. Action weight dominates, urgency breaks ties.
 */
export function triagePriority(t: Triage): number {
  const actionWeight: Record<TriageAction, number> = {
    "Needs reply": 200,
    FYI: 100,
    Ignore: 0,
  };
  const urgencyWeight: Record<TriageUrgency, number> = {
    Urgent: 30,
    Normal: 20,
    Low: 10,
  };
  return actionWeight[t.action] + urgencyWeight[t.urgency];
}
