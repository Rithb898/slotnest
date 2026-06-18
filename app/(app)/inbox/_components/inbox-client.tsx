"use client";

import { Archive, CalendarPlus, PenLine } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { TriageChips } from "@/components/triage-chips";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INBOX_POLL_OPTIONS } from "@/lib/query-options";
import { toReplyReferences, toReplySubject } from "@/lib/reply";
import type { TriageAction } from "@/lib/triage";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type SmartView = "needs-reply" | "fyi" | "all";

const VIEW_FILTER: Record<SmartView, (action: TriageAction) => boolean> = {
  "needs-reply": (a) => a === "Needs reply",
  fyi: (a) => a === "FYI",
  all: () => true,
};

export function InboxClient() {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("message"),
  );
  const [view, setView] = useState<SmartView>("all");
  const [archivedThreadIds, setArchivedThreadIds] = useState<string[]>([]);
  const [archivedMessageIds, setArchivedMessageIds] = useState<string[]>([]);
  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const inbox = api.gmail.inbox.useQuery(
    {},
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

  const messages = useMemo(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((m) => VIEW_FILTER[view](m.triage.action))
      .filter((m) =>
        m.threadId
          ? !archivedThreadIds.includes(m.threadId)
          : !archivedMessageIds.includes(m.id),
      );
  }, [archivedMessageIds, archivedThreadIds, inbox.data, view]);

  const selectedThreadId = searchParams.get("thread");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setSelectedId(searchParams.get("message"));
  }, [searchParams]);

  const setInboxUrl = useCallback(
    (messageId: string | null, threadId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (messageId) {
        params.set("message", messageId);
      } else {
        params.delete("message");
      }
      if (threadId) {
        params.set("thread", threadId);
      } else {
        params.delete("thread");
      }
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        query ? `/inbox?${query}` : "/inbox",
      );
    },
    [searchParams],
  );

  const selectMessage = useCallback(
    (messageId: string, threadId: string | null) => {
      setSelectedId(messageId);
      setInboxUrl(messageId, threadId);
    },
    [setInboxUrl],
  );

  useEffect(() => {
    if (selectedId && messages.some((message) => message.id === selectedId)) {
      return;
    }
    if (selectedId && messages.length === 0) {
      setSelectedId(null);
      setInboxUrl(null, null);
    }
  }, [messages, selectedId, setInboxUrl]);

  const selectedIndex = messages.findIndex((m) => m.id === selectedId);

  const move = useCallback(
    (delta: number) => {
      if (messages.length === 0) return;
      const nextIndex =
        selectedIndex < 0
          ? 0
          : Math.min(Math.max(selectedIndex + delta, 0), messages.length - 1);
      const nextMessage = messages[nextIndex];
      if (!nextMessage) return;
      selectMessage(nextMessage.id, nextMessage.threadId);
    },
    [messages, selectMessage, selectedIndex],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "j":
          e.preventDefault();
          move(1);
          break;
        case "k":
          e.preventDefault();
          move(-1);
          break;
        default:
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const handleArchived = useCallback(
    ({
      messageId,
      threadId,
    }: {
      messageId: string;
      threadId: string | null;
    }) => {
      if (threadId) {
        setArchivedThreadIds((current) =>
          current.includes(threadId) ? current : [...current, threadId],
        );
      } else {
        setArchivedMessageIds((current) =>
          current.includes(messageId) ? current : [...current, messageId],
        );
      }
      setSelectedId(null);
      setInboxUrl(null, null);
    },
    [setInboxUrl],
  );

  return (
    <div className="flex h-full w-full">
      <aside className="flex w-full max-w-sm flex-col border-r border-border">
        <header className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold">Inbox</h1>
            {inbox.data ? (
              <span className="font-mono text-xs text-muted-foreground">
                {messages.length}
              </span>
            ) : null}
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as SmartView)}>
            <TabsList className="w-full">
              <TabsTrigger value="needs-reply" className="flex-1">
                Needs reply
              </TabsTrigger>
              <TabsTrigger value="fyi" className="flex-1">
                FYI
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>
        <div className="flex-1 overflow-y-auto">
          {inbox.isLoading ? (
            <ListSkeleton />
          ) : inbox.isError || !inbox.data ? (
            <p className="p-4 text-sm text-destructive">
              Couldn&apos;t load your inbox. Is Gmail connected?
            </p>
          ) : messages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No messages.</p>
          ) : (
            <ul ref={listRef}>
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => selectMessage(m.id, m.threadId)}
                    className={cn(
                      "relative flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent",
                      selectedId === m.id && "bg-accent",
                    )}
                  >
                    {selectedId === m.id ? (
                      <span
                        className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          m.unread ? "font-semibold" : "font-normal",
                        )}
                      >
                        {m.fromName || m.fromEmail}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatDate(m.date)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "truncate text-sm",
                        m.unread ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {m.subject}
                    </span>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {m.snippet}
                      </span>
                      <TriageChips
                        action={m.triage.action}
                        urgency={m.triage.urgency}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>r</Kbd> draft
          </span>
          <span className="flex items-center gap-1">
            <Kbd>e</Kbd> archive
          </span>
        </footer>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden">
        {selectedId ? (
          selectedThreadId ? (
            <ThreadView
              threadId={selectedThreadId}
              selectedMessageId={selectedId}
              onArchived={handleArchived}
            />
          ) : (
            <MessageView id={selectedId} onArchived={handleArchived} />
          )
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select an email to read
          </div>
        )}
      </section>
    </div>
  );
}

