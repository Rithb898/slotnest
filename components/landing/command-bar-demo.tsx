"use client";

import {
  ArrowRight,
  CalendarClock,
  CornerDownLeft,
  Reply,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Demo = {
  typed: string;
  icon: typeof Reply;
  result: string;
  hint: string;
};

const DEMOS: Demo[] = [
  {
    typed: "reply to Priya about the Q3 deck",
    icon: Reply,
    result: "Draft a reply to Priya Nair",
    hint: "↵",
  },
  {
    typed: "find 30 min with Marco this week",
    icon: CalendarClock,
    result: "3 free slots — Wed 2:00, Thu 11:30, Fri 9:00",
    hint: "↵",
  },
  {
    typed: "archive everything marked FYI",
    icon: Sparkles,
    result: "Archive 12 FYI emails",
    hint: "↵",
  },
];

const TYPE_MS = 45;
const HOLD_MS = 1600;
const CLEAR_MS = 22;

export function CommandBarDemo({ embedded = false }: { embedded?: boolean }) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [showResult, setShowResult] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion: show the first command fully, no cycling.
    if (reduced) {
      setText(DEMOS[0].typed);
      setShowResult(true);
      return;
    }

    let cancelled = false;
    const queue = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.current.push(t);
    };

    const demo = DEMOS[index];
    let i = 0;

    const typeNext = () => {
      if (cancelled) return;
      if (i <= demo.typed.length) {
        setText(demo.typed.slice(0, i));
        i += 1;
        queue(typeNext, TYPE_MS);
      } else {
        setShowResult(true);
        queue(clearOut, HOLD_MS);
      }
    };

    const clearOut = () => {
      setShowResult(false);
      let j = demo.typed.length;
      const back = () => {
        if (cancelled) return;
        if (j >= 0) {
          setText(demo.typed.slice(0, j));
          j -= 1;
          queue(back, CLEAR_MS);
        } else {
          setIndex((p) => (p + 1) % DEMOS.length);
        }
      };
      back();
    };

    queue(typeNext, 400);

    return () => {
      cancelled = true;
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
  }, [index]);

  const demo = DEMOS[index];
  const Icon = demo.icon;

  return (
    <div
      className={
        embedded
          ? "overflow-hidden rounded-xl border border-border bg-secondary/40"
          : "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      }
    >
      {/* Prompt input */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 text-[0.95rem] text-foreground">
          {text || (
            <span className="text-muted-foreground">
              Search or type a command…
            </span>
          )}
          <span className="caret ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.15em] bg-primary align-middle" />
        </div>
        <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground sm:inline">
          esc
        </kbd>
      </div>

      {/* Results */}
      <div className="p-2">
        <div
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300 ${
            showResult ? "bg-[oklch(0.97_0.02_75)]" : ""
          }`}
        >
          <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-honey-ink">
            <Icon className="size-4" />
            {showResult && (
              <span
                className="absolute inset-y-1 -left-2 w-0.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[0.92rem] font-medium text-foreground">
            {showResult ? demo.result : "…"}
          </span>
          <kbd className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
            {demo.hint === "↵" ? (
              <CornerDownLeft className="size-3" />
            ) : (
              demo.hint
            )}
          </kbd>
        </div>

        {/* Static secondary suggestions, for body */}
        <ul
          className={`mt-1 space-y-0.5 ${embedded ? "hidden" : ""}`}
          aria-hidden
        >
          {[
            { i: ArrowRight, t: "Go to inbox" },
            { i: CalendarClock, t: "Open today's schedule" },
          ].map((row) => (
            <li
              key={row.t}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-[0.92rem] text-muted-foreground"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg">
                <row.i className="size-4" />
              </span>
              <span className="flex-1 truncate">{row.t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
