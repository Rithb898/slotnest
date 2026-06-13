import { Reveal } from "@/components/landing/reveal";

const FLOWS = [
  { label: "Reply rate", value: "61%", width: "61%", tone: "#4c9b6b" },
  { label: "Time saved", value: "88%", width: "88%", tone: "#d99a3c" },
];

export function StatBand() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-[#1c1c1c] sm:h-[420px]">
          {/* One warm light, low in the corner — the brand's honey, never a new hue */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-24 size-[460px] rounded-full opacity-60 blur-3xl"
            style={{ background: "oklch(0.70 0.13 75 / 0.45)" }}
          />

          {/* Giant accent figure */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 select-none font-sans text-[12rem] font-black leading-none tracking-tighter text-white/[0.06] sm:text-[16rem]"
          >
            4×
          </span>

          <div className="relative flex h-full flex-col justify-between gap-8 p-6 sm:flex-row sm:items-stretch sm:p-10">
            {/* Left: stat cards */}
            <div className="flex max-w-[240px] flex-col gap-3">
              {FLOWS.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.82rem] font-medium text-white/75">
                      {f.label}
                    </span>
                    <span className="text-lg font-bold text-white">
                      {f.value}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
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
              <h2 className="font-serif text-[2.5rem] font-light italic leading-[1.05] text-white sm:text-[3.5rem]">
                Replies sent
                <br />
                <span className="font-sans font-bold not-italic text-[#e6a64d]">
                  four times faster.
                </span>
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-white/60 sm:max-w-xs sm:self-end">
                Draft-ready answers cut the time from open to send.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
