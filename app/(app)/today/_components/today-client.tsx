"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Inbox,
  Mail,
  MailCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useCommandBar } from "@/components/command-bar";
import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { TriageChips } from "@/components/triage-chips";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMac } from "@/hooks/use-is-mac";
import { CALENDAR_POLL_OPTIONS, INBOX_POLL_OPTIONS } from "@/lib/query-options";
import {
  cleanReplySubject,
  toReplyReferences,
  toReplySubject,
} from "@/lib/reply";
import { type Triage, triagePriority } from "@/lib/triage";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/auth/client";
import { api } from "@/trpc/react";

/** Soft lift shared by interactive cards (DESIGN: "Quiet Desk"). */
const CARD_HOVER =
  "transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)]";

type Slot = { start: string; end: string };

type TodayMessage = {
  id: string;
  threadId: string | null;
  fromName: string | null;
  fromEmail: string;
  subject: string;
  messageIdHeader: string | null;
  references: string | null;
  snippet: string;
  date: Date | string | null;
  triage: Triage;
};

type ActionState = "approved" | "skipped";

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "there";
}

function replyPreview(input: {
  subject: string;
  snippet: string;
  fromName: string | null;
  fromEmail: string;
}): string {
  const text = `${input.subject} ${input.snippet}`.toLowerCase();
  const sender = input.fromName || input.fromEmail.split("@")[0] || "them";

  if (
    text.includes("meet") ||
    text.includes("call") ||
    text.includes("available") ||
    text.includes("schedule")
  ) {
    return `SlotNest can suggest a time and draft the reply to ${sender}.`;
  }
  if (
    text.includes("review") ||
    text.includes("feedback") ||
    text.includes("thoughts")
  ) {
    return `Draft ready: acknowledge it and promise a clear answer.`;
  }
  if (
    text.includes("confirm") ||
    text.includes("rsvp") ||
    text.includes("yes")
  ) {
    return `Draft ready: confirm politely in one sentence.`;
  }
  return `Draft ready: a short reply in your voice.`;
}

function actionLabel(input: { subject: string; snippet: string }): string {
  const text = `${input.subject} ${input.snippet}`.toLowerCase();
  if (
    text.includes("meet") ||
    text.includes("call") ||
    text.includes("available") ||
    text.includes("schedule")
  ) {
    return "Slot found";
  }
  if (text.includes("review") || text.includes("feedback")) {
    return "Review reply";
  }
  return "Reply ready";
}

function isSchedulingEmail(input: {
  subject: string;
  snippet: string;
}): boolean {
  const text = `${input.subject} ${input.snippet}`.toLowerCase();
  return [
    "meet",
    "meeting",
    "call",
    "available",
    "availability",
    "schedule",
    "calendar",
    "book",
    "invite",
  ].some((cue) => text.includes(cue));
}

function whyThisMatters(input: {
  subject: string;
  snippet: string;
  triage: Triage;
}): string {
  const text = `${input.subject} ${input.snippet}`.toLowerCase();
  if (isSchedulingEmail(input)) return "Scheduling request detected";
  if (input.triage.urgency === "Urgent") return "Time-sensitive language found";
  if (text.includes("?")) return "Asked a direct question";
  if (text.includes("review") || text.includes("feedback")) {
    return "Waiting for your opinion";
  }
  if (text.includes("confirm") || text.includes("rsvp")) {
    return "Needs your confirmation";
  }
  return "Needs a human decision";
}

function dailySummary({
  replies,
  events,
  openSlots,
}: {
  replies: number;
  events: number;
  openSlots: number;
}): string {
  if (replies === 0 && events === 0) {
    return "Your inbox and calendar are clear for now.";
  }
  if (replies > 0 && openSlots > 0) {
    return `${replies} ${
      replies === 1 ? "person needs" : "people need"
    } a reply, and SlotNest found ${openSlots} useful ${
      openSlots === 1 ? "slot" : "slots"
    } today.`;
  }
  if (replies > 0) {
    return `${replies} ${
      replies === 1 ? "reply is" : "replies are"
    } waiting. Start with the first prepared action.`;
  }
  if (events > 0) {
    return `Your calendar has ${events} ${
      events === 1 ? "event" : "events"
    } today. SlotNest will keep watch for anything that needs you.`;
  }
  return "SlotNest is watching for the next thing that needs you.";
}

