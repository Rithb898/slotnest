"use client";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function InboxClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inbox = api.gmail.inbox.useQuery({});

  return (
    <div className="flex h-svh w-full">
      {/* List pane */}
      <aside className="flex w-full max-w-sm flex-col border-r border-border">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-sm font-semibold">Inbox</h1>
          {inbox.data ? (
            <span className="text-xs text-muted-foreground">
              {inbox.data.messages.length}
            </span>
          ) : null}
        </header>
        <div className="flex-1 overflow-y-auto">
          {inbox.isLoading ? (
            <ListSkeleton />
          ) : inbox.isError || !inbox.data ? (
            <p className="p-4 text-sm text-destructive">
              Couldn&apos;t load your inbox. Is Gmail connected?
            </p>
          ) : inbox.data.messages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No messages.</p>
          ) : (
            <ul>
              {inbox.data.messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedId === m.id && "bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          m.unread ? "font-semibold" : "font-normal",
                        )}
                      >
                        {m.fromName || m.fromEmail}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
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
                    <span className="truncate text-xs text-muted-foreground">
                      {m.snippet}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
          <span className="text-muted-foreground">&lt;{m.fromEmail}&gt;</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(m.date, true)}
        </p>
      </header>
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
