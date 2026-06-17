import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted px-6 py-16 text-center shadow-[0_24px_70px_-36px_rgba(0,0,0,0.26)] sm:px-12 sm:py-24">
          {/* One warm light — the brand's honey, off in the corner */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -right-24 top-1/2 size-105 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
              style={{ background: "oklch(0.85 0.12 92 / 0.45)" }}
            />
            <div
              className="absolute -top-20 -left-20 size-80 rounded-full opacity-40 blur-3xl"
              style={{ background: "oklch(0.88 0.08 146 / 0.4)" }}
            />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-1.5 text-[13px] shadow-sm">
              <span
                className="h-2 w-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              Ready in a minute
            </span>
            <h2 className="mx-auto mt-5 max-w-2xl text-balance font-semibold text-[2.2rem] text-foreground leading-[1.08] tracking-[-0.03em] sm:text-[3rem]">
              A quieter inbox is{" "}
              <em className="font-serif font-normal text-honey-ink italic">
                a few keystrokes away.
              </em>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[1rem] text-muted-foreground leading-relaxed">
              Connect Gmail and Google Calendar in a minute. Triage, drafts, and
              scheduling are ready the moment you land.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="sheen-host inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-[0.95rem] font-semibold text-background transition-[opacity,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_14px_34px_-20px_rgba(0,0,0,0.45)] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
              >
                Get started free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center rounded-full border border-border bg-background px-5 text-[0.95rem] font-medium text-foreground transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
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
