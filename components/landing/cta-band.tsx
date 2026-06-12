import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-24"
          style={{
            background:
              "linear-gradient(120deg, oklch(0.66 0.17 150) 0%, oklch(0.58 0.16 148) 50%, oklch(0.50 0.14 150) 100%)",
          }}
        >
          {/* Decorative glossy 3D swirl on the right */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -right-16 top-1/2 size-[460px] -translate-y-1/2 rounded-full opacity-90 blur-[2px] sm:-right-4"
              style={{
                background:
                  "conic-gradient(from 140deg, oklch(0.85 0.16 150) 0deg, oklch(0.5 0.14 150) 90deg, oklch(0.92 0.12 150) 180deg, oklch(0.45 0.13 150) 270deg, oklch(0.85 0.16 150) 360deg)",
                maskImage:
                  "radial-gradient(circle, transparent 32%, black 33%, black 60%, transparent 64%)",
                WebkitMaskImage:
                  "radial-gradient(circle, transparent 32%, black 33%, black 60%, transparent 64%)",
              }}
            />
            <div
              className="absolute -right-10 top-1/2 size-72 -translate-y-1/2 rounded-full opacity-70 mix-blend-screen blur-md sm:right-4"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, oklch(0.95 0.1 150 / 0.8), transparent 60%)",
              }}
            />
            {/* sparkle dots */}
            <div className="absolute left-[12%] top-[28%] size-1.5 rounded-full bg-white/70" />
            <div className="absolute left-[8%] top-[55%] size-1 rounded-full bg-white/50" />
            <div className="absolute left-[20%] bottom-[22%] size-1 rounded-full bg-white/60" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[3rem]">
              Ready to enhance your inbox{" "}
              <em className="font-serif font-normal italic text-white/90">
                and reclaim your time?
              </em>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-white/85">
              Connect Gmail and Google Calendar, and clear your morning before
              your coffee gets cold.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="sheen-host inline-flex h-11 items-center gap-2 rounded-full bg-[#1c1c1c] px-6 text-[0.95rem] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#2d2d2d] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get Started Now
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center rounded-full border border-white/30 px-5 text-[0.95rem] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
