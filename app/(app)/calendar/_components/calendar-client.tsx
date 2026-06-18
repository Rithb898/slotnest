"use client";

import { useMemo, useState } from "react";

import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { CALENDAR_POLL_OPTIONS } from "@/lib/query-options";
import { api } from "@/trpc/react";

/**
 * /calendar - a quiet week/agenda view of REAL Google Calendar events with the
 * open gaps (free-slot finder) made visible, plus a draft-then-approve
 * send-invite affordance (plan 003 step 5).
 *
 * One Light Rule: honey is spent on the active nav rail (the sidebar), so this
 * screen uses flat monochrome surfaces and approval-gated invite actions.
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

function dateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function shortDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function eventTimeLabel(event: CalEvent): string {
  if (event.allDay) return "All day";
  const start = fmtTime(event.start);
  const end = fmtTime(event.end);
  if (!start && !end) return "Time not set";
  return [start, end].filter(Boolean).join(" - ");
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

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "bg-[#EDF3EC] text-[#346538]"
      : tone === "blue"
        ? "bg-[#E1F3FE] text-[#1F6C9F]"
        : "bg-[#F7F6F3] text-[#2F3437]";

  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
      <div className="text-[0.68rem] font-semibold tracking-[0.08em] text-[#787774] uppercase">
        {label}
      </div>
      <div
        className={`mt-3 inline-flex rounded-[999px] px-2.5 py-1 text-sm font-semibold ${toneClass}`}
      >
        {value}
      </div>
    </div>
  );
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

  const eventsQuery = api.calendar.events.useQuery(
    range,
    CALENDAR_POLL_OPTIONS,
  );
  const availabilityQuery = api.calendar.availability.useQuery(
    range,
    CALENDAR_POLL_OPTIONS,
  );

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

  const rangeEvents = eventsQuery.data?.events ?? [];
  const nextEvent = dayEvents[0] ?? null;

  function openInvite(prefill?: Partial<InviteDraft>) {
    setDraft({ summary: "", ...prefill });
    setInviteOpen(true);
  }

  return (
    <div className="container h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-8 lg:py-10">
        <header className="grid gap-5 border-b border-[#EAEAEA] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.68rem] font-semibold tracking-[0.12em] text-[#787774] uppercase">
              Primary calendar
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-[#111111] sm:text-5xl">
              {dateLabel(selectedDay)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#787774]">
              A quiet view of the day: what is booked, what is open, and where
              an invite can be sent for approval.
            </p>
          </div>

          <Button
            onClick={() => openInvite()}
            className="h-9 rounded-[6px] border-[#111111] bg-[#111111] px-4 text-white shadow-none hover:bg-[#333333] active:scale-[0.98]"
          >
            <span className="mr-1.5 text-base leading-none">+</span>
            New invite
          </Button>
        </header>

        {connected === false ? (
          <NotConnected />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[21rem_1fr]">
            <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
              <div className="rounded-xl border border-[#EAEAEA] bg-white p-3">
                <Calendar
                  mode="single"
                  selected={selectedDay}
                  onSelect={(d) => d && setSelectedDay(d)}
                  className="w-full bg-transparent p-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="This day"
                  value={`${dayEvents.length} booked`}
                  tone={dayEvents.length ? "blue" : "neutral"}
                />
                <StatTile
                  label="Open"
                  value={`${daySlots.length} gaps`}
                  tone={daySlots.length ? "green" : "neutral"}
                />
                <div className="col-span-2 rounded-xl border border-[#EAEAEA] bg-white p-5">
                  <div className="text-[0.68rem] font-semibold tracking-[0.08em] text-[#787774] uppercase">
                    Next up
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[#111111]">
                    {nextEvent?.summary ?? "No more events selected"}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[#787774]">
                    {nextEvent
                      ? eventTimeLabel(nextEvent)
                      : shortDateLabel(selectedDay)}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-5">
                  <div className="text-[0.68rem] font-semibold tracking-[0.08em] text-[#787774] uppercase">
                    Week window
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[#2F3437]">
                    {rangeEvents.length} events from{" "}
                    {shortDateLabel(selectedDay)} through{" "}
                    {shortDateLabel(new Date(range.timeMax))}.
                  </div>
                </div>
              </div>
            </aside>

            <main className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <section className="rounded-xl border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#EAEAEA] pb-4">
                  <div>
                    <p className="font-mono text-[0.68rem] font-semibold tracking-[0.1em] text-[#787774] uppercase">
                      Agenda
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-[#111111]">
                      Booked time
                    </h2>
                  </div>
                  <span className="rounded-[999px] bg-[#FBF3DB] px-2.5 py-1 text-xs font-semibold tracking-[0.05em] text-[#956400] uppercase">
                    {dayEvents.length} items
                  </span>
                </div>
                {eventsQuery.isLoading ? (
                  <ListSkeleton />
                ) : dayEvents.length === 0 ? (
                  <EmptyCard
                    title="Nothing scheduled"
                    body="This day is clear in the selected calendar window."
                  />
                ) : (
                  <ol className="flex flex-col divide-y divide-[#EAEAEA]">
                    {dayEvents.map((e, index) => (
                      <li
                        key={e.id}
                        className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[5.5rem_1fr_auto] sm:items-start"
                      >
                        <div className="font-mono text-xs leading-5 text-[#787774]">
                          <div>{eventTimeLabel(e)}</div>
                          <div>#{String(index + 1).padStart(2, "0")}</div>
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-[0.98rem] font-semibold text-[#111111]">
                            {e.summary}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#787774]">
                            {e.location ? (
                              <span className="rounded-[999px] bg-[#F7F6F3] px-2.5 py-1">
                                {e.location}
                              </span>
                            ) : null}
                            {e.attendees.length ? (
                              <span className="rounded-[999px] bg-[#E1F3FE] px-2.5 py-1 text-[#1F6C9F]">
                                {e.attendees.length} attendee
                                {e.attendees.length > 1 ? "s" : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {e.htmlLink ? (
                          <a
                            href={e.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[6px] border border-[#EAEAEA] px-3 py-1.5 text-xs font-semibold text-[#2F3437] transition-colors hover:bg-[#F7F6F3]"
                          >
                            Open
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="rounded-xl border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <div className="mb-5 border-b border-[#EAEAEA] pb-4">
                  <p className="font-mono text-[0.68rem] font-semibold tracking-[0.1em] text-[#787774] uppercase">
                    Open gaps
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-[#111111]">
                    Send-ready slots
                  </h2>
                </div>
                {availabilityQuery.isLoading ? (
                  <ListSkeleton />
                ) : daySlots.length === 0 ? (
                  <EmptyCard
                    title="No slots found"
                    body="Working hours are fully occupied for this selected day."
                  />
                ) : (
                  <ul className="grid gap-2">
                    {daySlots.map((s) => (
                      <li key={s.start}>
                        <button
                          type="button"
                          onClick={() =>
                            openInvite({ start: s.start, end: s.end })
                          }
                          className="grid w-full gap-2 rounded-lg border border-dashed border-[#D9D9D6] bg-[#F9F9F8] px-3 py-3 text-left transition-colors hover:border-[#BDBDB8] hover:bg-white active:scale-[0.99]"
                        >
                          <span className="font-mono text-xs font-semibold text-[#111111]">
                            {fmtTime(s.start)} - {fmtTime(s.end)}
                          </span>
                          <span className="text-xs text-[#787774]">
                            {durationLabel(s)} free
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </main>
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
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-6 text-sm leading-6 text-[#787774]">
      <div className="text-base font-semibold text-[#111111]">
        Google Calendar is not connected yet.
      </div>
      <p className="mt-2">
        Connect it to see events, open gaps, and approval-ready invite drafts.
      </p>
      <a
        href="/settings"
        className="mt-4 inline-flex rounded-[6px] bg-[#111111] px-3 py-2 text-sm font-semibold text-white hover:bg-[#333333]"
      >
        Connect Calendar
      </a>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] px-4 py-5">
      <div className="text-sm font-semibold text-[#111111]">{title}</div>
      <p className="mt-1 text-sm leading-6 text-[#787774]">{body}</p>
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
          className="h-16 w-full rounded-lg bg-[#F0EFEC]"
        />
      ))}
    </div>
  );
}
