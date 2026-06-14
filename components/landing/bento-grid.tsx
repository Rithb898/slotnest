import { Calendar, Inbox, Send, Sparkles, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/reveal";

export function BentoGrid() {
  return (
    <section className="rounded-[2.5rem] bg-[#f4f4f2] px-5 py-16 sm:px-10 sm:py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance leading-[1.05] tracking-tight">
            <span className="block font-serif text-[2rem] font-light italic text-foreground sm:text-[2.75rem]">
              Know how your inbox
            </span>
            <span className="block font-sans text-[2.1rem] font-bold tracking-tight text-foreground sm:text-[2.9rem]">
              is actually doing
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            See every signal that matters — triage accuracy, reply speed, and
            calendar health — in one calm, glanceable command center.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-3 md:grid-cols-6">
          {/* Triage overview */}
          <Card className="md:col-span-2">
            <CardHead title="Triage overview" />
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[2.6rem] font-bold leading-none text-[#2c2c2c]">
                87%
              </span>
              <Tag tone="good">Healthy</Tag>
            </div>
            <p className="mt-1 text-[0.7rem] font-medium text-muted-foreground">
              Inbox triaged automatically
            </p>
            <div className="mt-4 border-t border-border/60 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.72rem] font-medium text-muted-foreground">
                  Backlog rate
                </span>
                <span className="text-lg font-bold text-[#2c2c2c]">52%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-[#d99a3c]" style={{ width: "52%" }} />
              </div>
            </div>
          </Card>

          {/* Sender analysis */}
          <Card className="md:col-span-4">
            <CardHead title="Sender analysis" />
            <div className="mt-4 flex items-end gap-3">
              {[40, 70, 55, 90, 48, 62, 80].map((h, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static chart
                  key={i}
                  className="flex-1 rounded-md"
                  style={{
                    height: `${h}px`,
                    background:
                      i === 3 ? "#4c9b6b" : "var(--color-secondary, #e7e5df)",
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {["PN", "MB", "FG", "ST", "+9"].map((a) => (
                <span
                  key={a}
                  className="grid size-7 place-items-center rounded-full border border-white bg-secondary text-[0.62rem] font-bold text-muted-foreground shadow-sm"
                >
                  {a}
                </span>
              ))}
              <span className="ml-1 text-[0.72rem] font-medium text-muted-foreground">
                Top conversations this week
              </span>
            </div>
          </Card>

          {/* Advanced analytics — radar */}
          <Card className="md:col-span-2">
            <CardHead title="Advanced analytics" />
            <div className="mt-3 flex items-center justify-center">
              <Radar />
            </div>
          </Card>

          {/* Big gauge */}
          <Card className="flex flex-col items-center justify-center md:col-span-2">
            <Gauge value={826} max={1000} />
            <p className="mt-2 text-[0.72rem] font-medium text-muted-foreground">
              Inbox health score
            </p>
          </Card>

          {/* Flow insights — green */}
          <Card
            className="relative overflow-hidden md:col-span-2"
            style={{
              background:
                "linear-gradient(140deg, oklch(0.62 0.15 150), oklch(0.5 0.13 150))",
            }}
          >
            <div className="absolute -right-8 -bottom-10 size-40 rounded-full border-18 border-white/10" />
            <div className="relative">
              <span className="text-[0.74rem] font-semibold text-white/85">
                Flow insights
              </span>
              <h3 className="mt-2 text-lg font-bold leading-tight text-white">
                Replies sent 2.4× faster
              </h3>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-white/85">
                Draft-ready answers cut the time from open to send.
              </p>
              <Sparkles className="mt-4 size-5 text-white/90" />
            </div>
          </Card>

          {/* Insights history — table */}
          <Card className="md:col-span-4">
            <CardHead title="Insights history" />
            <div className="mt-3 space-y-1.5">
              {[
                { d: "Mon", l: "Triage accuracy", v: "94%", t: "good" as const },
                { d: "Tue", l: "Reply latency", v: "1.2h", t: "good" as const },
                { d: "Wed", l: "Backlog cleared", v: "61%", t: "attn" as const },
                { d: "Thu", l: "Meetings booked", v: "12", t: "good" as const },
              ].map((r) => (
                <div
                  key={r.d}
                  className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-[0.74rem]"
                >
                  <span className="w-8 font-mono font-bold text-muted-foreground">
                    {r.d}
                  </span>
                  <span className="flex-1 text-foreground/90">{r.l}</span>
                  <span className="font-bold text-[#2c2c2c]">{r.v}</span>
                  <Tag tone={r.t}>{r.t === "good" ? "GOOD" : "ATTN"}</Tag>
                </div>
              ))}
            </div>
          </Card>

          {/* AI reports — nodes */}
          <Card className="md:col-span-2">
            <CardHead title="AI reports" />
            <div className="mt-5 flex items-center justify-around">
              {[
                { icon: Inbox, label: "Triage" },
                { icon: Send, label: "Draft" },
                { icon: Calendar, label: "Schedule" },
              ].map((n) => (
                <div key={n.label} className="flex flex-col items-center gap-2">
                  <span className="grid size-11 place-items-center rounded-full bg-[#4c9b6b]/12 text-[#4c9b6b]">
                    <n.icon className="size-5" />
                  </span>
                  <span className="text-[0.66rem] font-semibold text-muted-foreground">
                    {n.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Reveal>
    </section>
  );
}

function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`rounded-2xl border border-border/70 bg-white p-5 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}

function CardHead({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.8rem] font-semibold text-[#2c2c2c]">{title}</span>
      <TrendingUp className="size-3.5 text-muted-foreground" />
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "good" | "attn";
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.56rem] font-bold ${
        tone === "good"
          ? "bg-[#4c9b6b]/15 text-[#4c9b6b]"
          : "bg-[#d99a3c]/15 text-[#d99a3c]"
      }`}
    >
      {children}
    </span>
  );
}

function Radar() {
  const cx = 70;
  const cy = 62;
  const r = 48;
  const n = 6;
  const vals = [0.8, 0.6, 0.75, 0.5, 0.85, 0.65];
  const pts = (scale: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n - Math.PI / 2;
      return `${cx + r * scale * Math.cos(a)},${cy + r * scale * Math.sin(a)}`;
    }).join(" ");
  const data = vals
    .map((v, i) => {
      const a = (i * 2 * Math.PI) / n - Math.PI / 2;
      return `${cx + r * v * Math.cos(a)},${cy + r * v * Math.sin(a)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 140 124" className="h-32 w-full">
      <title>Analytics radar</title>
      {[0.33, 0.66, 1].map((s) => (
        <polygon
          key={s}
          points={pts(s)}
          className="fill-none stroke-border"
          strokeWidth="0.75"
        />
      ))}
      <polygon
        points={data}
        className="fill-[#4c9b6b]/20 stroke-[#4c9b6b]"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Gauge({ value, max }: { value: number; max: number }) {
  const pct = value / max;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="relative grid size-32 place-items-center">
      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 110 110">
        <title>Inbox health gauge</title>
        <circle
          cx="55"
          cy="55"
          r={radius}
          className="fill-none stroke-secondary"
          strokeWidth="9"
        />
        <circle
          cx="55"
          cy="55"
          r={radius}
          className="fill-none stroke-[#4c9b6b]"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - pct * circ}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold text-[#2c2c2c]">{value}</div>
        <div className="text-[0.6rem] font-semibold text-muted-foreground">
          / {max}
        </div>
      </div>
    </div>
  );
}
