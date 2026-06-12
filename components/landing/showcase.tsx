import { CalendarClock, Command, Inbox, Reply, Sparkles } from "lucide-react";
import { Chip, SectionHeading } from "@/components/landing/shared";
import { Reveal } from "@/components/landing/reveal";

export function Showcase() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <SectionHeading>
          Everything in{" "}
          <em className="font-serif font-normal italic text-honey-ink">
            one quiet place.
          </em>
        </SectionHeading>
        <p className="mt-4 text-pretty text-[1.02rem] leading-relaxed text-muted-foreground">
          SlotNest reads your inbox the way you would — sorting what needs a
          reply from what&apos;s just noise — so the first thing you see is the
          thing to do.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-12">
        <InboxMockup />
      </Reveal>
    </section>
  );
}

function InboxMockup() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_70px_-30px_rgba(0,0,0,0.35)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <div className="ml-3 flex items-center gap-2 rounded-md bg-card px-2.5 py-1 text-[0.72rem] text-muted-foreground">
          <Inbox className="size-3" /> Inbox · Priority
        </div>
        <div className="ml-auto hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[0.7rem] text-muted-foreground sm:flex">
          <Command className="size-3" /> K
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
        {/* sidebar */}
        <nav className="hidden flex-col gap-0.5 border-r border-border bg-secondary/30 p-3 sm:flex">
          {[
            { i: Inbox, t: "Inbox", active: true, count: "8" },
            { i: Reply, t: "Needs reply", count: "3" },
            { i: CalendarClock, t: "Schedule", count: undefined },
            { i: Sparkles, t: "Drafts", count: "2" },
          ].map((row) => (
            <div
              key={row.t}
              className={`relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.82rem] font-medium ${
                row.active ? "bg-card text-honey-ink" : "text-muted-foreground"
              }`}
            >
              {row.active && (
                <span className="absolute inset-y-2 left-0.5 w-0.5 rounded-full bg-primary" />
              )}
              <row.i className="size-3.5" />
              <span className="flex-1">{row.t}</span>
              {row.count && (
                <span className="rounded-full bg-muted px-1.5 text-[0.68rem] text-muted-foreground">
                  {row.count}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* rows */}
        <div className="p-2.5">
          {INBOX.map((row, i) => (
            <TriageRow key={row.subject} {...row} active={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}

const INBOX = [
  {
    sender: "Priya Nair",
    subject: "Re: Q3 planning deck — a couple of edits",
    preview: "These look great. Can we move the review to Thursday so…",
    time: "9:24",
    action: "reply" as const,
    urgency: "urgent" as const,
  },
  {
    sender: "Marco Bianchi",
    subject: "Coffee before the offsite?",
    preview: "Free any morning this week? Would love to sync before…",
    time: "8:51",
    action: "reply" as const,
    urgency: "normal" as const,
  },
  {
    sender: "Figma",
    subject: "Weekly digest: 4 files updated",
    preview: "Here's what changed in your team's projects this week…",
    time: "7:30",
    action: "fyi" as const,
    urgency: "normal" as const,
  },
  {
    sender: "Notion",
    subject: "Your invite to the design review",
    preview: "Added — accept or propose a new time straight from here…",
    time: "Yest",
    action: "scheduled" as const,
    urgency: "normal" as const,
  },
];

type RowProps = {
  sender: string;
  subject: string;
  preview: string;
  time: string;
  action: "reply" | "fyi" | "scheduled";
  urgency?: "urgent" | "normal";
  active?: boolean;
};

function TriageRow({
  sender,
  subject,
  preview,
  time,
  action,
  urgency,
  active,
}: RowProps) {
  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        active ? "bg-[oklch(0.98_0.012_78)]" : "hover:bg-secondary/60"
      }`}
    >
      {active && (
        <span className="absolute inset-y-2 left-0.5 w-0.5 rounded-full bg-primary" />
      )}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[0.72rem] font-semibold text-muted-foreground">
        {sender
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[0.86rem] font-semibold text-foreground">
            {sender}
          </span>
          {urgency === "urgent" && <Chip variant="urgent">Urgent</Chip>}
          {action === "reply" && <Chip variant="reply">Needs reply</Chip>}
          {action === "fyi" && <Chip variant="fyi">FYI</Chip>}
          {action === "scheduled" && <Chip variant="scheduled">Invite</Chip>}
        </div>
        <p className="truncate text-[0.82rem] text-muted-foreground">
          <span className="text-foreground/80">{subject}</span> — {preview}
        </p>
      </div>
      <time className="shrink-0 font-mono text-[0.74rem] text-muted-foreground">
        {time}
      </time>
    </div>
  );
}
