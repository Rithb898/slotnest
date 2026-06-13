"use client";

import {
  ArrowRight,
  BarChart2,
  Calendar,
  ChevronRight,
  HelpCircle,
  Inbox,
  Mail,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white px-4 pt-10 pb-20 sm:px-8 sm:pt-16 lg:pb-28">
      {/* Background soft grids */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 select-none opacity-40"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #e3e3e3 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Hero typography block */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance leading-none tracking-tight">
            <span className="block text-[2.5rem] font-semibold text-foreground sm:text-[3.75rem] lg:text-[4.5rem] leading-[1.15] tracking-tight">
              Inbox to zero,
            </span>
            <span className="mt-2 block text-[2.75rem] font-extrabold text-foreground sm:text-[4rem] lg:text-[4.75rem] leading-[1.05] tracking-tighter">
              before your coffee.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-sm sm:text-base leading-relaxed text-muted-foreground">
            SlotNest sorts your mail by what to do and when, drafts replies in
            your voice, and books real free time — all from one ⌘K command bar.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-7 font-semibold text-sm text-foreground transition-all hover:bg-primary/90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Get started free
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="#how"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-background px-6 font-semibold text-sm text-foreground transition-all hover:bg-secondary active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              See how it works
            </Link>
          </div>
        </div>

        {/* Mockup dashboard browser window — fades up out of the section */}
        <div
          className="mx-auto mt-16 max-w-5xl"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 12%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 12%, black 100%)",
          }}
        >
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

