import type { Triage } from "@/lib/triage";

export type WorkspaceMessage = {
  id: string;
  threadId: string | null;
  fromName: string | null;
  fromEmail: string;
  subject: string;
  messageIdHeader: string | null;
  references: string | null;
  snippet: string;
  date: Date | string | null;
  unread?: boolean;
  replyStatus?: "generated" | "edited" | "sent" | string | null;
  replyBody?: string | null;
  triage: Triage;
};

export type WorkspaceSlot = { start: string; end: string };

export type WorkspaceEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

export function inboxHrefForMessage(
  message: Pick<WorkspaceMessage, "id" | "threadId">,
) {
  if (message.threadId) {
    return `/inbox?thread=${encodeURIComponent(message.threadId)}&message=${encodeURIComponent(message.id)}`;
  }
  return `/inbox?message=${encodeURIComponent(message.id)}`;
}

export function defaultSnoozeUntil(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

const SCHEDULING_CUES = [
  "meet",
  "meeting",
  "call",
  "available",
  "availability",
  "schedule",
  "calendar",
  "book",
  "invite",
  "time that works",
];

const WAITING_CUES = [
  "follow up",
  "following up",
  "waiting",
  "checking in",
  "reminder",
  "any update",
  "circle back",
];

const REVIEW_CUES = ["review", "feedback", "thoughts", "what do you think"];

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShortDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (sameDay(d, now)) return formatTime(d.toISOString());
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function messageText(message: Pick<WorkspaceMessage, "subject" | "snippet">) {
  return `${message.subject} ${message.snippet}`.toLowerCase();
}

function includesAny(text: string, cues: string[]) {
  return cues.some((cue) => text.includes(cue));
}

export function isSchedulingMessage(
  message: Pick<WorkspaceMessage, "subject" | "snippet"> & {
    triage?: Pick<Triage, "action">;
  },
): boolean {
  return (
    message.triage?.action === "Schedule" ||
    includesAny(messageText(message), SCHEDULING_CUES)
  );
}

export function isWaitingMessage(
  message: Pick<WorkspaceMessage, "subject" | "snippet" | "triage">,
): boolean {
  const text = messageText(message);
  if (message.triage.action === "Schedule") return false;
  return (
    message.triage.action !== "Needs reply" &&
    (includesAny(text, WAITING_CUES) || message.triage.urgency === "Low")
  );
}

export function whyThisMatters(
  message: Pick<WorkspaceMessage, "subject" | "snippet" | "triage">,
): string {
  const text = messageText(message);
  if (isSchedulingMessage(message)) return "Scheduling request detected";
  if (message.triage.urgency === "Urgent") return "Time-sensitive language";
  if (text.includes("?")) return "Asked a direct question";
  if (includesAny(text, REVIEW_CUES)) return "Waiting for your opinion";
  if (text.includes("confirm") || text.includes("rsvp")) {
    return "Needs your confirmation";
  }
  return "Needs a human decision";
}

export function draftActionLabel(
  message: Pick<WorkspaceMessage, "subject" | "snippet">,
): string {
  const text = messageText(message);
  if (isSchedulingMessage(message)) return "Reply and invite";
  if (includesAny(text, REVIEW_CUES)) return "Feedback reply";
  if (text.includes("confirm") || text.includes("rsvp")) return "Confirm";
  return "Reply";
}

export function draftPreview(
  message: Pick<
    WorkspaceMessage,
    "subject" | "snippet" | "fromName" | "fromEmail"
  >,
): string {
  const sender = message.fromName || message.fromEmail.split("@")[0] || "them";
  const text = messageText(message);
  if (isSchedulingMessage(message)) {
    return `Draft a short reply to ${sender} and attach the best available slot.`;
  }
  if (includesAny(text, REVIEW_CUES)) {
    return "Acknowledge it and promise a clear answer after review.";
  }
  if (text.includes("confirm") || text.includes("rsvp")) {
    return "Confirm politely in one sentence.";
  }
  return "A concise reply in your voice, ready for review.";
}

export function waitingReason(
  message: Pick<WorkspaceMessage, "subject" | "snippet">,
): string {
  const text = messageText(message);
  if (text.includes("follow up") || text.includes("following up")) {
    return "Follow-up candidate";
  }
  if (text.includes("waiting") || text.includes("checking in")) {
    return "Waiting language detected";
  }
  if (text.includes("reminder") || text.includes("any update")) {
    return "May need a reminder";
  }
  return "Quiet thread worth checking later";
}

export function waitingDuration(date: Date | string | null): string {
  if (!date) return "Unknown";
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return "Unknown";
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function followUpDraft(message: WorkspaceMessage): string {
  const name = message.fromName?.split(/\s+/)[0] || "there";
  return `Hi ${name}, just checking in on this. Any update when you have a chance?`;
}

export function chooseBestSlot(slots: WorkspaceSlot[]): WorkspaceSlot | null {
  const now = Date.now();
  return (
    slots.find((slot) => {
      const start = new Date(slot.start).getTime();
      return Number.isFinite(start) && start > now;
    }) ??
    slots[0] ??
    null
  );
}
