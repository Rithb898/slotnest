"use client";

import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Inbox,
  Mail,
  MailCheck,
  PenLine,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { triagePriority } from "@/lib/triage";
import { cn } from "@/lib/utils";
import {
  chooseBestSlot,
  draftActionLabel,
  draftPreview,
  followUpDraft,
  formatShortDate,
  formatTime,
  initials,
  isSchedulingMessage,
  isWaitingMessage,
  sameDay,
  type WorkspaceEvent,
  type WorkspaceMessage,
  type WorkspaceSlot,
  waitingDuration,
  waitingReason,
  whyThisMatters,
} from "@/lib/workspace";
import { authClient } from "@/server/auth/client";
import { api } from "@/trpc/react";

type ActionState = "approved" | "skipped" | "snoozed" | "resolved";

const PROVIDER_CONNECT = {
  gmail: { label: "Gmail", icon: Mail },
  googlecalendar: { label: "Google Calendar", icon: CalendarDays },
} as const;

function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "there";
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TodayClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: session } = authClient.useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {},
  );
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  // AI-drafted reply bodies, keyed by message id. Cached so re-selecting a row
  // doesn't re-bill the model. "" means drafted-but-empty / unavailable.
  const [aiDrafts, setAiDrafts] = useState<Record<string, string>>({});

  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const calendarConnected =
    connections.data?.includes("googlecalendar") ?? false;

  const inbox = api.gmail.inbox.useQuery(
    { maxResults: 30 },
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

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
    { ...todayRange, minMinutes: 30 },
    { ...CALENDAR_POLL_OPTIONS, enabled: calendarConnected },
  );

  const todayEvents = useMemo<WorkspaceEvent[]>(() => {
    if (!calendar.data || calendar.data.connected === false) return [];
    const today = new Date();
    return calendar.data.events
      .filter((event) =>
        event.start ? sameDay(new Date(event.start), today) : false,
      )
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
      .slice(0, 6);
  }, [calendar.data]);

  const todaySlots = useMemo<WorkspaceSlot[]>(() => {
    if (!availability.data || availability.data.connected === false) return [];
    const today = new Date();
    return availability.data.slots
      .filter((slot) => sameDay(new Date(slot.start), today))
      .slice(0, 5);
  }, [availability.data]);

  const queue = useMemo<WorkspaceMessage[]>(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((message) => message.triage.action === "Needs reply")
      .filter((message) => message.replyStatus !== "sent")
      .filter((message) => actionStates[message.id] !== "skipped")
      .sort((a, b) => triagePriority(b.triage) - triagePriority(a.triage))
      .slice(0, 8);
  }, [inbox.data, actionStates]);

  const waiting = useMemo<WorkspaceMessage[]>(() => {
    if (!inbox.data) return [];
    return inbox.data.messages.filter(isWaitingMessage).slice(0, 4);
  }, [inbox.data]);

  useEffect(() => {
    if (queue.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !queue.some((item) => item.id === selectedId)) {
      setSelectedId(queue[0]?.id ?? null);
    }
  }, [queue, selectedId]);

  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];
  const bestSlot = chooseBestSlot(todaySlots);
  const nextEvent = todayEvents[0] ?? null;
  const now = new Date();

  // Pre-draft the reply for the selected message with AI ("approve, don't
  // read"). Read-only: this only fills the body the user later approves to send.
  // A ref tracks which ids we've already requested so reselecting a row never
  // re-bills the model.
  const draftReply = api.gmail.draftReply.useMutation();
  const requestedDrafts = useRef<Set<string>>(new Set());
  const draftFor = draftReply.mutateAsync;
  const selectedDraftId = selected?.id ?? null;
  useEffect(() => {
    if (queue.length === 0) return;
    setAiDrafts((current) => {
      let changed = false;
      const next = { ...current };
      for (const message of queue) {
        const body = message.replyBody?.trim();
        if (!body) continue;
        requestedDrafts.current.add(message.id);
        if (next[message.id] === body) continue;
        next[message.id] = body;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [queue]);

  useEffect(() => {
    const id = selectedDraftId;
    if (!id || !gmailConnected || requestedDrafts.current.has(id)) return;
    requestedDrafts.current.add(id);
    let cancelled = false;
    draftFor({ messageId: id })
      .then((res) => {
        if (cancelled) return;
        setAiDrafts((current) => ({
          ...current,
          [id]: res.configured ? res.text.trim() : "",
        }));
      })
      .catch(() => {
        // Cache empty so the panel falls back to the generic preview instead
        // of spinning forever.
        if (!cancelled) {
          setAiDrafts((current) => ({ ...current, [id]: "" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDraftId, gmailConnected, draftFor]);

  const selectedDraft = selected ? aiDrafts[selected.id] : undefined;
  const selectedDraftLoading = Boolean(
    selected && gmailConnected && !(selected.id in aiDrafts),
  );

  // Force a fresh AI draft, overwriting the stored one (force: true on the
  // server). Drop the cached body first so the panel shows its loading state.
  function regenerateDraft(id: string) {
    requestedDrafts.current.add(id);
    setAiDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    draftFor({ messageId: id, force: true })
      .then((res) => {
        setAiDrafts((current) => ({
          ...current,
          [id]: res.configured ? res.text.trim() : "",
        }));
      })
      .catch(() => {
        setAiDrafts((current) => ({ ...current, [id]: "" }));
      });
  }

  const briefInput = useMemo(
    () => ({
      needsReply: queue.length,
      draftCount: queue.length,
      waitingCount: waiting.length,
      eventCount: todayEvents.length,
      openSlotCount: todaySlots.length,
      bestSlot: bestSlot ? formatTime(bestSlot.start) : null,
      topMessages: queue.slice(0, 3).map((message) => ({
        sender: message.fromName || message.fromEmail,
        subject: message.subject,
        reason: whyThisMatters(message),
      })),
      nextEvent: nextEvent
        ? { summary: nextEvent.summary, time: formatTime(nextEvent.start) }
        : null,
    }),
    [
      queue,
      waiting.length,
      todayEvents.length,
      todaySlots.length,
      bestSlot,
      nextEvent,
    ],
  );

  const brief = api.workspace.dailyBrief.useQuery(briefInput, {
    enabled:
      connections.isSuccess &&
      (!gmailConnected || inbox.isSuccess) &&
      (!calendarConnected || calendar.isSuccess),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const noneConnected =
    !connections.isPending && !gmailConnected && !calendarConnected;
  const someDisconnected =
    !connections.isPending && (!gmailConnected || !calendarConnected);

  function setAction(id: string, state: ActionState) {
    setActionStates((current) => ({ ...current, [id]: state }));
  }

  function openReply(message: WorkspaceMessage, body = "") {
    if (!message.threadId) return;
    setReplyDraft({
      to: message.fromEmail,
      subject: toReplySubject(message.subject),
      body,
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

  // "Schedule" from the header: an empty invite draft prefilled with the best
  // open slot. The user types the attendee email + adjusts the time, then
  // approves — nothing books without the explicit "Send invite" in the dialog.
  function openScheduler() {
    setInviteDraft({
      summary: "",
      start: bestSlot?.start,
      end: bestSlot?.end,
      attendees: [],
      description: "",
    });
    setInviteOpen(true);
  }

  function openInvite(message: WorkspaceMessage, slot?: WorkspaceSlot | null) {
    setInviteDraft({
      summary: cleanReplySubject(message.subject, "Meeting"),
      start: slot?.start,
      end: slot?.end,
      attendees: [message.fromEmail],
      description: `From ${message.fromName || message.fromEmail}: ${
        message.snippet
      }`,
    });
    setInviteOpen(true);
  }

  return (
    <div className="min-h-full bg-background pb-16 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {greetingFor(now.getHours())}, {firstName(session?.user.name)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openScheduler}>
              <CalendarPlus className="size-4" />
              <span className="hidden sm:inline">Schedule</span>
            </Button>
            <HeaderAsk />
          </div>
        </div>
      </header>

      {noneConnected ? (
        <OnboardingHero firstName={firstName(session?.user.name)} />
      ) : (
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)_300px] lg:px-8">
          <section className="lg:col-span-3">
            {someDisconnected ? (
              <ConnectFirstState
                gmailConnected={gmailConnected}
                calendarConnected={calendarConnected}
              />
            ) : null}
          </section>

          <section className="lg:col-span-3">
            <DailyBrief
              loading={brief.isLoading || connections.isPending}
              text={
                brief.data?.brief ??
                "SlotNest is checking Gmail and Calendar for what needs approval."
              }
              highlights={brief.data?.highlights ?? []}
            />
          </section>

          <section className="min-h-0 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <SectionTitle icon={Inbox}>Prioritized</SectionTitle>
              <span className="font-mono text-xs text-muted-foreground">
                {queue.length}
              </span>
            </div>
            {connections.isPending || inbox.isLoading ? (
              <QueueSkeleton />
            ) : inbox.isError || !inbox.data ? (
              <PanelEmpty icon={Inbox}>
                Couldn&apos;t load Gmail. Check the connection in settings.
              </PanelEmpty>
            ) : queue.length === 0 ? (
              <PanelEmpty icon={CheckCircle2}>
                No approvals waiting. SlotNest will bring the next decision
                here.
              </PanelEmpty>
            ) : (
              <ul className="max-h-[calc(100svh-18rem)] overflow-y-auto p-2">
                {queue.map((message) => (
                  <li key={message.id}>
                    <QueueRow
                      message={message}
                      active={message.id === selected?.id}
                      state={actionStates[message.id]}
                      onSelect={() => setSelectedId(message.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="min-h-[440px] rounded-xl border border-border bg-card">
            {selected ? (
              <DecisionPanel
                message={selected}
                slot={bestSlot}
                state={actionStates[selected.id]}
                draftBody={selectedDraft}
                draftLoading={selectedDraftLoading}
                onRegenerate={() => regenerateDraft(selected.id)}
                onApprove={() => openReply(selected, selectedDraft ?? "")}
                onEdit={() => openReply(selected, selectedDraft ?? "")}
                onSkip={() => setAction(selected.id, "skipped")}
                onSnooze={() => setAction(selected.id, "snoozed")}
                onInvite={() => openInvite(selected, bestSlot)}
                onOpenInbox={() => router.push("/inbox")}
              />
            ) : (
              <PanelEmpty icon={Sun}>
                You&apos;re clear for now. This panel becomes the approval card
                when an email needs a reply or meeting slot.
              </PanelEmpty>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <CalendarRail
              events={todayEvents}
              slots={todaySlots}
              loading={calendar.isLoading || availability.isLoading}
              connected={calendarConnected}
              onOpenCalendar={() => router.push("/calendar")}
            />
            <WaitingRail
              items={waiting}
              onOpen={() => router.push("/waiting")}
              onFollowUp={(message) =>
                openReply(message, followUpDraft(message))
              }
              onSnooze={(message) => setAction(message.id, "snoozed")}
              onResolved={(message) => setAction(message.id, "resolved")}
            />
          </aside>
        </div>
      )}

      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
        onSent={() => {
          if (replyDraft?.messageId) {
            setAction(replyDraft.messageId, "approved");
          }
          void utils.gmail.inbox.invalidate();
        }}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={inviteDraft}
      />
    </div>
  );
}

function DailyBrief({
  loading,
  text,
  highlights,
}: {
  loading: boolean;
  text: string;
  highlights: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--honey-ink)]">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              AI daily brief
              {loading ? (
                <span className="text-xs font-normal text-muted-foreground">
                  updating
                </span>
              ) : null}
            </div>
            {loading ? (
              <Skeleton className="h-5 max-w-2xl" />
            ) : (
              <p className="text-[0.9375rem] leading-6 text-foreground">
                {text}
              </p>
            )}
          </div>
        </div>
        {highlights.length > 0 ? (
          <ul className="flex flex-col gap-1.5 lg:w-72 lg:shrink-0 lg:border-l lg:border-border lg:pl-6">
            {highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full bg-primary/50"
                  aria-hidden
                />
                {highlight}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function QueueRow({
  message,
  active,
  state,
  onSelect,
}: {
  message: WorkspaceMessage;
  active: boolean;
  state?: ActionState;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-[var(--honey-ink)]">
          {initials(message.fromName || message.fromEmail)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">
            {message.fromName || message.fromEmail}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {formatShortDate(message.date)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
          {message.subject}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <TriageChips
            action={message.triage.action}
            urgency={message.triage.urgency}
          />
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {state === "snoozed" ? "Snoozed" : draftActionLabel(message)}
          </span>
        </span>
      </span>
    </button>
  );
}

function DecisionPanel({
  message,
  slot,
  state,
  draftBody,
  draftLoading,
  onRegenerate,
  onApprove,
  onEdit,
  onSkip,
  onSnooze,
  onInvite,
  onOpenInbox,
}: {
  message: WorkspaceMessage;
  slot: WorkspaceSlot | null;
  state?: ActionState;
  draftBody?: string;
  draftLoading?: boolean;
  onRegenerate: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onSnooze: () => void;
  onInvite: () => void;
  onOpenInbox: () => void;
}) {
  const scheduling = isSchedulingMessage(message);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <TriageChips
            action={message.triage.action}
            urgency={message.triage.urgency}
          />
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {draftActionLabel(message)}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          {message.subject}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {message.fromName || message.fromEmail} ·{" "}
          {formatShortDate(message.date)}
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section>
          <SectionTitle icon={HelpCircle}>Why SlotNest picked it</SectionTitle>
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm leading-6">
            {whyThisMatters(message)}. {message.snippet}
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between gap-2">
            <SectionTitle icon={PenLine}>Prepared reply</SectionTitle>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3 text-[var(--honey-ink)]" />
                {draftLoading ? "Drafting…" : "AI draft"}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={onRegenerate}
                disabled={draftLoading}
                aria-label="Regenerate draft"
              >
                <RefreshCw
                  className={cn("size-3.5", draftLoading && "animate-spin")}
                />
                Regenerate
              </Button>
            </div>
          </div>
          {draftLoading ? (
            <div className="mt-2 space-y-2 rounded-lg border border-border bg-background px-3 py-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-3 text-sm leading-6">
              {draftBody ? draftBody : draftPreview(message)}
            </div>
          )}
        </section>

        {scheduling ? (
          <section>
            <SectionTitle icon={CalendarDays}>Calendar suggestion</SectionTitle>
            <div className="mt-2 rounded-lg border border-border bg-background px-3 py-3 text-sm">
              {slot ? (
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {formatTime(slot.start)} - {formatTime(slot.end)} is open
                    today.
                  </span>
                  <Button variant="secondary" size="sm" onClick={onInvite}>
                    Draft invite
                  </Button>
                </div>
              ) : (
                "No open slot found today. Draft a reply asking for options."
              )}
            </div>
          </section>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        <span className="mr-auto text-xs font-medium text-muted-foreground">
          {state === "approved" ? "Approved" : "Review before anything sends"}
        </span>
        <Button variant="ghost" size="sm" onClick={onOpenInbox}>
          Read
        </Button>
        <Button variant="ghost" size="sm" onClick={onSnooze}>
          Snooze
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" onClick={onApprove} disabled={state === "approved"}>
          <CheckCircle2 className="size-4" />
          Approve
        </Button>
      </div>
    </div>
  );
}

function CalendarRail({
  events,
  slots,
  loading,
  connected,
  onOpenCalendar,
}: {
  events: WorkspaceEvent[];
  slots: WorkspaceSlot[];
  loading: boolean;
  connected: boolean;
  onOpenCalendar: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <SectionTitle icon={CalendarDays}>Today</SectionTitle>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Calendar
        </button>
      </div>
      <div className="space-y-3 p-4">
        {!connected ? (
          <PanelEmpty icon={CalendarDays}>
            Connect Calendar for event context and real open slots.
          </PanelEmpty>
        ) : loading ? (
          <QueueSkeleton compact />
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Next event
              </p>
              <p className="mt-1 truncate text-sm font-semibold">
                {events[0]?.summary ?? "No more events today"}
              </p>
              {events[0] ? (
                <p className="text-xs text-muted-foreground">
                  {events[0].allDay ? "All day" : formatTime(events[0].start)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Best open slot
              </p>
              {slots[0] ? (
                <button
                  type="button"
                  onClick={onOpenCalendar}
                  className="mt-1 flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 text-left text-sm"
                >
                  <span>
                    {formatTime(slots[0].start)} - {formatTime(slots[0].end)}
                  </span>
                  <Clock3 className="size-4 text-muted-foreground" />
                </button>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No open slot in working hours.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function WaitingRail({
  items,
  onOpen,
  onFollowUp,
  onSnooze,
  onResolved,
}: {
  items: WorkspaceMessage[];
  onOpen: () => void;
  onFollowUp: (message: WorkspaceMessage) => void;
  onSnooze: (message: WorkspaceMessage) => void;
  onResolved: (message: WorkspaceMessage) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <SectionTitle icon={Send}>Waiting</SectionTitle>
        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all
        </button>
      </div>
      {items.length === 0 ? (
        <PanelEmpty icon={CheckCircle2}>
          No follow-ups detected from current Gmail context.
        </PanelEmpty>
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(0, 3).map((item) => (
            <li key={item.id} className="px-4 py-3">
              <p className="truncate text-sm font-semibold">{item.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {waitingReason(item)} · {waitingDuration(item.date)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => onFollowUp(item)}
                >
                  Follow up
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onSnooze(item)}
                >
                  Snooze
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onResolved(item)}
                >
                  Resolved
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Connect {missing.map((m) => m.label).join(" and ")} to complete the
          daily workspace.
        </p>
        <div className="flex flex-wrap gap-2">
          {missing.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                href={`/api/corsair/connect?plugin=${m.key}`}
                className={buttonVariants({ size: "sm" })}
              >
                <Icon className="size-3.5" />
                Connect {m.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
              Connect Gmail and Calendar. SlotNest will surface decisions,
              prepare replies, find slots, and wait for approval.
            </p>
          </div>
          <Link
            href="/api/corsair/connect?plugin=gmail&next=googlecalendar"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            <Sparkles className="size-4" />
            Connect Google
          </Link>
        </div>
        <div className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          <PreviewStep icon={Inbox} title="Finds what needs you" />
          <PreviewStep icon={MailCheck} title="Prepares the reply" />
          <PreviewStep icon={ShieldCheck} title="Waits for approval" />
        </div>
      </section>
    </div>
  );
}

function PreviewStep({
  icon: Icon,
  title,
}: {
  icon: typeof Inbox;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

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

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Inbox;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4 text-muted-foreground" />
      <span>{children}</span>
    </div>
  );
}

function PanelEmpty({
  icon: Icon,
  children,
}: {
  icon: typeof Inbox;
  children: React.ReactNode;
}) {
  return (
    <div className="m-4 flex items-start gap-3 rounded-lg border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
      <p>{children}</p>
    </div>
  );
}

function QueueSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: compact ? 2 : 5 }).map((_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={index}
          className="h-16 w-full rounded-lg"
        />
      ))}
    </div>
  );
}
