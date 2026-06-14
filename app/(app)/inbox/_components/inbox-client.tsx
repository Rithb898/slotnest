"use client";
import { Archive, CalendarPlus, PenLine, Reply } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { TriageChips } from "@/components/triage-chips";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { INBOX_POLL_OPTIONS } from "@/lib/query-options";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<SmartView>("all");
  // Gate the inbox fetch on the cheap `connections.list` so a disconnected
  // account never fires (or polls) the throwing Gmail endpoint.
  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const inbox = api.gmail.inbox.useQuery(
    {},
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

  const messages = useMemo(() => {
    if (!inbox.data) return [];
    return inbox.data.messages.filter((m) =>
      VIEW_FILTER[view](m.triage.action),
    );
  }, [inbox.data, view]);

  // Keyboard nav (j/k move, ↵ open, e archive, r reply, c compose). Hints are
  // visible in the action bar; the keyboard path is never required.
  const selectedIndex = messages.findIndex((m) => m.id === selectedId);
  const listRef = useRef<HTMLUListElement>(null);

  const move = useCallback(
    (delta: number) => {
      if (messages.length === 0) return;
      const next =
        selectedIndex < 0
          ? 0
          : Math.min(Math.max(selectedIndex + delta, 0), messages.length - 1);
      setSelectedId(messages[next]?.id ?? null);
    },
    [messages, selectedIndex],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't hijack typing in inputs or when the command bar is open.
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
        // e (archive) / r (reply) / c (compose) are placeholders — wired in the
        // action bar as no-ops for now (no Corsair write contract yet).
        default:
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [move]);

  return (
    <div className="flex h-full w-full">
      {/* List pane */}
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
                    onClick={() => setSelectedId(m.id)}
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
            <Kbd>↵</Kbd> open
          </span>
        </footer>
      </aside>

      {/* Reading pane */}
      <section className="flex flex-1 flex-col overflow-hidden">
        {selectedId ? (
          <MessageView id={selectedId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select an email to read
          </div>
        )}
      </section>
    </div>
  );
}

function MessageView({ id }: { id: string }) {
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
        subject={m.subject}
        fromName={m.fromName}
        fromEmail={m.fromEmail}
      />
      <div className="flex-1 overflow-y-auto">
        {m.html ? (
          <iframe
            title="email-body"
            sandbox=""
            srcDoc={m.html}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <pre className="whitespace-pre-wrap p-6 font-sans text-sm">
            {m.text || m.snippet}
          </pre>
        )}
      </div>
    </>
  );
}

/**
 * Reading-pane action bar (DESIGN: "/inbox upgrades").
 *
 * "→ Invite" is LIVE (plan 003 step 5): it turns the open email into a draft
 * calendar invite — prefilling the title from the subject and the attendee from
 * the sender — which the user reviews and approves before anything is sent
 * (draft-then-approve via <InviteDialog/>).
 *
 * Draft reply / Archive / Reply remain placeholders: they depend on the Agent
 * and on Gmail write contracts not yet documented (inventing them is a STOP
 * condition). They are disabled with explanatory tooltips.
 */
function ActionBar({
  subject,
  fromName,
  fromEmail,
}: {
  subject: string;
  fromName: string | null;
  fromEmail: string;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const draft: InviteDraft = {
    summary: subject && subject !== "(no subject)" ? subject : "Meeting",
    attendees: fromEmail ? [fromEmail] : undefined,
    description: `Re: "${subject}" from ${fromName || fromEmail}.`,
  };

  return (
    <div className="flex items-center gap-1 border-b border-border px-6 py-2">
      <PlaceholderAction
        icon={PenLine}
        label="Draft reply"
        reason="Needs the AI assistant (coming soon)"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setInviteOpen(true)}
        className="font-medium"
      >
        <CalendarPlus className="size-4" />→ Invite
      </Button>
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={draft}
      />
      <PlaceholderAction
        icon={Archive}
        label="Archive"
        reason="Sending/archiving isn't wired yet"
        shortcut="e"
      />
      <PlaceholderAction
        icon={Reply}
        label="Reply"
        reason="Sending isn't wired yet"
        shortcut="r"
      />
    </div>
  );
}

function PlaceholderAction({
  icon: Icon,
  label,
  reason,
  shortcut,
}: {
  icon: typeof PenLine;
  label: string;
  reason: string;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        {/* Render as a span so the tooltip works on a disabled button. */}
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground opacity-50"
        >
          <Icon className="size-4" />
          {label}
          {shortcut ? <Kbd className="ml-1">{shortcut}</Kbd> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
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

function formatDate(date: Date | null, withTime = false): string {
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