function MessageView({
  id,
  onArchived,
}: {
  id: string;
  onArchived: (target: { messageId: string; threadId: string | null }) => void;
}) {
  const message = api.gmail.message.useQuery({ id });

  if (message.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (message.isError || !message.data) {
    return (
      <p className="p-6 text-sm text-destructive">
        Couldn&apos;t load message.
      </p>
    );
  }

  const m = message.data;
  return (
    <>
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold">{m.subject}</h2>
        <p className="mt-1 text-sm">
          <span className="font-medium">{m.fromName || m.fromEmail}</span>{" "}
          <span className="font-mono text-muted-foreground">
            &lt;{m.fromEmail}&gt;
          </span>
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {formatDate(m.date, true)}
        </p>
      </header>
      <ActionBar
        message={{
          id: m.id,
          subject: m.subject,
          fromName: m.fromName,
          fromEmail: m.fromEmail,
          threadId: m.threadId,
          messageIdHeader: m.messageIdHeader,
          references: m.references,
          date: m.date,
        }}
        onArchived={onArchived}
      />
      <div className="flex-1 overflow-y-auto">{renderMessageBody(m)}</div>
    </>
  );
}

function ThreadView({
  threadId,
  selectedMessageId,
  onArchived,
}: {
  threadId: string;
  selectedMessageId: string;
  onArchived: (target: { messageId: string; threadId: string | null }) => void;
}) {
  const thread = api.gmail.thread.useQuery({ threadId });

  if (thread.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (thread.isError || !thread.data) {
    return (
      <p className="p-6 text-sm text-destructive">Couldn&apos;t load thread.</p>
    );
  }

  const activeMessage =
    thread.data.messages.find((message) => message.id === selectedMessageId) ??
    thread.data.messages.at(-1);

  if (!activeMessage) {
    return (
      <p className="p-6 text-sm text-muted-foreground">No thread messages.</p>
    );
  }

  return (
    <>
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold">{activeMessage.subject}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {thread.data.messages.length} messages in chronological order
        </p>
      </header>
      <ActionBar
        message={{
          id: activeMessage.id,
          subject: activeMessage.subject,
          fromName: activeMessage.fromName,
          fromEmail: activeMessage.fromEmail,
          threadId: activeMessage.threadId,
          messageIdHeader: activeMessage.messageIdHeader,
          references: activeMessage.references,
          date: activeMessage.date,
        }}
        onArchived={onArchived}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-4">
          {thread.data.messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "overflow-hidden rounded-xl border border-border bg-card",
                message.id === activeMessage.id && "ring-1 ring-primary/30",
              )}
            >
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {message.fromName || message.fromEmail}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {message.fromEmail}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {formatDate(message.date, true)}
                  </div>
                </div>
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                {renderMessageBody(message)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function ActionBar({
  message,
  onArchived,
}: {
  message: {
    id: string;
    subject: string;
    fromName: string | null;
    fromEmail: string;
    threadId: string | null;
    messageIdHeader: string | null;
    references: string | null;
    date: Date | string | null;
  };
  onArchived: (target: { messageId: string; threadId: string | null }) => void;
}) {
  const utils = api.useUtils();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const draft: InviteDraft = {
    summary:
      message.subject && message.subject !== "(no subject)"
        ? message.subject
        : "Meeting",
    attendees: message.fromEmail ? [message.fromEmail] : undefined,
    description: `Re: "${message.subject}" from ${message.fromName || message.fromEmail}.`,
  };
  const replyDraft: ReplyDraft | null =
    message.threadId && message.fromEmail
      ? {
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
        }
      : null;

  const archive = api.gmail.archive.useMutation({
    onSuccess: () => {
      toast.success("Archived");
      void utils.gmail.inbox.invalidate();
      void utils.gmail.message.invalidate();
      void utils.gmail.thread.invalidate();
      void utils.workspace.dailyBrief.invalidate();
      onArchived({ messageId: message.id, threadId: message.threadId });
    },
    onError: (error) => {
      toast.error("Couldn't archive", { description: error.message });
    },
  });

  const runArchive = useCallback(() => {
    archive.mutate({
      messageId: message.id,
      threadId: message.threadId,
      sourceInternalDate:
        message.date instanceof Date
          ? message.date.toISOString()
          : (message.date ?? undefined),
    });
  }, [archive, message]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.key === "r" && replyDraft) {
        e.preventDefault();
        setReplyOpen(true);
      }
      if (e.key === "e" && !archive.isPending) {
        e.preventDefault();
        runArchive();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [archive.isPending, replyDraft, runArchive]);

  return (
    <div className="flex items-center gap-1 border-b border-border px-6 py-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setReplyOpen(true)}
        disabled={!replyDraft}
        className="font-medium"
      >
        <PenLine className="size-4" />
        Draft reply
        <Kbd className="ml-1">r</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setInviteOpen(true)}
        className="font-medium"
      >
        <CalendarPlus className="size-4" />→ Invite
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={runArchive}
        disabled={archive.isPending}
        className="font-medium"
      >
        <Archive className="size-4" />
        {archive.isPending ? "Archiving..." : "Archive"}
        <Kbd className="ml-1">e</Kbd>
      </Button>
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={draft}
      />
      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
      />
    </div>
  );
}

function renderMessageBody(message: {
  html: string | null;
  text: string | null;
  snippet: string;
}) {
  return message.html ? (
    <iframe
      title="email-body"
      sandbox=""
      srcDoc={message.html}
      className="h-[32rem] w-full border-0 bg-white"
    />
  ) : (
    <pre className="whitespace-pre-wrap p-6 font-sans text-sm">
      {message.text || message.snippet}
    </pre>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={i}
          className="flex flex-col gap-2 border-b border-border px-4 py-3"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function formatDate(date: Date | string | null, withTime = false): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay && !withTime) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