function followUpReason(input: { subject: string; snippet: string }): string {
  const text = `${input.subject} ${input.snippet}`.toLowerCase();
  if (text.includes("follow up") || text.includes("following up")) {
    return "Follow-up thread";
  }
  if (text.includes("waiting") || text.includes("checking in")) {
    return "Waiting language detected";
  }
  if (text.includes("reminder")) return "Reminder detected";
  return "May need a later check";
}

/**
 * /today — the "approve, don't read" home (DESIGN + plan 003).
 *
 * The first screen is an approval queue, not a dashboard: greet the user,
 * summarize what needs them, pick one next action, then show replies, calendar,
 * and a plain-English AI entry point.
 */
export function TodayClient() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {},
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [replyMessageId, setReplyMessageId] = useState<string | null>(null);
  // `connections.list` is the cheap, never-throwing source of truth for what's
  // connected. The heavy Gmail/Calendar queries are gated on it, so a brand-new
  // account never fires (or retries) them — the onboarding screen shows at once.
  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const calendarConnected =
    connections.data?.includes("googlecalendar") ?? false;

  const inbox = api.gmail.inbox.useQuery(
    {},
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

  // Today's calendar window (00:00 → 24:00 local) for zone 2.
  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }, []);
  const calendar = api.calendar.events.useQuery(todayRange, {
    ...CALENDAR_POLL_OPTIONS,
    enabled: calendarConnected,
  });
  const availability = api.calendar.availability.useQuery(
    {
      ...todayRange,
      minMinutes: 30,
    },
    { ...CALENDAR_POLL_OPTIONS, enabled: calendarConnected },
  );

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todayEvents = useMemo(() => {
    if (!calendar.data || calendar.data.connected === false) return [];
    const today = new Date();
    return calendar.data.events
      .filter((e) => (e.start ? sameDay(new Date(e.start), today) : false))
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
      .slice(0, 6);
  }, [calendar.data]);

  const todaySlots = useMemo(() => {
    if (!availability.data || availability.data.connected === false) return [];
    const today = new Date();
    return availability.data.slots
      .filter((s) => sameDay(new Date(s.start), today))
      .slice(0, 3);
  }, [availability.data]);

  const needsReply = useMemo(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((m) => m.triage.action === "Needs reply")
      .filter((m) => actionStates[m.id] !== "skipped")
      .sort((a, b) => triagePriority(b.triage) - triagePriority(a.triage))
      .slice(0, 5);
  }, [inbox.data, actionStates]);

  const waitingOnOthers = useMemo(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((m) => m.triage.action !== "Needs reply")
      .filter((m) => {
        const text = `${m.subject} ${m.snippet}`.toLowerCase();
        return (
          text.includes("follow up") ||
          text.includes("following up") ||
          text.includes("waiting") ||
          text.includes("checking in") ||
          text.includes("reminder")
        );
      })
      .slice(0, 3);
  }, [inbox.data]);

  const nextAction = needsReply[0] ?? null;
  const preparedCount = needsReply.length;
  const firstSlot = todaySlots[0] ?? null;

  // Once `connections.list` has loaded we can decide the first-run experience
  // immediately — no need to wait on the gated Gmail/Calendar queries.
  const connectionsReady = !connections.isPending;
  const noneConnected =
    connectionsReady && !gmailConnected && !calendarConnected;
  const someDisconnected =
    connectionsReady && (!gmailConnected || !calendarConnected);

  function setAction(id: string, state: ActionState) {
    setActionStates((current) => ({ ...current, [id]: state }));
  }

  function openInviteFromMessage(message: TodayMessage, slot?: Slot | null) {
    const defaultStart = slot?.start;
    const defaultEnd = slot?.end;
    setInviteDraft({
      summary: cleanReplySubject(message.subject, "Meeting"),
      start: defaultStart,
      end: defaultEnd,
      attendees: [message.fromEmail],
      description: `From ${message.fromName || message.fromEmail}: ${
        message.snippet
      }`,
    });
    setInviteOpen(true);
  }

  function openReplyFromMessage(message: TodayMessage) {
    if (!message.threadId) return;
    setReplyMessageId(message.id);
    setReplyDraft({
      to: message.fromEmail,
      subject: toReplySubject(message.subject),
      body: "",
      messageId: message.id,
      threadId: message.threadId,
      inReplyTo: message.messageIdHeader,
      references: toReplyReferences(
        message.references,
        message.messageIdHeader,
      ),
    });
    setReplyOpen(true);
  }

  return (
    <div className="min-h-full bg-background pb-16 md:pb-0">
      {/* Sticky header keeps context while the list scrolls. The content is
       * centered and capped; the app shell itself remains full-screen. */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-4 px-5 py-5 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-1">
            <h1
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              suppressHydrationWarning
            >
              {greetingFor(now.getHours())}, {firstName(session?.user.name)}
            </h1>
            <p
              className="text-sm text-muted-foreground"
              suppressHydrationWarning
            >
              {dateLabel}.{" "}
              {connections.isPending || inbox.isLoading || calendar.isLoading
                ? "SlotNest is checking what needs you."
                : noneConnected
                  ? "Connect Gmail and Calendar to begin."
                  : dailySummary({
                      replies: needsReply.length,
                      events: todayEvents.length,
                      openSlots: todaySlots.length,
                    })}
            </p>
          </div>
          <HeaderAsk />
        </div>
      </header>

      {/* Full-screen workspace, constrained like an app canvas instead of a
       * full-width document. The queue stays the primary column; calendar and
       * Ask sit in a stable right rail. */}
      {noneConnected ? (
        <OnboardingHero firstName={firstName(session?.user.name)} />
      ) : (
        <div className="mx-auto grid w-full max-w-7xl gap-7 px-5 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:px-10 xl:grid-cols-[minmax(720px,1fr)_400px]">
          {/* Left column — Needs your reply (the primary zone) */}
          <section className="flex flex-col gap-6">
            {someDisconnected ? (
              <ConnectFirstState
                gmailConnected={gmailConnected}
                calendarConnected={calendarConnected}
              />
            ) : null}

            <BriefStrip
              replies={needsReply.length}
              prepared={preparedCount}
              openSlots={todaySlots.length}
            />

            {nextAction ? (
              <NextActionCard
                message={nextAction}
                slot={firstSlot}
                state={actionStates[nextAction.id]}
                onApprove={() => openReplyFromMessage(nextAction)}
                onEdit={() => router.push("/inbox")}
                onSkip={() => setAction(nextAction.id, "skipped")}
                onInvite={() => openInviteFromMessage(nextAction, firstSlot)}
              />
            ) : null}

            <div className="flex flex-col gap-3">
              <SectionHeader icon={Inbox} count={needsReply.length}>
                Needs your reply
              </SectionHeader>
              {connections.isPending || inbox.isLoading ? (
                <ZoneSkeleton />
              ) : inbox.isError || !inbox.data ? (
                <EmptyState icon={Inbox}>
                  Couldn&apos;t load your inbox.{" "}
                  <button
                    type="button"
                    className="text-[var(--honey-ink)] underline"
                    onClick={() => router.push("/settings?tab=connections")}
                  >
                    Is Gmail connected?
                  </button>
                </EmptyState>
              ) : needsReply.length === 0 ? (
                <DoneForNowState />
              ) : (
                <ul className="flex flex-col gap-2">
                  {needsReply.map((m) => (
                    <li key={m.id}>
                      <ReplyDecisionRow
                        message={m}
                        slot={firstSlot}
                        state={actionStates[m.id]}
                        onOpen={() => router.push("/inbox")}
                        onApprove={() => openReplyFromMessage(m)}
                        onSkip={() => setAction(m.id, "skipped")}
                        onInvite={() => openInviteFromMessage(m, firstSlot)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <WaitingOnOthers
              items={waitingOnOthers}
              onOpen={() => router.push("/inbox")}
            />
          </section>

          {/* Right rail — calendar + the Ask CTA, stacked. */}
          <div className="flex flex-col gap-7 lg:pt-[3.875rem]">
            {/* Zone 2 — On your calendar today (lighter, grouped timeline) */}
            <section className="flex flex-col gap-3">
              <SectionHeader icon={CalendarDays} count={todayEvents.length}>
                On your calendar today
              </SectionHeader>
              {connections.isPending || calendar.isLoading ? (
                <ZoneSkeleton />
              ) : calendarConnected === false ? (
                <EmptyState icon={CalendarDays}>
                  Calendar isn&apos;t connected yet.{" "}
                  <button
                    type="button"
                    className="text-[var(--honey-ink)] underline"
                    onClick={() => router.push("/settings?tab=connections")}
                  >
                    Connect Google Calendar
                  </button>{" "}
                  to see today&apos;s events and free gaps.
                </EmptyState>
              ) : todayEvents.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <EmptyState icon={Sun}>
                    Nothing on your calendar today. Clear runway.
                  </EmptyState>
                  <OpenSlots
                    slots={todaySlots}
                    onOpen={() => router.push("/calendar")}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {todayEvents.slice(0, 4).map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => router.push("/calendar")}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                        >
                          <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {e.allDay ? "All day" : fmtTime(e.start)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
                            {e.summary}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <OpenSlots
                    slots={todaySlots}
                    onOpen={() => router.push("/calendar")}
                  />
                </div>
              )}
            </section>

            {/* Zone 3 — Ask SlotNest (the page's single honey accent) */}
            <AskSlotNest
              replies={needsReply.length}
              openSlots={todaySlots.length}
            />
          </div>
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={inviteDraft}
      />
      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
        onSent={() => {
          if (replyMessageId) setAction(replyMessageId, "approved");
        }}
      />
    </div>
  );
}

function BriefStrip({
  replies,
  prepared,
  openSlots,
}: {
  replies: number;
  prepared: number;
  openSlots: number;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card p-2 sm:grid-cols-3">
      <BriefItem icon={MailCheck} label="Replies waiting" value={replies} />
      <BriefItem icon={Sparkles} label="Prepared actions" value={prepared} />
      <BriefItem icon={Clock3} label="Open slots today" value={openSlots} />
    </div>
  );
}

function BriefItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-base font-semibold leading-none tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

const PROVIDER_CONNECT = {
  gmail: { label: "Gmail", icon: Mail },
  googlecalendar: { label: "Google Calendar", icon: CalendarDays },
} as const;

/**
 * Inline banner for the PARTIAL case — one of Gmail/Calendar is connected and
 * the other isn't. Sits above the queue and links straight to OAuth for the
 * missing side (no detour through /settings).
 */
function ConnectFirstState({
  gmailConnected,
  calendarConnected,
}: {
  gmailConnected: boolean;
  calendarConnected: boolean;
}) {
  const missing = (
    [
      !gmailConnected ? ("gmail" as const) : null,
      !calendarConnected ? ("googlecalendar" as const) : null,
    ].filter(Boolean) as (keyof typeof PROVIDER_CONNECT)[]
  ).map((key) => ({ key, ...PROVIDER_CONNECT[key] }));

  if (missing.length === 0) return null;
  const which = missing.map((m) => m.label).join(" and ");

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--honey-ink)]">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            Connect {which} to see everything
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            SlotNest works best with both sides of your day — what needs a reply
            and the open time that can solve scheduling.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {missing.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.key}
                  href={`/api/corsair/connect?plugin=${m.key}`}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  <Icon className="size-3.5" />
                  Connect {m.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * First-run hero shown when NOTHING is connected — replaces the empty queue so a
 * brand-new account lands on a clear, inviting next step instead of blank zones.
 */
function OnboardingHero({ firstName }: { firstName: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-5 py-8 sm:px-6 lg:px-10">
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-[var(--honey-ink)]">
              <Sparkles className="size-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
              Welcome to SlotNest, {firstName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Type what you want done. SlotNest finds the calendar slot, drafts
              the email, and waits for your approval before anything is sent.
            </p>
          </div>

          {/* One click -> Gmail OAuth, then straight into Calendar OAuth. */}
          <Link
            href="/api/corsair/connect?plugin=gmail&next=googlecalendar"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full shrink-0 sm:w-auto",
            )}
          >
            <Sparkles className="size-4" />
            Connect Google
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background">
          <div className="border-b border-border bg-muted px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left">
              <Sparkles className="size-4 shrink-0 text-[var(--honey-ink)]" />
              <p className="min-w-0 flex-1 text-sm text-foreground">
                Send a calendar invite to Sam at 9 AM Thursday and email him
                that I&apos;m looking forward to our meeting.
              </p>
              <Kbd className="hidden sm:inline-flex">↵</Kbd>
            </div>
          </div>

          <div className="divide-y divide-border">
            <CommandPreviewStep
              icon={CalendarDays}
              title="Finds real free time"
              description="Checks Google Calendar and prepares the meeting slot."
            />
            <CommandPreviewStep
              icon={MailCheck}
              title="Writes the email"
              description="Drafts the note in plain language, ready to send."
            />
            <CommandPreviewStep
              icon={CheckCircle2}
              title="Waits for approval"
              description="Nothing books or sends until you confirm."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Mail className="size-3.5" />
              Gmail
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <CalendarDays className="size-3.5" />
              Google Calendar
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <ShieldCheck className="size-3.5" />
              Approve before send
            </span>
          </div>

          <Link
            href="/settings?tab=connections"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "self-start text-muted-foreground sm:self-auto",
            )}
          >
            Manage connections
          </Link>
        </div>
      </section>
    </div>
  );
}

function CommandPreviewStep({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  );
}

function NextActionCard({
  message,
  slot,
  state,
  onApprove,
  onEdit,
  onSkip,
  onInvite,
}: {
  message: TodayMessage;
  slot: Slot | null;
  state?: ActionState;
  onApprove: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onInvite: () => void;
}) {
  const scheduling = isSchedulingEmail(message);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader icon={Sparkles}>Next best action</SectionHeader>
      <div
        className={cn(
          "rounded-xl border border-primary/35 bg-primary/5 p-5 md:p-6",
          state === "approved" && "border-success/40 bg-success-subtle/45",
        )}
      >
        <div className="flex gap-4">
          <Avatar className="size-11 shrink-0">
            <AvatarFallback className="bg-primary/20 text-xs font-semibold text-[var(--honey-ink)]">
              {initials(message.fromName || message.fromEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">
                {message.fromName || message.fromEmail}
              </span>
              <TriageChips
                action={message.triage.action}
                urgency={message.triage.urgency}
              />
            </div>
            <p className="mt-1 text-[0.9375rem] font-medium leading-6">
              {message.subject}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {replyPreview(message)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-1">
                <HelpCircle className="size-3.5" />
                {whyThisMatters(message)}
              </span>
              {scheduling && slot ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-1">
                  <Clock3 className="size-3.5" />
                  Best slot: {fmtTime(slot.start)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-auto rounded-md bg-background/75 px-2 py-1 text-xs font-medium text-[var(--honey-ink)]">
                {state === "approved" ? "Reply approved" : actionLabel(message)}
              </span>
              {scheduling && slot ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onInvite}
                >
                  <CalendarDays className="size-3.5" />
                  Draft invite
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={onApprove}
                disabled={state === "approved"}
                className="min-w-24"
              >
                <CheckCircle2 className="size-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onEdit}
              >
                Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReplyDecisionRow({
  message,
  slot,
  state,
  onOpen,
  onApprove,
  onSkip,
  onInvite,
}: {
  message: TodayMessage;
  slot: Slot | null;
  state?: ActionState;
  onOpen: () => void;
  onApprove: () => void;
  onSkip: () => void;
  onInvite: () => void;
}) {
  const scheduling = isSchedulingEmail(message);

  return (
    <div
      className={cn(
        "group flex w-full gap-3 rounded-xl border border-border bg-card p-4 text-left",
        CARD_HOVER,
        state === "approved" && "border-success/40 bg-success-subtle/30",
      )}
    >
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-[var(--honey-ink)]">
          {initials(message.fromName || message.fromEmail)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-col gap-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[0.9375rem] font-semibold">
              {message.fromName || message.fromEmail}
            </span>
            <TriageChips
              action={message.triage.action}
              urgency={message.triage.urgency}
            />
          </div>
          <span className="truncate text-sm text-muted-foreground">
            {message.subject}
          </span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {replyPreview(message)}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
            <HelpCircle className="size-3.5" />
            {whyThisMatters(message)}
          </span>
          {scheduling && slot ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
              <Clock3 className="size-3.5" />
              {fmtTime(slot.start)} works
            </span>
          ) : null}
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
            {state === "approved" ? "Reply approved" : actionLabel(message)}
          </span>
          <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {scheduling && slot ? (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onInvite}
              >
                <CalendarDays className="size-3" />
                Invite
              </Button>
            ) : null}
            <Button
              type="button"
              size="xs"
              onClick={onApprove}
              disabled={state === "approved"}
            >
              <CheckCircle2 className="size-3" />
              Approve
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={onSkip}>
              Skip
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

function WaitingOnOthers({
  items,
  onOpen,
}: {
  items: TodayMessage[];
  onOpen: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader icon={Send} count={items.length}>
        Waiting on others
      </SectionHeader>
      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2}>
          No follow-ups detected. SlotNest will surface threads that look like
          they are waiting on someone else.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={onOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left",
                  CARD_HOVER,
                )}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                    {initials(item.fromName || item.fromEmail)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.subject}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {followUpReason(item)}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DoneForNowState() {
  return (
    <EmptyState icon={CheckCircle2}>
      You&apos;re clear for now. SlotNest will surface the next email that needs
      a reply, a follow-up, or calendar time.
    </EmptyState>
  );
}

function SectionHeader({
  icon: Icon,
  count,
  children,
}: {
  icon: LucideIcon;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {typeof count === "number" && count > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}

/** Compact ⌘K affordance in the page header — fills the header's right edge
 * and gives the calm "approve, don't read" loop a visible fast path. */
function HeaderAsk() {
  const { setOpen } = useCommandBar();
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="hidden shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
    >
      <Sparkles className="size-4 text-[var(--honey-ink)]" />
      <span>Ask SlotNest</span>
      <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
      <Kbd>K</Kbd>
    </button>
  );
}

function OpenSlots({
  slots,
  onOpen,
}: {
  slots: { start: string; end: string }[];
  onOpen: () => void;
}) {
  if (slots.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Clock3 className="size-4 text-muted-foreground" />
        Open slots
      </div>
      <div className="flex flex-col gap-1.5">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            onClick={onOpen}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="font-medium tabular-nums">
              {fmtTime(slot.start)} - {fmtTime(slot.end)}
            </span>
            <span className="text-xs text-muted-foreground">schedule</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AskSlotNest({
  replies,
  openSlots,
}: {
  replies: number;
  openSlots: number;
}) {
  const { setOpen } = useCommandBar();
  const isMac = useIsMac();
  const prompt =
    replies > 0 && openSlots > 0
      ? "Draft replies and use my open slots today…"
      : replies > 0
        ? "Help me clear the replies waiting for me…"
        : openSlots > 0
          ? "Find someone I should schedule today…"
          : "Tell me what changed since yesterday…";

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader icon={Sparkles}>Ask SlotNest</SectionHeader>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5 text-left text-sm transition-colors hover:bg-primary/10"
      >
        <Sparkles className="size-4 shrink-0 text-[var(--honey-ink)]" />
        <span className="flex-1 text-foreground/70">{prompt}</span>
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
        <ArrowRight className="size-4 text-[var(--honey-ink)] transition-transform group-hover:translate-x-0.5" />
      </button>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-left text-sm text-muted-foreground">
      {Icon ? (
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
      ) : null}
      <div className="max-w-md">{children}</div>
    </div>
  );
}

function ZoneSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={i}
          className="h-20 w-full rounded-xl"
        />
      ))}
    </div>
  );
}