function HeroDashboard() {
  const [activeTab, setActiveTab] = useState("Standard");

  // Radar chart metrics
  const radarMetrics = [
    { name: "Triage Accuracy", value: 78, status: "GOOD", pct: "78%" },
    { name: "Response Speed", value: 57, status: "ATTN", pct: "57%" },
    { name: "Inbox Health", value: 46, status: "ATTN", pct: "46%" },
    { name: "Focus Time", value: 72, status: "GOOD", pct: "72%" },
    { name: "Action Rate", value: 42, status: "ATTN", pct: "42%" },
    { name: "Calendar Balance", value: 77, status: "GOOD", pct: "77%" },
    { name: "Quiet Time", value: 81, status: "GOOD", pct: "81%" },
  ];

  // SVG Radar setup
  const cx = 100;
  const cy = 90;
  const r = 60;
  const numSides = 7;

  const getPoints = (scale: number) => {
    const points = [];
    for (let i = 0; i < numSides; i++) {
      const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
      const x = cx + r * scale * Math.cos(angle);
      const y = cy + r * scale * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(" ");
  };

  const dataPoints = radarMetrics
    .map((m, i) => {
      const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
      const radius = r * (m.value / 100);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  const axisLines = Array.from({ length: numSides }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x2: x, y2: y };
  });

  const vertexPoints = Array.from({ length: numSides }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
    const labelR = r + 10;
    const x = cx + labelR * Math.cos(angle);
    const y = cy + labelR * Math.sin(angle) + 3;
    return { x, y, label: (i + 1).toString() };
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#f8f6f2] shadow-[0_25px_60px_-25px_rgba(0,0,0,0.15)] flex flex-col w-full text-[#2c2c2c]">
      {/* Browser bar */}
      <div className="flex items-center gap-2 border-b border-border bg-white/80 backdrop-blur px-5 py-3.5 select-none">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#c54f3d]" />
          <span className="size-2.5 rounded-full bg-[#d99a3c]" />
          <span className="size-2.5 rounded-full bg-[#4c9b6b]" />
        </div>
        <div className="flex gap-1 ml-4 mr-2 text-muted-foreground/60">
          <ChevronRight className="size-4 rotate-180" />
          <ChevronRight className="size-4" />
        </div>
        <div className="flex-1 max-w-md mx-auto rounded-lg bg-[#f0ede6]/70 px-4 py-1 text-center text-[0.72rem] text-muted-foreground font-medium flex items-center justify-center gap-1.5 border border-border/40">
          <span className="size-1.5 rounded-full bg-[#4c9b6b]" />
          slotnest.ai
        </div>
        <div className="flex items-center gap-3 ml-auto text-muted-foreground/80">
          <HelpCircle className="size-3.5" />
          <div className="rounded border border-border bg-white px-2 py-0.5 text-[0.62rem] font-mono font-semibold">
            ⌘K
          </div>
        </div>
      </div>

      {/* Browser client grid */}
      <div className="grid md:grid-cols-[250px_1fr_240px] gap-4 p-4">
        {/* Column 1: Overview & Metrics */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border p-4 bg-white shadow-sm flex flex-col">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Overview</span>
              <Settings className="size-3.5 text-muted-foreground" />
            </div>

            {/* SVG Radar spider chart */}
            <div className="h-44 w-full flex items-center justify-center mt-2 select-none">
              <svg viewBox="0 0 200 200" className="size-full">
                <title>Overview metrics radar chart</title>
                {/* Concentric grid heptagons */}
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale) => (
                  <polygon
                    key={scale}
                    points={getPoints(scale)}
                    className="stroke-border/70 fill-none"
                    strokeWidth="0.75"
                  />
                ))}

                {/* Grid axis lines */}
                {axisLines.map((line) => (
                  <line
                    key={`axis-line-${line.x2}-${line.y2}`}
                    x1={cx}
                    y1={cy}
                    x2={line.x2}
                    y2={line.y2}
                    className="stroke-border/50"
                    strokeWidth="0.75"
                  />
                ))}

                {/* Vertex index tags */}
                {vertexPoints.map((pt) => (
                  <text
                    key={`vertex-${pt.label}`}
                    x={pt.x}
                    y={pt.y}
                    className="text-[9px] fill-muted-foreground font-bold text-center"
                    textAnchor="middle"
                  >
                    {pt.label}
                  </text>
                ))}

                {/* Active data polygon */}
                <polygon
                  points={dataPoints}
                  className="stroke-[#4c9b6b] fill-[#4c9b6b]/15"
                  strokeWidth="1.5"
                />

                {/* Center dot */}
                <circle cx={cx} cy={cy} r="2" className="fill-[#4c9b6b]" />
              </svg>
            </div>

            {/* Metrics list */}
            <div className="mt-3 space-y-1.5">
              {radarMetrics.slice(0, 5).map((m, idx) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between text-[0.7rem] font-medium border-b border-border/40 pb-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-muted-foreground text-[0.65rem] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">{m.pct}</span>
                    <span
                      className={cn(
                        "text-[0.58rem] font-bold px-1 py-0.2 rounded",
                        m.status === "GOOD"
                          ? "bg-[#4c9b6b]/15 text-[#4c9b6b]"
                          : "bg-[#d99a3c]/15 text-[#d99a3c]",
                      )}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connected accounts card */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col justify-between h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] font-semibold text-muted-foreground">
                Connected accounts
              </span>
              <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#4c9b6b]">
                <span className="size-1.5 rounded-full bg-[#4c9b6b]" />
                Synced
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[0.72rem] font-medium text-foreground">
                <Mail className="size-3.5 text-honey-ink" />
                Gmail
                <span className="ml-auto font-mono text-[0.62rem] text-muted-foreground">
                  1,284 mails
                </span>
              </div>
              <div className="flex items-center gap-2 text-[0.72rem] font-medium text-foreground">
                <Calendar className="size-3.5 text-honey-ink" />
                Google Calendar
                <span className="ml-auto font-mono text-[0.62rem] text-muted-foreground">
                  16 events
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Dashboard Content Panel */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-white shadow-sm flex-1 flex flex-col min-h-[380px]">
            {/* Inner navigation bar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex gap-2">
                {["Standard", "Heatmap", "Insights", "Skeleton"].map((tab) => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "text-[0.7rem] font-bold px-3 py-1 rounded-full transition-colors",
                      activeTab === tab
                        ? "bg-[#1c1c1c] text-white"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {tab} view
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground select-none">
                <span className="size-1.5 rounded-full bg-border" />
                <span className="size-1.5 rounded-full bg-border" />
              </div>
            </div>

            {/* Showcase details */}
            <div className="flex-1 p-5 flex flex-col gap-4">
              <div className="rounded-xl border border-border/80 bg-[#f8f6f2] p-4 flex flex-col gap-3 flex-1 justify-center relative overflow-hidden">
                <div className="absolute top-[-40px] right-[-40px] size-40 rounded-full border-4 border-white/5 opacity-40" />
                <div>
                  <span className="text-[0.68rem] font-semibold text-muted-foreground">
                    AI assistant draft
                  </span>
                  <h2 className="text-base font-bold text-[#2c2c2c] mt-0.5">
                    Automate, Reply, Outperform
                  </h2>
                </div>

                <div className="rounded-lg border border-border bg-white p-3 shadow-sm flex flex-col gap-2 relative">
                  <div className="flex items-center gap-1 text-[0.68rem] text-muted-foreground border-b border-border/40 pb-1.5">
                    <span className="font-semibold text-foreground">
                      Reply request:
                    </span>
                    <span>Decline invite but offer Wednesday 2 PM</span>
                  </div>
                  <div className="text-[0.75rem] font-medium text-foreground leading-relaxed">
                    Hi Priya, <br />
                    Thanks for reaching out! Tuesday doesn&apos;t work for me,
                    but I&apos;m free on{" "}
                    <span className="bg-primary/20 text-honey-ink px-1 rounded font-bold">
                      Wednesday at 2:00 PM
                    </span>
                    . Let me know if that works!
                    <span className="caret inline-block w-1.5 h-3.5 bg-primary ml-0.5 align-middle" />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[0.62rem] text-muted-foreground">
                      Tone: Calm, clear
                    </span>
                    <button
                      type="button"
                      className="bg-primary hover:bg-[#e6a64d] text-[#2c2c2c] font-bold text-[0.65rem] py-1 px-2.5 rounded-md flex items-center gap-1 border border-primary-strong/30 transition-colors"
                    >
                      Insert Draft
                      <span className="font-mono text-[0.58rem] border border-black/10 bg-white/40 px-1 rounded">
                        Tab
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Reports Circular Gauges */}
              <div>
                <h4 className="text-[0.72rem] font-semibold text-muted-foreground mb-3">
                  AI triage health
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-border/60 rounded-xl p-3 flex flex-col items-center bg-white shadow-xs">
                    <ProgressCircle
                      value={85}
                      label="Mail Triage"
                      icon={Inbox}
                    />
                  </div>
                  <div className="border border-border/60 rounded-xl p-3 flex flex-col items-center bg-white shadow-xs">
                    <ProgressCircle
                      value={64}
                      label="Draft Flows"
                      icon={Sparkles}
                    />
                  </div>
                  <div className="border border-border/60 rounded-xl p-3 flex flex-col items-center bg-white shadow-xs">
                    <ProgressCircle
                      value={92}
                      label="Free Slots"
                      icon={Calendar}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Flow Cards & Passing Rate */}
        <div className="flex flex-col gap-4">
          {/* Transfer Flow */}
          <div className="rounded-xl border border-border p-4 bg-white shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[0.7rem] font-semibold text-muted-foreground">
              <span>Response Flow</span>
              <TrendingUp className="size-3.5 text-[#4c9b6b]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-bold text-[#2c2c2c]">87%</span>
              <span className="text-[0.62rem] font-bold px-1.5 py-0.2 bg-[#4c9b6b]/15 text-[#4c9b6b] rounded">
                GOOD
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-[#4c9b6b]" style={{ width: "87%" }} />
            </div>
          </div>

          {/* Request Flow */}
          <div className="rounded-xl border border-border p-4 bg-white shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[0.7rem] font-semibold text-muted-foreground">
              <span>Schedule Flow</span>
              <TrendingUp className="size-3.5 text-[#d99a3c]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-bold text-[#2c2c2c]">52%</span>
              <span className="text-[0.62rem] font-bold px-1.5 py-0.2 bg-[#d99a3c]/15 text-[#d99a3c] rounded">
                ATTN
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-[#d99a3c]" style={{ width: "52%" }} />
            </div>
          </div>

          {/* Sync Code Card */}
          <div className="rounded-xl border border-border p-4 bg-white shadow-sm flex flex-col gap-2">
            <span className="text-[0.7rem] font-semibold text-muted-foreground">
              Calendar Sync
            </span>
            <p className="text-[0.68rem] text-muted-foreground leading-normal">
              OAuth token sync active. Incoming Google Calendar events map live
              to SlotNest triaging.
            </p>
            <div className="h-px bg-border/50 my-1" />
            <span className="text-[0.62rem] font-semibold text-muted-foreground/80 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[#4c9b6b] inline-block animate-pulse" />
              Connected to Corsair Multi-Tenant
            </span>
          </div>

          {/* Passing Rate */}
          <PassingRate />
        </div>
      </div>
    </div>
  );
}

