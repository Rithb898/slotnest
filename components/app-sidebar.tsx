"use client";

import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Inbox,
  LogOut,
  Monitor,
  Moon,
  Plug,
  Search,
  Sun,
  SunMedium,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { useCommandBar } from "@/components/command-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/auth/client";
import { api } from "@/trpc/react";

/**
 * App sidebar (DESIGN: "Navigation").
 *
 * Left rail on `panel`, Title-weight ghost rows. The active item is the ONLY
 * persistent honey on the page: honey-ink text + a 2px leading honey rail.
 * The top of the rail is a real search button that opens ⌘K. The foot of the
 * rail is the signed-in account menu (sign-out). On mobile the rail collapses
 * to a fixed bottom bar with ≥44px touch targets.
 */

type NavItem = {
  href: Route;
  label: string;
  icon: typeof Sun;
  /** `g`-chord hint shown faintly on hover/focus (wired in command-bar). */
  shortcut?: string;
};

const PRIMARY: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun, shortcut: "G T" },
  { href: "/inbox", label: "Inbox", icon: Inbox, shortcut: "G I" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "G C" },
];

const SECONDARY: NavItem[] = [
  { href: "/connections", label: "Connections", icon: Plug },
];

// The integrations SlotNest needs to fully function (Corsair plugin keys).
const REQUIRED_INTEGRATIONS = ["gmail", "googlecalendar"];

type ConnHealth = "ok" | "partial" | "none";

