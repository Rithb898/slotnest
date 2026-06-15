"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Inbox,
  MailCheck,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { TriageChips } from "@/components/triage-chips";
import { Button } from "@/components/ui/button";
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
  draftActionLabel,
  draftPreview,
  formatShortDate,
  formatTime,
  isSchedulingMessage,
  sameDay,
  type WorkspaceMessage,
  type WorkspaceSlot,
  whyThisMatters,
} from "@/lib/workspace";
import { api } from "@/trpc/react";

type DraftState = "approved" | "skipped" | "snoozed";

export function DraftsClient() {
  const [states, setStates] = useState<Record<string, DraftState>>({});
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);

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

  const availability = api.calendar.availability.useQuery(
    { ...todayRange, minMinutes: 30 },
    { ...CALENDAR_POLL_OPTIONS, enabled: calendarConnected },
  );

  const slots = useMemo<WorkspaceSlot[]>(() => {
    if (!availability.data || availability.data.connected === false) return [];
    const today = new Date();
    return availability.data.slots.filter((slot) =>
      sameDay(new Date(slot.start), today),
    );
  }, [availability.data]);

  const bestSlot = chooseBestSlot(slots);
  const drafts = useMemo<WorkspaceMessage[]>(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((message) => message.triage.action === "Needs reply")
      .filter((message) => states[message.id] !== "skipped")
      .sort((a, b) => triagePriority(b.triage) - triagePriority(a.triage));
  }, [inbox.data, states]);

  function setState(id: string, state: DraftState) {
    setStates((current) => ({ ...current, [id]: state }));
  }

  function openReply(message: WorkspaceMessage) {
    if (!message.threadId) return;
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

  function openInvite(message: WorkspaceMessage) {
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

  return (
    <div className="min-h-full bg-background pb-16 md:pb-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-prepared replies and invite proposals waiting for review.
            </p>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
            {drafts.length} pending
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <Sparkles className="size-4 text-muted-foreground" />
            Approval queue
          </div>
          {connections.isPending || inbox.isLoading ? (
            <ListSkeleton />
          ) : !gmailConnected ? (
            <EmptyState icon={Inbox}>
              Connect Gmail to generate reply drafts from real messages.
            </EmptyState>
          ) : inbox.isError || !inbox.data ? (
            <EmptyState icon={Inbox}>
              Couldn&apos;t load Gmail drafts.
            </EmptyState>
          ) : drafts.length === 0 ? (
            <EmptyState icon={CheckCircle2}>
              No drafts waiting. New replies will appear here when SlotNest
              finds emails that need decisions.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {drafts.map((message) => {
                const scheduling = isSchedulingMessage(message);
                return (
                  <li key={message.id} className="px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                            {draftActionLabel(message)}
                          </span>
                        </div>
                        <h2 className="mt-2 truncate text-base font-semibold">
                          {message.subject}
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {draftPreview(message)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-md bg-muted px-2 py-1">
                            {whyThisMatters(message)}
                          </span>
                          <span className="rounded-md bg-muted px-2 py-1">
                            {formatShortDate(message.date)}
                          </span>
                          {scheduling && bestSlot ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                              <Clock3 className="size-3.5" />
                              {formatTime(bestSlot.start)} open
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {scheduling ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openInvite(message)}
                          >
                            <CalendarDays className="size-4" />
                            Invite
                          </Button>
                        ) : null}
                        <Button size="sm" onClick={() => openReply(message)}>
                          <MailCheck className="size-4" />
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openReply(message)}
                        >
                          <PenLine className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setState(message.id, "snoozed")}
                        >
                          Snooze
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setState(message.id, "skipped")}
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
        </section>
      </div>

      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
        onSent={() =>
          replyDraft?.messageId && setState(replyDraft.messageId, "approved")
        }
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={inviteDraft}
      />
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
    <div className="m-4 flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
      <p>{children}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={index}
          className="h-24 rounded-lg"
        />
      ))}
    </div>
  );
}
