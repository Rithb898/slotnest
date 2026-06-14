import { Reveal } from "@/components/landing/reveal";

const FLOWS = [
  { label: "Reply rate", value: "61%", width: "61%", tone: "#4c9b6b" },
  { label: "Time saved", value: "88%", width: "88%", tone: "#d99a3c" },
];

export function StatBand() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted p-6 sm:h-105 sm:p-10">
          {/* One warm light, low in the corner — the brand's honey, never a new hue */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -bottom-32 size-115 rounded-full opacity-50 blur-3xl"
            style={{ background: "oklch(0.85 0.12 92 / 0.5)" }}
          />

          {/* Giant accent figure */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 select-none font-sans text-[12rem] font-black leading-none tracking-tighter text-foreground/5 sm:text-[16rem]"
          >
            4×
          </span>

          <div className="relative flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-stretch">
            {/* Left: stat cards */}
            <div className="flex max-w-60 flex-col gap-3">
              {FLOWS.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-border bg-background p-4 shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.82rem] font-medium text-muted-foreground">
                      {f.label}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {f.value}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: f.width, background: f.tone }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Right: headline */}
            <div className="text-right sm:flex sm:flex-col sm:justify-center">
              <h2 className="font-serif text-[2.5rem] font-light italic leading-[1.05] text-foreground sm:text-[3.5rem]">
                Replies sent
                <br />
                <span className="font-sans font-bold text-honey-ink not-italic">
                  four times faster.
                </span>
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground sm:max-w-xs sm:self-end">
                Draft-ready answers cut the time from open to send.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
