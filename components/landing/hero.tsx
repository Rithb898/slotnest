"use client";

import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { HeroDashboard } from "@/components/landing/hero-dashboard";
import { HeroNavbar } from "@/components/landing/hero-navbar";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * SSR-safe entrance: object `initial`/`animate` (not variant-label strings,
 * which motion can't resolve during SSR → hydration mismatch). Manual delays
 * reproduce the staggered cascade.
 */
const rise = (delay: number) =>
  ({
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: EASE, delay },
  }) as const;

export function Hero() {
  return (
    <div className="w-full bg-muted p-3 sm:p-4">
      <section className="relative flex min-h-[calc(100vh-24px)] w-full flex-col overflow-hidden rounded-2xl bg-secondary sm:min-h-[calc(100vh-32px)] sm:rounded-3xl">
        {/* Calm "Quiet Desk" backdrop: warm gradient + faint grid + a single honey glow */}
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/40 via-background to-secondary" />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <motion.div
            className="absolute -top-24 left-1/2 h-[55%] w-[70%] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{ background: "oklch(0.85 0.12 92 / 0.55)" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.5, scale: 1 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col pb-5 sm:pb-7">
          <motion.div {...rise(0.05)}>
            <HeroNavbar />
          </motion.div>

          <div className="flex flex-col items-center px-4 pt-10 pb-8 text-center sm:pt-16 sm:pb-12">
            <motion.span
              {...rise(0.15)}
              className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-1.5 text-[13px] shadow-sm"
            >
              <span
                className="h-2 w-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              SlotNest
            </motion.span>

            <motion.h1
              {...rise(0.27)}
              className="mt-5 max-w-4xl text-foreground sm:mt-6"
              style={{
                fontSize: "clamp(36px, 8vw, 72px)",
                lineHeight: 1.05,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              Inbox to{" "}
              <span className="font-serif font-normal italic">zero</span>,
              <br />
              before your coffee
            </motion.h1>

            <motion.p
              {...rise(0.39)}
              className="mt-4 max-w-xl px-2 text-muted-foreground sm:mt-6"
              style={{ fontSize: "clamp(13px, 3.5vw, 16px)" }}
            >
              The keyboard-first command center for Gmail and Google Calendar —
              triage, reply, and book real free time in seconds.
            </motion.p>

            <motion.div {...rise(0.51)}>
              <Link
                href="/sign-up"
                className="mt-6 inline-flex items-center gap-3 rounded-full bg-foreground py-2 pr-2 pl-6 text-[14px] font-medium text-background transition-transform hover:-translate-y-0.5 sm:mt-8 sm:py-2.5 sm:pl-7"
              >
                Get started free
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 sm:h-7 sm:w-7">
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </Link>
            </motion.div>
          </div>

          <motion.div {...rise(0.6)}>
            <HeroDashboard />
          </motion.div>
        </div>
      </section>
    </div>
  );
}
