"use client";

import { CalendarPlus, Clock, ExternalLink, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

/**
 * /calendar — a quiet week/agenda view of REAL Google Calendar events with the
 * open gaps (free-slot finder) made visible, plus a draft-then-approve
 * send-invite affordance (plan 003 step 5).
 *
 * One Light Rule: honey is spent on the active nav rail (the sidebar), so this
 * screen uses NO honey-fill actions. Selection of a day uses the neutral
 * day-picker; the "Send invite" CTA is the neutral `secondary` variant.
 */

type CalEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  attendees: string[];
};

type Slot = { start: string; end: string };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
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

function durationLabel(slot: Slot): string {
  const mins = Math.round(
    (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000,
  );
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function CalendarClient() {
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState<InviteDraft | null>(null);

  // Pull a week of data from the selected day forward.
  const range = useMemo(() => {
    const min = startOfDay(selectedDay);
    const max = new Date(min.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { timeMin: min.toISOString(), timeMax: max.toISOString() };
  }, [selectedDay]);

  const eventsQuery = api.calendar.events.useQuery(range);
  const availabilityQuery = api.calendar.availability.useQuery(range);

  const connected = eventsQuery.data?.connected ?? true;

  const dayEvents = useMemo<CalEvent[]>(() => {
    const items = eventsQuery.data?.events ?? [];
    return items.filter((e) =>
      e.start ? sameDay(new Date(e.start), selectedDay) : false,
    );
  }, [eventsQuery.data, selectedDay]);

  const daySlots = useMemo<Slot[]>(() => {
    const items = availabilityQuery.data?.slots ?? [];
    return items.filter((s) => sameDay(new Date(s.start), selectedDay));
  }, [availabilityQuery.data, selectedDay]);

  function openInvite(prefill?: Partial<InviteDraft>) {
    setDraft({ summary: "", ...prefill });
    setInviteOpen(true);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Your week, with the open gaps in plain sight.
            </p>
          </div>
          <Button variant="secondary" onClick={() => openInvite()}>
            <CalendarPlus className="size-4" />
            New invite
          </Button>
        </header>

        {connected === false ? (
          <NotConnected />
        ) : (
          <div className="grid gap-8 md:grid-cols-[auto_1fr]">
            {/* Day picker */}
            <div className="shrink-0">
              <Calendar
                mode="single"
                selected={selectedDay}
                onSelect={(d) => d && setSelectedDay(d)}
                className="rounded-xl border border-border"
              />
            </div>

            {/* Agenda + free slots for the selected day */}
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">
                  {selectedDay.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
                {eventsQuery.isLoading ? (
                  <ListSkeleton />
                ) : dayEvents.length === 0 ? (
                  <EmptyCard>Nothing scheduled this day.</EmptyCard>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {dayEvents.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[0.9375rem] font-semibold">
                            {e.summary}
                          </span>
                          {e.htmlLink ? (
                            <a
                              href={e.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              aria-label="Open in Google Calendar"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {e.allDay
                              ? "All day"
                              : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                          </span>
                          {e.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              <span className="truncate">{e.location}</span>
                            </span>
                          ) : null}
                          {e.attendees.length ? (
                            <span>
                              {e.attendees.length} attendee
                              {e.attendees.length > 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Free-slot finder */}
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Open gaps</h2>
                {availabilityQuery.isLoading ? (
                  <ListSkeleton />
                ) : daySlots.length === 0 ? (
                  <EmptyCard>No open gaps in working hours this day.</EmptyCard>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {daySlots.map((s) => (
                      <li key={s.start}>
                        <button
                          type="button"
                          onClick={() =>
                            openInvite({ start: s.start, end: s.end })
                          }
                          className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-sm transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)]"
                        >
                          <span className="font-medium">
                            {fmtTime(s.start)} – {fmtTime(s.end)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {durationLabel(s)} free
                          </span>
                          <CalendarPlus className="size-3.5 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={draft}
      />
    </div>
  );
}

function NotConnected() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      Google Calendar isn&apos;t connected yet.{" "}
      <a href="/connections" className="text-[var(--honey-ink)] underline">
        Connect it
      </a>{" "}
      to see your events and free gaps.
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          key={i}
          className="h-16 w-full rounded-lg"
        />
      ))}
    </div>
  );
}
