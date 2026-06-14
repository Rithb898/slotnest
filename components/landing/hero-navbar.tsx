"use client";

import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type NavLink = { label: string; href: string; dot?: boolean };

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/", dot: true },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
];

/** SlotNest mark: a soft asterisk/cross with a centered node. */
function SlotNestLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      role="img"
      aria-label="SlotNest logo"
    >
      <path
        d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 19.364L18.364 5.636"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HeroNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex justify-center px-3 pt-4 sm:px-4 sm:pt-6">
      <nav className="relative flex w-full max-w-[760px] items-center rounded-full border border-border bg-background py-2 pr-2 pl-2 shadow-sm">
        <Link href="/" className="shrink-0 pl-1.5" aria-label="SlotNest home">
          <SlotNestLogo className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
        </Link>

        <div className="hidden items-center gap-6 pl-5 text-[14px] md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-muted-foreground"
            >
              {link.dot && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-foreground"
                  aria-hidden="true"
                />
              )}
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/sign-in"
            className="hidden px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-primary py-1.5 pr-1.5 pl-4 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:text-[14px]"
          >
            <span className="hidden sm:inline">Get early access</span>
            <span className="sm:hidden">Early access</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </Link>
          <button
            type="button"
            className="inline-flex p-2 text-foreground md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {open && (
          <div className="absolute top-full right-2 left-2 z-20 mt-2 rounded-2xl border border-border bg-background p-3 shadow-lg md:hidden">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {link.dot && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-foreground"
                    aria-hidden="true"
                  />
                )}
                {link.label}
              </a>
            ))}
            <Link
              href="/sign-in"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-muted-foreground hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
