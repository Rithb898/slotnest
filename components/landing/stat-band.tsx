import { Reveal } from "@/components/landing/reveal";

const FLOWS = [
  { label: "Reply rate", value: "61%", width: "61%", tone: "#4c9b6b" },
  { label: "Time saved", value: "88%", width: "88%", tone: "#d99a3c" },
];

export function StatBand() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      <Reveal>
        <div className="relative h-[340px] overflow-hidden rounded-[2rem] sm:h-[420px]">
          {/* Photo layer — swap this gradient for bg-[url('/office.jpg')] bg-cover */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, oklch(0.26 0.02 250) 0%, oklch(0.20 0.02 255) 45%, oklch(0.16 0.015 260) 100%)",
            }}
          />
          {/* Darkening scrim for legible text */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          {/* Giant watermark */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 font-sans text-[12rem] font-black leading-none tracking-tighter text-white/10 sm:text-[16rem]"
          >
            4X
          </span>

          <div className="relative flex h-full flex-col justify-between p-6 sm:flex-row sm:items-stretch sm:p-10">
            {/* Left: stat cards */}
            <div className="flex max-w-[220px] flex-col gap-3">
              {FLOWS.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-white/70">
                      {f.label}
                    </span>
                    <span className="text-lg font-bold text-white">
                      {f.value}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full"
                      style={{ width: f.width, background: f.tone }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Right: headline */}
            <div className="mt-auto text-right sm:mt-0 sm:flex sm:flex-col sm:justify-center">
              <h2 className="font-serif text-[2.5rem] font-light italic leading-[1.05] text-white sm:text-[3.5rem]">
                Boost
                <br />
                reply
                <br />
                rates
              </h2>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
