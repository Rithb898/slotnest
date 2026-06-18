"use client";

import { Inbox, MailCheck, RefreshCw, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function SentClient() {
  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const sent = api.gmail.sent.useQuery(
    { maxResults: 50, forceFresh: true },
    { enabled: gmailConnected },
  );

  const messages = sent.data?.messages ?? [];
  const isLoading = connections.isPending || sent.isLoading;

  function refresh() {
    void sent.refetch();
  }

  return (
    <div className="min-h-full bg-background pb-16 md:pb-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sent</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Emails sent from Gmail, including messages approved in SlotNest.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
              {messages.length} sent
            </div>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={!gmailConnected || sent.isFetching}
            >
              <RefreshCw
                className={cn("size-4", sent.isFetching && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <SendHorizontal className="size-4 text-muted-foreground" />
            Recent sends
          </div>
          {isLoading ? (
            <ListSkeleton />
          ) : !gmailConnected ? (
            <EmptyState icon={Inbox}>
              Connect Gmail to see the emails you have sent.
            </EmptyState>
          ) : sent.isError || !sent.data ? (
            <EmptyState icon={Inbox}>Couldn&apos;t load sent mail.</EmptyState>
          ) : messages.length === 0 ? (
            <EmptyState icon={MailCheck}>No sent emails found.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {messages.map((message) => (
                <li key={message.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          To {message.to || "unknown recipient"}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-1">
                          {formatDate(message.date)}
                        </span>
                      </div>
                      <h2 className="mt-2 truncate text-base font-semibold">
                        {message.subject}
                      </h2>
                      <p className="mt-1 line-clamp-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                        {message.snippet || "No preview available."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                      <MailCheck className="size-3.5" />
                      Sent
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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

function formatDate(value: string | Date | null) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