function ProgressCircle({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="relative size-12 flex items-center justify-center">
        <svg className="absolute inset-0 size-full -rotate-90">
          <title>Triage health indicator: {label}</title>
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="stroke-secondary fill-none"
            strokeWidth="3.5"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="stroke-primary fill-none"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <Icon className="size-4.5 text-honey-ink" />
      </div>
      <span className="text-[0.65rem] font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function PassingRate() {
  return (
    <div className="rounded-xl border border-border p-4 bg-white shadow-sm flex flex-col">
      <div className="flex items-center justify-between text-[0.7rem] font-semibold text-muted-foreground">
        <span>Triage Rate</span>
        <BarChart2 className="size-3.5" />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-[#2c2c2c]">61%</span>
        <span className="text-[0.62rem] text-[#4c9b6b] font-bold">Passing</span>
      </div>

      {/* Segmented Progress Bar */}
      <div className="mt-2.5 h-3.5 w-full rounded-full overflow-hidden flex bg-secondary">
        <div className="h-full bg-[#4c9b6b]" style={{ width: "61%" }} />
        <div className="h-full bg-[#c54f3d]" style={{ width: "17%" }} />
        <div
          className="h-full bg-[#e3e3e3]"
          style={{
            width: "22%",
            backgroundImage:
              "repeating-linear-gradient(45deg, #e3e3e3, #e3e3e3 4px, #cccccc 4px, #cccccc 8px)",
          }}
        />
      </div>

      <div className="mt-3.5 space-y-1 text-[0.62rem] font-bold text-muted-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#4c9b6b]" />
            <span>Success</span>
          </div>
          <span className="text-foreground">61%</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#c54f3d]" />
            <span>Failed</span>
          </div>
          <span className="text-foreground">17%</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#cccccc]" />
            <span>Partial</span>
          </div>
          <span className="text-foreground">22%</span>
        </div>
      </div>
    </div>
  );
}
