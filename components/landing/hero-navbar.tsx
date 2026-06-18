"use client";

import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SlotNestMark } from "@/components/slotnest-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/server/auth/client";

type NavLink = { label: string; href: string; dot?: boolean };

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/", dot: true },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
];

export function HeroNavbar() {
  const [open, setOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const name = user?.name?.trim() || user?.email?.split("@")[0] || "Account";
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <header className="flex justify-center px-3 pt-4 sm:px-4 sm:pt-6">
      <nav className="relative flex w-full max-w-[760px] items-center rounded-full border border-border/80 bg-background/85 py-2 pr-2 pl-2 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <Link href="/" className="shrink-0 pl-1.5" aria-label="SlotNest home">
          <SlotNestMark className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
        </Link>

        <div className="hidden items-center gap-6 pl-5 text-[14px] md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="inline-flex items-center gap-1.5 font-medium text-foreground transition-[color,transform] duration-200 hover:-translate-y-0.5 hover:text-muted-foreground"
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
          {session ? (
            <Link
              href="/today"
              className="inline-flex items-center rounded-full border border-border/70 bg-background/80 p-1.5 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5"
              aria-label="Open dashboard"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? undefined} alt={name} />
                <AvatarFallback className="text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="sheen-host group inline-flex items-center gap-2 rounded-full bg-primary py-1.5 pr-1.5 pl-4 text-[13px] font-medium text-primary-foreground transition-[transform,opacity,box-shadow] duration-200 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.4)] sm:text-[14px]"
              >
                <span className="hidden sm:inline">Get started free</span>
                <span className="sm:hidden">Early access</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </Link>
            </>
          )}
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
          <div className="absolute top-full right-2 left-2 z-20 mt-2 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur-md md:hidden">
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
            {session ? (
              <Link
                href="/today"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-medium text-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.image ?? undefined} alt={name} />
                  <AvatarFallback className="text-[11px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                Profile
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
