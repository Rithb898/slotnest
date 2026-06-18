"use client";

import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  PenLine,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { TriageChips } from "@/components/triage-chips";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CALENDAR_POLL_OPTIONS, INBOX_POLL_OPTIONS } from "@/lib/query-options";
import {
  cleanReplySubject,
  toReplyReferences,
  toReplySubject,
} from "@/lib/reply";
import { triagePriority } from "@/lib/triage";
import {
  chooseBestSlot,
  draftPreview,
  formatShortDate,
  formatTime,
  isSchedulingMessage,
  sameDay,
  type WorkspaceMessage,
  type WorkspaceSlot,
} from "@/lib/workspace";
import { api } from "@/trpc/react";

const PROVIDER_CONNECT = {
  gmail: { label: "Gmail", icon: Mail },
  googlecalendar: { label: "Google Calendar", icon: CalendarDays },
} as const;

type HiddenState = Record<string, true>;

export function DraftsClient() {
  const utils = api.useUtils();
  const [hidden, setHidden] = useState<HiddenState>({});
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null);
  const [draftBodies, setDraftBodies] = useState<Record<string, string>>({});
  const requestedDrafts = useRef<Set<string>>(new Set());

  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const calendarConnected =
    connections.data?.includes("googlecalendar") ?? false;

  const inbox = api.gmail.inbox.useQuery(
    { maxResults: 50 },
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }, []);

  const availability = api.calendar.availability.useQuery(
    { ...todayRange, minMinutes: 30 },
    { ...CALENDAR_POLL_OPTIONS, enabled: calendarConnected },
  );

  const billingEnabled =
    connections.isSuccess && (connections.data?.length ?? 0) > 0;
  const billing = api.billing.summary.useQuery(undefined, {
    enabled: billingEnabled,
  });
  const aiBudget = billing.data?.aiActionBudget ?? null;
  const aiBudgetExhausted = aiBudget?.exhausted ?? false;
  const canUpgrade = billing.data?.currentPlan.name !== "pro";

  const draftReply = api.gmail.draftReply.useMutation({
    onSuccess: () => {
      void utils.gmail.inbox.invalidate();
    },
  });

  const todaySlots = useMemo<WorkspaceSlot[]>(() => {
    if (!availability.data || availability.data.connected === false) return [];
    const today = new Date();
    return availability.data.slots
      .filter((slot) => sameDay(new Date(slot.start), today))
      .slice(0, 5);
  }, [availability.data]);

  const bestSlot = chooseBestSlot(todaySlots);

  const replyCandidates = useMemo<WorkspaceMessage[]>(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((message) => message.triage.action === "Needs reply")
      .filter((message) => message.replyStatus !== "sent")
      .filter((message) => !hidden[message.id])
      .sort((a, b) => triagePriority(b.triage) - triagePriority(a.triage))
      .slice(0, 6);
  }, [hidden, inbox.data]);

  const inviteCandidates = useMemo<WorkspaceMessage[]>(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter(isSchedulingMessage)
      .filter((message) => message.replyStatus !== "sent")
      .filter((message) => !hidden[message.id])
      .sort((a, b) => triagePriority(b.triage) - triagePriority(a.triage))
      .slice(0, 4);
  }, [hidden, inbox.data]);

  useEffect(() => {
    if (!inbox.data) return;
    setDraftBodies((current) => {
      let changed = false;
      const next = { ...current };
      for (const message of inbox.data.messages) {
        const body = message.replyBody?.trim();
        if (!body) continue;
        requestedDrafts.current.add(message.id);
        if (next[message.id] === body) continue;
        next[message.id] = body;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [inbox.data]);

  useEffect(() => {
    if (!gmailConnected || !inbox.data || aiBudgetExhausted) return;

    const missing = replyCandidates
      .filter((message) => !requestedDrafts.current.has(message.id))
      .filter((message) => !message.replyBody?.trim())
      .slice(0, 4);

    if (missing.length === 0) return;

    let cancelled = false;

    void Promise.all(
      missing.map(async (message) => {
        requestedDrafts.current.add(message.id);
        try {
          const result = await draftReply.mutateAsync({
            messageId: message.id,
          });
          if (cancelled) return;
          setDraftBodies((current) => ({
            ...current,
            [message.id]: result.configured ? result.text.trim() : "",
          }));
        } catch {
          if (cancelled) return;
          setDraftBodies((current) =>
            current[message.id] === undefined
              ? { ...current, [message.id]: "" }
              : current,
          );
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [
    aiBudgetExhausted,
    draftReply,
    gmailConnected,
    inbox.data,
    replyCandidates,
  ]);

  function hide(id: string) {
    setHidden((current) => ({ ...current, [id]: true }));
  }

  function openReply(message: WorkspaceMessage) {
    const body =
      draftBodies[message.id]?.trim() ||
      message.replyBody?.trim() ||
      draftPreview(message);
    setActiveReplyId(message.id);
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

  function openInvite(message: WorkspaceMessage) {
    setActiveInviteId(message.id);
    setInviteDraft({
      summary: cleanReplySubject(message.subject, "Meeting"),
      start: bestSlot?.start,
      end: bestSlot?.end,
      attendees: [message.fromEmail],
      description: `From ${message.fromName || message.fromEmail}: ${
        message.snippet
      }`,
    });
    setInviteOpen(true);
  }

  const total = replyCandidates.length + inviteCandidates.length;

  return (
    <div className="min-h-full bg-background pb-16 md:pb-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-prepared replies and invite proposals waiting for approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
              {total} queued
            </span>
            {aiBudgetExhausted && canUpgrade ? (
              <BillingUpgradeButton
                label="Upgrade to refresh"
                size="sm"
                variant="secondary"
              />
            ) : null}
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--honey-ink)]">
                <PenLine className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">Reply drafts</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Drafted replies from Gmail that are ready to review, edit, or
                  send.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                <Inbox className="size-3.5" />
                {replyCandidates.length} drafts
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                <Sparkles className="size-3.5" />
                {aiBudgetExhausted ? "AI locked" : "Live"}
              </span>
            </div>
          </div>

          <div className="mt-4">
            {connections.isPending || inbox.isLoading ? (
              <ListSkeleton />
            ) : !gmailConnected ? (
              <EmptyState icon={Mail}>
                Connect Gmail to surface reply drafts from real threads.
              </EmptyState>
            ) : replyCandidates.length === 0 ? (
              <EmptyState icon={CheckCircle2}>
                No reply drafts are waiting. Open Today or Inbox to prepare the
                next one.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {replyCandidates.map((message) => {
                  const body =
                    draftBodies[message.id]?.trim() ||
                    message.replyBody?.trim() ||
                    "";
                  return (
                    <li key={message.id} className="bg-background px-4 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              {message.fromName || message.fromEmail}
                            </span>
                            <TriageChips
                              action={message.triage.action}
                              urgency={message.triage.urgency}
                            />
                            {message.replyStatus ? (
                              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                {message.replyStatus}
                              </span>
                            ) : null}
                          </div>
                          <h2 className="mt-2 truncate text-base font-semibold">
                            {message.subject}
                          </h2>
                          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {message.snippet}
                          </p>
                          <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-6">
                            {body || draftPreview(message)}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                              <Clock3 className="size-3.5" />
                              {formatShortDate(message.date)}
                            </span>
                            <span className="rounded-md bg-muted px-2 py-1">
                              {message.replyStatus === "edited"
                                ? "User edited"
                                : "AI draft"}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openReply(message)}
                          >
                            <Sparkles className="size-4" />
                            Approve
                          </Button>
                          <Button size="sm" onClick={() => openReply(message)}>
                            <PenLine className="size-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => hide(message.id)}
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--honey-ink)]">
                <CalendarPlus className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">Invite proposals</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Scheduling-related replies with a suggested slot ready for the
                  existing invite dialog.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                <CalendarDays className="size-3.5" />
                {bestSlot ? "Slot found" : "No slot"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                <Sparkles className="size-3.5" />
                {inviteCandidates.length} proposals
              </span>
            </div>
          </div>

          <div className="mt-4">
            {!calendarConnected ? (
              <ConnectFirstState
                provider="googlecalendar"
                description="Connect Google Calendar to suggest a real open slot."
              />
            ) : inviteCandidates.length === 0 ? (
              <EmptyState icon={CalendarPlus}>
                No invite proposals right now. Scheduling requests will show up
                here automatically.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {inviteCandidates.map((message) => (
                  <li key={message.id} className="bg-background px-4 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {message.fromName || message.fromEmail}
                          </span>
                          <TriageChips
                            action={message.triage.action}
                            urgency={message.triage.urgency}
                          />
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            {isSchedulingMessage(message)
                              ? "Scheduling"
                              : "Invite"}
                          </span>
                        </div>
                        <h2 className="mt-2 truncate text-base font-semibold">
                          {cleanReplySubject(message.subject, "Meeting")}
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {message.snippet}
                        </p>
                        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-6">
                          {bestSlot ? (
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="size-4 text-muted-foreground" />
                              Suggested slot: {formatTime(bestSlot.start)} -{" "}
                              {formatTime(bestSlot.end)}
                            </span>
                          ) : (
                            "No open slot found today. Invite drafts will default to the next available half hour."
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                            <Clock3 className="size-3.5" />
                            {formatShortDate(message.date)}
                          </span>
                          <span className="rounded-md bg-muted px-2 py-1">
                            {message.fromEmail}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openInvite(message)}
                        >
                          <CalendarPlus className="size-4" />
                          Draft invite
                        </Button>
                        <Button size="sm" onClick={() => openInvite(message)}>
                          <PenLine className="size-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => hide(message.id)}
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          Multi-action proposals stay in the command bar for now. Open
          <kbd className="mx-1 rounded border border-border bg-background px-1.5 py-0.5 text-[0.6875rem] font-medium text-foreground">
            Cmd/Ctrl K
          </kbd>
          if you want SlotNest to propose a combined reply or invite flow.
        </section>
      </div>

      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
        onSent={() => {
          if (activeReplyId) hide(activeReplyId);
          void utils.gmail.inbox.invalidate();
        }}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={inviteDraft}
        onSent={() => {
          if (activeInviteId) hide(activeInviteId);
          void utils.gmail.inbox.invalidate();
        }}
      />
    </div>
  );
}

function ConnectFirstState({
  provider,
  description,
}: {
  provider: keyof typeof PROVIDER_CONNECT;
  description: string;
}) {
  const { label, icon: Icon } = PROVIDER_CONNECT[provider];
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link
          href={`/api/corsair/connect?plugin=${provider}`}
          className={buttonVariants({ size: "sm" })}
        >
          <Icon className="size-3.5" />
          Connect {label}
        </Link>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  children,
}: {
  icon: typeof Inbox;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
        <p>{children}</p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={index}
          className="h-24 rounded-lg"
        />
      ))}
    </div>
  );
}
