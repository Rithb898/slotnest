import {
  ArrowRight,
  CalendarClock,
  Command,
  Inbox,
  Keyboard,
  Reply,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { CommandBarDemo } from "@/components/landing/command-bar-demo";
import { Chip } from "@/components/landing/shared";
import { TriageDonut } from "@/components/landing/triage-donut";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft honey light pooled at the top */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 top-0 h-[460px]"
          style={{
            background:
              "radial-gradient(58% 62% at 50% -4%, oklch(0.97 0.035 80 / 0.85), transparent 72%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:pb-24">
        {/* Rounded panel backdrop behind the headline block */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-x-[-1rem] -top-10 bottom-[-2rem] -z-10 rounded-[2.5rem] border border-border/60 bg-secondary/40 sm:inset-x-0"
          />

          {/* Glossy 3D orbs, flanking — the image-1 hero objects */}
          <div
            aria-hidden
            className="float-soft absolute -left-2 top-6 hidden size-20 sm:block lg:-left-6 lg:size-24"
          >
            <span className="orb size-full" />
          </div>
          <div
            aria-hidden
            className="float-soft absolute -right-1 top-16 hidden size-16 sm:block lg:-right-4 lg:size-20"
            style={{ animationDelay: "1.5s" }}
          >
            <span className="orb size-full" />
          </div>

          <div className="mx-auto max-w-3xl px-2 pt-6 text-center sm:pt-8">
            <p
              className="hero-rise inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[0.78rem] font-medium text-muted-foreground backdrop-blur"
              style={{ animationDelay: "0ms" }}
            >
              <span className="grid size-4 place-items-center rounded-full bg-primary/20 text-honey-ink">
                <Sparkles className="size-2.5" />
              </span>
              For Gmail &amp; Google Calendar
            </p>

            <h1
              className="hero-rise mt-6 text-balance leading-[1.02] tracking-[-0.03em]"
              style={{ animationDelay: "80ms" }}
            >
              <span className="block font-serif text-[2.5rem] font-normal italic text-honey-ink sm:text-[3.4rem] lg:text-[4rem]">
                A quieter inbox,
              </span>
              <span className="mt-1 block text-[2.5rem] font-semibold sm:text-[3.4rem] lg:text-[4rem]">
                for Gmail &amp; Calendar.
              </span>
            </h1>

            <p
              className="hero-rise mx-auto mt-5 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-muted-foreground"
              style={{ animationDelay: "160ms" }}
            >
              SlotNest is a keyboard-first command center that triages, replies,
              and schedules in seconds — without leaving the keyboard.
            </p>

            <div
              className="hero-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                href="/sign-up"
                className="sheen-host inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-[oklch(0.74_0.13_75)] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Get started free
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-[0.95rem] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                See how it works
              </a>
            </div>

            <p
              className="hero-rise mt-4 inline-flex items-center gap-1.5 text-[0.8rem] text-muted-foreground"
              style={{ animationDelay: "300ms" }}
            >
              <Keyboard className="size-3.5" />
              Press
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.72rem]">
                ⌘K
              </kbd>
              to do anything
            </p>
          </div>
        </div>

        {/* Product dashboard — the image-1 centerpiece */}
        <div
          className="hero-rise mx-auto mt-14 max-w-4xl"
          style={{ animationDelay: "380ms" }}
        >
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

function HeroDashboard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_40px_90px_-44px_rgba(0,0,0,0.45)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <div className="ml-3 flex items-center gap-2 rounded-md bg-card px-2.5 py-1 text-[0.72rem] text-muted-foreground">
          <Command className="size-3" /> Command center
        </div>
        <div className="ml-auto hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[0.7rem] text-muted-foreground sm:flex">
          <Command className="size-3" /> K
        </div>
      </div>

      <div className="grid sm:grid-cols-[56px_1fr]">
        {/* icon rail */}
        <nav className="hidden flex-col items-center gap-2 border-r border-border bg-secondary/30 py-4 sm:flex">
          {[
            { i: Inbox, k: "inbox", on: true },
            { i: Reply, k: "reply", on: false },
            { i: CalendarClock, k: "schedule", on: false },
            { i: Sparkles, k: "drafts", on: false },
          ].map((r) => (
            <span
              key={r.k}
              className={`grid size-9 place-items-center rounded-xl ${
                r.on ? "bg-primary/15 text-honey-ink" : "text-muted-foreground"
              }`}
            >
              <r.i className="size-4" />
            </span>
          ))}
        </nav>

        {/* main — inner panels settle in just after the frame arrives */}
        <div className="space-y-3 p-3 sm:p-4">
          <div className="hero-rise" style={{ animationDelay: "480ms" }}>
            <CommandBarDemo embedded />
          </div>

          <div
            className="hero-rise grid gap-3 lg:grid-cols-[200px_1fr]"
            style={{ animationDelay: "580ms" }}
          >
            <TriageDonut />
            <NeedsReplyMini />
          </div>

          <div className="hero-rise" style={{ animationDelay: "680ms" }}>
            <TodayStrip />
          </div>
        </div>
      </div>
    </div>
  );
}

function NeedsReplyMini() {
  const rows = [
    { s: "Priya Nair", t: "Re: Q3 planning deck", urgent: true },
    { s: "Marco Bianchi", t: "Coffee before the offsite?", urgent: false },
    { s: "Dana Cole", t: "Contract — quick question", urgent: false },
  ];
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[0.8rem] font-medium text-muted-foreground">
          Needs reply
        </span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.7rem] font-medium text-honey-ink">
          3
        </span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {rows.map((r) => (
          <li key={r.s} className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[0.66rem] font-semibold text-muted-foreground">
              {r.s
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[0.82rem] font-medium">
                  {r.s}
                </span>
                {r.urgent && <Chip variant="urgent">Urgent</Chip>}
              </div>
              <p className="truncate text-[0.76rem] text-muted-foreground">
                {r.t}
              </p>
            </div>
            <kbd className="hidden shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[0.66rem] text-muted-foreground sm:inline">
              R
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayStrip() {
  const events = [
    { t: "10:00", title: "Team standup", dur: "15m" },
    { t: "14:00", title: "Q3 review with Priya", dur: "30m" },
    { t: "16:30", title: "1:1 with Marco", dur: "30m" },
  ];
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="flex items-center gap-2 text-[0.8rem] font-medium text-muted-foreground">
        <CalendarClock className="size-3.5 text-honey-ink" />
        Today
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {events.map((e) => (
          <div
            key={e.title}
            className="flex items-center gap-2.5 rounded-xl bg-secondary/50 px-3 py-2"
          >
            <span className="font-mono text-[0.8rem] font-medium text-honey-ink">
              {e.t}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[0.8rem] font-medium">
                {e.title}
              </div>
              <div className="text-[0.7rem] text-muted-foreground">{e.dur}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