/** null while loading (stay quiet — no premature warning dot). */
function connectionHealth(connected: string[] | undefined): ConnHealth | null {
  if (!connected) return null;
  const have = REQUIRED_INTEGRATIONS.filter((n) =>
    connected.includes(n),
  ).length;
  if (have === REQUIRED_INTEGRATIONS.length) return "ok";
  if (have === 0) return "none";
  return "partial";
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * True on macOS/iOS. Defaults to `false` so SSR and the first client render
 * agree (no hydration mismatch); the real value lands after mount. ⌘K and
 * Ctrl K both work — see the keydown handler in command-bar.tsx.
 */
function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    const ua =
      // @ts-expect-error userAgentData is not yet in all lib.dom typings.
      navigator.userAgentData?.platform ??
      navigator.platform ??
      navigator.userAgent;
    setIsMac(/mac|iphone|ipad|ipod/i.test(ua));
  }, []);
  return isMac;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpen } = useCommandBar();
  const isMac = useIsMac();

  // (1) "Needs you" count + (2) connection health drive the live rail. Both
  // queries share React Query cache keys with /today + /inbox + /connections,
  // so the sidebar adds no extra fetch on those pages.
  const inbox = api.gmail.inbox.useQuery({});
  const connections = api.connections.list.useQuery();

  // (6) Today's events. Same midnight→midnight range as /today, so the cache
  // key matches and no extra fetch happens on that page.
  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }, []);
  const calendar = api.calendar.events.useQuery(todayRange);

  const needsYou =
    inbox.data?.messages.filter((m) => m.triage.action === "Needs reply")
      .length ?? 0;
  const hasUrgent =
    inbox.data?.messages.some(
      (m) => m.triage.action === "Needs reply" && m.triage.urgency === "Urgent",
    ) ?? false;

  const todayCount = calendar.data?.connected
    ? calendar.data.events.filter((e) =>
        e.start ? isToday(new Date(e.start)) : false,
      ).length
    : 0;

  const health = connectionHealth(connections.data);

  function trailingFor(href: string): React.ReactNode {
    if (href === "/today" && todayCount > 0) {
      return <CountBadge count={todayCount} tone="muted" />;
    }
    if (href === "/inbox")
      return <CountBadge count={needsYou} urgent={hasUrgent} />;
    if (href === "/connections" && health) return <StatusDot health={health} />;
    return null;
  }

  // When nothing is connected, the row becomes the call to action itself.
  function labelFor(item: NavItem): string {
    if (item.href === "/connections" && health === "none") {
      return "Connect accounts";
    }
    return item.label;
  }

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-[var(--sidebar)] md:flex">
        <div className="flex items-center px-4 py-4">
          <Link
            href="/today"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span className="grid size-6 place-items-center rounded-md bg-primary text-[var(--primary-foreground)]">
              <Sun className="size-3.5" />
            </span>
            SlotNest
          </Link>
        </div>

        {/* Search field that opens ⌘K. Read-only — it launches the command
            bar instead of accepting typing — so it stays keyboard-accessible. */}
        <div className="px-3 pb-3">
          {/* Open on click (after pointerup), not mousedown — opening the
              dialog mid-press makes base-ui treat the click as an outside
              dismiss and close it again. */}
          <InputGroup
            className="h-9 cursor-pointer"
            onClick={() => setOpen(true)}
          >
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              readOnly
              placeholder="Ask or search…"
              aria-label="Open command bar"
              className="cursor-pointer"
              // Block the caret/focus on the read-only field; the container's
              // onClick still fires and opens the bar.
              onMouseDown={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
            />
            <InputGroupAddon align="inline-end">
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <nav className="flex flex-1 flex-col px-2">
          <SectionLabel>Workspace</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {PRIMARY.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                label={labelFor(item)}
                trailing={trailingFor(item.href)}
                shortcut={item.shortcut}
                active={isActive(pathname, item.href)}
              />
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-0.5 pt-4">
            <SectionLabel>Setup</SectionLabel>
            {SECONDARY.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                label={labelFor(item)}
                trailing={trailingFor(item.href)}
                shortcut={item.shortcut}
                active={isActive(pathname, item.href)}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-border p-2">
          <AccountMenu />
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-[var(--sidebar)] md:hidden">
        {[...PRIMARY, ...SECONDARY].map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const showCount = item.href === "/inbox" && needsYou > 0;
          const showDot =
            item.href === "/connections" && health && health !== "ok";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
                active ? "text-[var(--honey-ink)]" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon className="size-5" />
                {showCount ? (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums text-white",
                      hasUrgent ? "bg-urgent" : "bg-primary",
                    )}
                  >
                    {needsYou > 9 ? "9+" : needsYou}
                  </span>
                ) : null}
                {showDot ? (
                  <span
                    className={cn(
                      "absolute -right-1.5 -top-0.5 size-2 rounded-full ring-2 ring-[var(--sidebar)]",
                      health === "none" ? "bg-urgent" : "bg-primary",
                    )}
                  />
                ) : null}
              </span>
              <span>{labelFor(item)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground"
        >
          <Search className="size-5" />
          <span>Search</span>
        </button>
      </nav>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
      {children}
    </p>
  );
}

function SidebarLink({
  item,
  active,
  label,
  trailing,
  shortcut,
}: {
  item: NavItem;
  active: boolean;
  label?: string;
  trailing?: React.ReactNode;
  shortcut?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-[0.9375rem] font-semibold leading-none transition-colors",
        active
          ? "bg-accent text-[var(--honey-ink)]"
          : "text-foreground hover:bg-accent",
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
      <span className="truncate">{label ?? item.label}</span>

      <span className="ml-auto flex items-center">
        {/* (4) `g`-chord hint — appears on hover/focus, swaps out the badge. */}
        {shortcut ? (
          <span
            className="hidden font-mono text-[0.6875rem] tracking-wide text-muted-foreground/70 group-hover:inline group-focus-visible:inline"
            aria-hidden
          >
            {shortcut}
          </span>
        ) : null}
        {trailing ? (
          <span
            className={cn(
              shortcut && "group-hover:hidden group-focus-visible:hidden",
            )}
          >
            {trailing}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Count pill. `tone="muted"` is informational (today's events); the default
 * honey/urgent tone signals an action the user owes ("needs you").
 */
function CountBadge({
  count,
  urgent,
  tone = "action",
}: {
  count: number;
  urgent?: boolean;
  tone?: "action" | "muted";
}) {
  if (count <= 0) return null;
  return (
    <output
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        tone === "muted"
          ? "bg-muted text-muted-foreground"
          : urgent
            ? "bg-urgent-subtle text-urgent"
            : "bg-primary/15 text-[var(--honey-ink)]",
      )}
      aria-label={
        tone === "muted"
          ? `${count} event${count === 1 ? "" : "s"} today`
          : `${count} ${urgent ? "urgent " : ""}email${count === 1 ? "" : "s"} need you`
      }
    >
      {count > 99 ? "99+" : count}
    </output>
  );
}

/** (2) Connection health dot on the Connections row. */
function StatusDot({ health }: { health: ConnHealth }) {
  const cfg = {
    ok: { cls: "bg-success", label: "All accounts connected" },
    partial: { cls: "bg-primary", label: "Finish connecting your accounts" },
    none: { cls: "bg-urgent", label: "No accounts connected" },
  }[health];
  return (
    <span role="img" title={cfg.label} aria-label={cfg.label}>
      <span className={cn("block size-2 rounded-full", cfg.cls)} aria-hidden />
    </span>
  );
}

const THEMES = [
  { value: "light", label: "Light", icon: SunMedium },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function AccountMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  // (5) Theme toggle. `mounted` guards against SSR/client theme mismatch so
  // the active check only renders once the real theme is known.
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = user?.name?.trim() || user?.email?.split("@")[0] || "Account";
  const email = user?.email ?? "";
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
          />
        }
      >
        <Avatar className="size-7 shrink-0 rounded-md">
          <AvatarFallback className="rounded-md bg-primary/15 text-xs font-semibold text-[var(--honey-ink)]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">
            {name}
          </span>
          {email ? (
            <span className="block truncate text-xs leading-tight text-muted-foreground">
              {email}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium">{name}</span>
            {email ? (
              <span className="block truncate text-xs text-muted-foreground">
                {email}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground/80">
            Theme
          </DropdownMenuLabel>
          {THEMES.map(({ value, label, icon: ThemeIcon }) => (
            <DropdownMenuItem
              key={value}
              // Keep the menu open so users can preview themes without reopening.
              closeOnClick={false}
              onClick={() => setTheme(value)}
            >
              <ThemeIcon className="size-4" />
              {label}
              {mounted && theme === value ? (
                <Check className="ml-auto size-4" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
