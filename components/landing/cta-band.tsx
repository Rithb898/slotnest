import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

export function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-20"
          style={{ background: "oklch(0.21 0.018 70)" }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="blob blob--a absolute -right-10 -top-16 size-80 opacity-60"
              style={{ background: "oklch(0.7 0.14 72 / 0.55)" }}
            />
            <div
              className="blob blob--b absolute -bottom-20 left-0 size-72 opacity-40"
              style={{ background: "oklch(0.62 0.12 60 / 0.45)" }}
            />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-[oklch(0.97_0.01_78)] sm:text-[3rem]">
              Ready for a{" "}
              <em className="font-serif font-normal italic text-[oklch(0.82_0.12_80)]">
                quieter
              </em>{" "}
              inbox?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-[oklch(0.86_0.012_78)]">
              Connect Gmail and Google Calendar, and clear your morning before
              your coffee gets cold.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="sheen-host inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-[oklch(0.78_0.13_78)] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.12_80)]"
              >
                Get started free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center rounded-xl border border-[oklch(1_0_0/0.18)] px-5 text-[0.95rem] font-medium text-[oklch(0.92_0.01_78)] transition-colors hover:bg-[oklch(1_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.82_0.12_80)]"
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
