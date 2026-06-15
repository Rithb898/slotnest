"use client";

import {
  CheckCircle2,
  Clock3,
  Inbox,
  MailCheck,
  Send,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { TriageChips } from "@/components/triage-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { INBOX_POLL_OPTIONS } from "@/lib/query-options";
import { toReplyReferences, toReplySubject } from "@/lib/reply";
import {
  followUpDraft,
  formatShortDate,
  isWaitingMessage,
  type WorkspaceMessage,
  waitingDuration,
  waitingReason,
} from "@/lib/workspace";
import { api } from "@/trpc/react";

type WaitingState = "resolved" | "snoozed";

export function WaitingClient() {
  const [states, setStates] = useState<Record<string, WaitingState>>({});
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);

  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const inbox = api.gmail.inbox.useQuery(
    { maxResults: 50 },
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

  const waiting = useMemo<WorkspaceMessage[]>(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter(isWaitingMessage)
      .filter((message) => states[message.id] !== "resolved")
      .sort((a, b) => {
        const ad = a.date ? new Date(a.date).getTime() : 0;
        const bd = b.date ? new Date(b.date).getTime() : 0;
        return ad - bd;
      });
  }, [inbox.data, states]);

  function setState(id: string, state: WaitingState) {
    setStates((current) => ({ ...current, [id]: state }));
  }

  function openFollowUp(message: WorkspaceMessage) {
    if (!message.threadId) return;
    setReplyDraft({
      to: message.fromEmail,
      subject: toReplySubject(message.subject),
      body: followUpDraft(message),
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Waiting</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Threads that look ready for a nudge, snooze, or resolved mark.
            </p>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
            {waiting.length} open
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <Send className="size-4 text-muted-foreground" />
            Follow-up candidates
          </div>
          {connections.isPending || inbox.isLoading ? (
            <ListSkeleton />
          ) : !gmailConnected ? (
            <EmptyState icon={Inbox}>
              Connect Gmail to detect follow-up candidates from real threads.
            </EmptyState>
          ) : inbox.isError || !inbox.data ? (
            <EmptyState icon={Inbox}>
              Couldn&apos;t load waiting threads.
            </EmptyState>
          ) : waiting.length === 0 ? (
            <EmptyState icon={CheckCircle2}>
              Nothing looks overdue from current Gmail context.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {waiting.map((message) => (
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
                        {states[message.id] === "snoozed" ? (
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            Snoozed
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 truncate text-base font-semibold">
                        {message.subject}
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {message.snippet}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          <Clock3 className="size-3.5" />
                          Waiting {waitingDuration(message.date)}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-1">
                          {waitingReason(message)}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-1">
                          Last seen {formatShortDate(message.date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" onClick={() => openFollowUp(message)}>
                        <MailCheck className="size-4" />
                        Follow up
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openFollowUp(message)}
                      >
                        <Sparkles className="size-4" />
                        Edit draft
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
                        onClick={() => setState(message.id, "resolved")}
                      >
                        Resolved
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
        onSent={() =>
          replyDraft?.messageId && setState(replyDraft.messageId, "resolved")
        }
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
