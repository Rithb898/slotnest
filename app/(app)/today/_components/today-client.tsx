"use client";

import { ArrowRight, CalendarDays, Clock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useCommandBar } from "@/components/command-bar";
import { TriageChips } from "@/components/triage-chips";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { triagePriority } from "@/lib/triage";
import { api } from "@/trpc/react";

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

/**
 * /today — the "approve, don't read" home (DESIGN + plan 003).
 *
 * One calm, readable column (NOT a grid of metric cards). Three zones:
 *   1. Needs your reply — triaged emails that need action. Drafted replies
 *      depend on the deferred Agent, so each row shows the sender + triage
 *      chips + a "draft pending" affordance and deep-links into /inbox.
 *   2. On your calendar today — calendar data depends on the deferred calendar
 *      step, so this is an honest "connect calendar" placeholder zone.
 *   3. Ask SlotNest — an inline prompt that opens the ⌘K command bar.
 */
export function TodayClient() {
  const router = useRouter();
  const inbox = api.gmail.inbox.useQuery({});

  // Today's calendar window (00:00 → 24:00 local) for zone 2.
  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }, []);
  const calendar = api.calendar.events.useQuery(todayRange);

  const todayEvents = useMemo(() => {
    if (!calendar.data || calendar.data.connected === false) return [];
    const today = new Date();
    return calendar.data.events
      .filter((e) => (e.start ? sameDay(new Date(e.start), today) : false))
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
      .slice(0, 6);
  }, [calendar.data]);

  const calendarConnected = calendar.data?.connected ?? true;

  const needsReply = useMemo(() => {
    if (!inbox.data) return [];
    return inbox.data.messages
      .filter((m) => m.triage.action !== "Ignore")
      .sort((a, b) => triagePriority(b.triage) - triagePriority(a.triage))
      .slice(0, 8);
  }, [inbox.data]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">
            What needs you — approve, don&apos;t read.
          </p>
        </header>

        {/* Zone 1 — Needs your reply */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Needs your reply</h2>
          {inbox.isLoading ? (
            <ZoneSkeleton />
          ) : inbox.isError || !inbox.data ? (
            <EmptyCard>
              Couldn&apos;t load your inbox.{" "}
              <button
                type="button"
                className="text-[var(--honey-ink)] underline"
                onClick={() => router.push("/connections")}
              >
                Is Gmail connected?
              </button>
            </EmptyCard>
          ) : needsReply.length === 0 ? (
            <EmptyCard>Nothing needs you right now. Inbox is calm.</EmptyCard>
          ) : (
            <ul className="flex flex-col gap-2">
              {needsReply.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => router.push("/inbox")}
                    className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3 text-left transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[0.9375rem] font-semibold">
                        {m.fromName || m.fromEmail}
                      </span>
                      <TriageChips
                        action={m.triage.action}
                        urgency={m.triage.urgency}
                      />
                    </div>
                    <span className="truncate text-sm text-muted-foreground">
                      {m.subject}
                    </span>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      {/* Drafted reply depends on the deferred Agent. */}
                      <span className="text-xs italic text-muted-foreground">
                        Draft pending…
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Kbd>↵</Kbd> approve
                        </span>
                        <span className="flex items-center gap-1">
                          <Kbd>e</Kbd> skip
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Zone 2 — On your calendar today (real Google Calendar data) */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">On your calendar today</h2>
          {calendar.isLoading ? (
            <ZoneSkeleton />
          ) : calendarConnected === false ? (
            <EmptyCard>
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  Calendar isn&apos;t connected yet.{" "}
                  <button
                    type="button"
                    className="text-[var(--honey-ink)] underline"
                    onClick={() => router.push("/connections")}
                  >
                    Connect Google Calendar
                  </button>{" "}
                  to see today&apos;s events and free gaps.
                </span>
              </span>
            </EmptyCard>
          ) : todayEvents.length === 0 ? (
            <EmptyCard>Nothing on your calendar today. Clear runway.</EmptyCard>
          ) : (
            <ul className="flex flex-col gap-2">
              {todayEvents.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => router.push("/calendar")}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)]"
                  >
                    <span className="truncate text-[0.9375rem] font-medium">
                      {e.summary}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      {e.allDay
                        ? "All day"
                        : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Zone 3 — Ask SlotNest */}
        <AskSlotNest />
      </div>
    </div>
  );
}

function AskSlotNest() {
  const { setOpen } = useCommandBar();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Ask SlotNest</h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)]"
      >
        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1">
          Reply to Sam and find us 30 minutes Thursday…
        </span>
        <Kbd>⌘K</Kbd>
        <ArrowRight className="size-4 text-muted-foreground" />
      </button>
    </section>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      {children}
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
          className="h-20 w-full rounded-lg"
        />
      ))}
    </div>
  );
}
