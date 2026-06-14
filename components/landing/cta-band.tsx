import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-[#1c1c1c] px-6 py-16 text-center sm:px-12 sm:py-24">
          {/* One warm light — the brand's honey, off in the corner */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -right-24 top-1/2 size-105 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
              style={{ background: "oklch(0.70 0.13 75 / 0.40)" }}
            />
            <div
              className="absolute -left-20 -top-20 size-80 rounded-full opacity-40 blur-3xl"
              style={{ background: "oklch(0.70 0.13 75 / 0.18)" }}
            />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[3rem]">
              A quieter inbox is{" "}
              <em className="font-serif font-normal italic text-[#e6a64d]">
                a few keystrokes away.
              </em>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-white/65">
              Connect Gmail and Google Calendar in a minute. Triage, drafts, and
              scheduling are ready the moment you land.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="sheen-host inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] font-semibold text-[#1c1c1c] transition-[background-color,transform] duration-150 hover:bg-[#e6a64d] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Get started free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center rounded-full border border-white/25 px-5 text-[0.95rem] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
