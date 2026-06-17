"use client";

import { Menu, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SlotNestLogo } from "@/components/slotnest-logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 w-full">
      <motion.nav
        aria-label="Primary"
        initial={false}
        animate={{
          marginTop: scrolled ? 12 : 0,
          maxWidth: scrolled ? 880 : 1120,
          paddingLeft: scrolled ? 16 : 40,
          paddingRight: scrolled ? 16 : 40,
          borderRadius: scrolled ? 999 : 0,
          height: scrolled ? 60 : 80,
          backgroundColor: scrolled
            ? "rgba(255,255,255,0.8)"
            : "rgba(255,255,255,0)",
          borderColor: scrolled ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0)",
          boxShadow: scrolled
            ? "0 10px 30px -12px rgba(0,0,0,0.18)"
            : "0 0 0 0 rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.45, ease: EASE }}
        className="mx-auto flex items-center justify-between gap-6 border backdrop-blur-md"
      >
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <SlotNestLogo
            className="text-[#2c2c2c]"
            markClassName="size-6"
            wordmarkClassName="text-[1.05rem]"
          />
        </Link>

        {/* Center: links — separate pills at top, merged into one bar on scroll.
            Spacing (gap/padding) uses CSS transitions, not motion's animate,
            because the `gap`/`padding` shorthands don't interpolate reliably
            and get stuck collapsed after a scroll down→up cycle. */}
        <div
          className={cn(
            "hidden items-center rounded-full transition-[gap,padding,background-color] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
            scrolled ? "gap-0 p-1 bg-black/4" : "gap-2 p-0 bg-transparent",
          )}
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-[color,background-color,border-color] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                scrolled
                  ? "border-transparent bg-transparent"
                  : "border-black/10 bg-white/60",
              )}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="hidden items-center gap-4 md:flex md:ml-2">
          <Link
            href="/sign-in"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center rounded-full bg-[#1c1c1c] px-5 text-xs font-bold text-white transition-all hover:bg-[#2d2d2d] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full border border-border/80 bg-white/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
        </button>
      </motion.nav>

      {/* Mobile nav dropdown */}
      {open && (
        <div className="border-t border-border/70 bg-white/95 backdrop-blur-md md:hidden animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-6 py-5">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-full border border-border/40 bg-white/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link
                href="/sign-in"
                className="rounded-full border border-border px-4 py-2 text-center text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-[#1c1c1c] px-4 py-2 text-center text-xs font-bold text-white hover:bg-[#2d2d2d]"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
