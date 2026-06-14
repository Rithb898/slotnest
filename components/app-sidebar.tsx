"use client";

import { CalendarDays, Inbox, Plug, Sun } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * App sidebar (DESIGN: "Navigation").
 *
 * Left rail on `panel`, Title-weight ghost rows. The active item is the ONLY
 * persistent honey on the page: honey-ink text + a 2px leading honey rail.
 * A ⌘K hint sits near the top. On mobile the rail collapses to a fixed bottom
 * bar with ≥44px touch targets.
 */

type NavItem = {
  href: Route;
  label: string;
  icon: typeof Sun;
};

const PRIMARY: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

const SECONDARY: NavItem[] = [
  { href: "/connections", label: "Connections", icon: Plug },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-[var(--sidebar)] md:flex">
        <div className="flex items-center justify-between px-4 py-4">
          <Link
            href="/today"
            className="text-base font-semibold tracking-tight"
          >
            SlotNest
          </Link>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 text-xs text-muted-foreground">
          <span>Search & commands</span>
          <Kbd>⌘K</Kbd>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {PRIMARY.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
          <div className="my-2 h-px bg-border" aria-hidden />
          <div className="mt-auto" />
          {SECONDARY.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-[var(--sidebar)] md:hidden">
        {[...PRIMARY, ...SECONDARY].map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
                active ? "text-[var(--honey-ink)]" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-[0.9375rem] font-semibold leading-none transition-colors",
        active ? "text-[var(--honey-ink)]" : "text-foreground hover:bg-accent",
      )}
      aria-current={active ? "page" : undefined}
    >
      {/* 2px leading honey rail — only on the active item. */}
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
