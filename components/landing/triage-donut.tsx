"use client";

import { useEffect, useRef, useState } from "react";

const SEGMENTS = [
  {
    label: "Needs reply",
    n: 12,
    color: "oklch(0.7 0.13 75)",
    dot: "bg-primary",
  },
  { label: "FYI", n: 7, color: "oklch(0.6 0.08 240)", dot: "bg-info" },
  {
    label: "Ignore",
    n: 5,
    color: "oklch(0.85 0.01 75)",
    dot: "bg-muted-foreground/40",
  },
];
const TOTAL = SEGMENTS.reduce((a, s) => a + s.n, 0);
const DURATION = 950;

/** Triage donut that draws its ring and counts up to the total when scrolled into view. */
export function TriageDonut() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0); // 0 → 1
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      setCount(TOTAL);
      return;
    }

    let raf = 0;
    let started = false;
    const run = (t0: number) => {
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION);
        const eased = 1 - (1 - p) ** 3; // ease-out-cubic
        setProgress(eased);
        setCount(Math.round(eased * TOTAL));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started) {
          started = true;
          run(performance.now());
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Full-ring conic gradient; a conic mask reveals it up to the current sweep.
  let acc = 0;
  const stops = SEGMENTS.map((s) => {
    const start = (acc / TOTAL) * 100;
    acc += s.n;
    return `${s.color} ${start}% ${(acc / TOTAL) * 100}%`;
  });
  const ring = `conic-gradient(from 0deg, ${stops.join(", ")})`;
  const sweep = `conic-gradient(#000 ${progress * 360}deg, transparent 0)`;

  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="text-[0.8rem] font-medium text-muted-foreground">
        Inbox today
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div ref={ref} className="relative size-20 shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: ring,
              WebkitMask: sweep,
              mask: sweep,
            }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid size-12 place-items-center rounded-full bg-card">
              <span className="text-[1.1rem] font-semibold leading-none tabular-nums">
                {count}
              </span>
            </div>
          </div>
        </div>
        <ul className="space-y-1.5 text-[0.78rem]">
          {SEGMENTS.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${s.dot}`} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto font-medium tabular-nums">{s.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
