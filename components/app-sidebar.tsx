"use client";

import {
  Archive,
  CalendarDays,
  ChevronsUpDown,
  Inbox,
  LogOut,
  MailCheck,
  MessageSquare,
  PenLine,
  Plug,
  Search,
  Send,
  Settings,
  Sun,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { useCommandBar } from "@/components/command-bar";
import { SlotNestMark } from "@/components/slotnest-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMac } from "@/hooks/use-is-mac";
import { CALENDAR_POLL_OPTIONS, INBOX_POLL_OPTIONS } from "@/lib/query-options";
import { cn } from "@/lib/utils";
import { isWaitingMessage } from "@/lib/workspace";
import { authClient } from "@/server/auth/client";
import { api } from "@/trpc/react";

type NavItem = {
  href: Route;
  label: string;
  icon: typeof Sun;
  shortcut?: string;
};

const PRIMARY: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun, shortcut: "G T" },
  { href: "/chat", label: "Chat", icon: MessageSquare, shortcut: "G A" },
  { href: "/inbox", label: "Inbox", icon: Inbox, shortcut: "G I" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "G C" },
  { href: "/drafts", label: "Drafts", icon: PenLine, shortcut: "G D" },
  { href: "/waiting", label: "Waiting", icon: Send, shortcut: "G W" },
  { href: "/sent", label: "Sent", icon: MailCheck, shortcut: "G S" },
  { href: "/archive" as Route, label: "Archive", icon: Archive },
];

const SECONDARY: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

const REQUIRED_INTEGRATIONS = ["gmail", "googlecalendar"];

type ConnHealth = "ok" | "partial" | "none";

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

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatBudgetReset(resetAt: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(resetAt);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpen } = useCommandBar();
  const isMac = useIsMac();

  const connections = api.connections.list.useQuery();
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const calendarConnected =
    connections.data?.includes("googlecalendar") ?? false;
  const billingEnabled =
    connections.isSuccess && (connections.data?.length ?? 0) > 0;
  const billing = api.billing.summary.useQuery(undefined, {
    enabled: billingEnabled,
  });
  const inbox = api.gmail.inbox.useQuery(
    {},
    { ...INBOX_POLL_OPTIONS, enabled: gmailConnected },
  );

  const draftsCount =
    inbox.data?.messages.filter(
      (m) => m.replyStatus && m.replyStatus !== "sent",
    ).length ?? 0;
  const [todayRange, setTodayRange] = useState<{
    timeMin: string;
    timeMax: string;
  }>();
  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    setTodayRange({ timeMin: start.toISOString(), timeMax: end.toISOString() });
  }, []);
  const calendar = api.calendar.events.useQuery(todayRange, {
    ...CALENDAR_POLL_OPTIONS,
    enabled: !!todayRange && calendarConnected,
  });
  const { state } = useSidebar();

  const needsYou =
    inbox.data?.messages.filter(
      (m) => m.triage.action === "Needs reply" && m.replyStatus !== "sent",
    ).length ?? 0;
  const waitingCount =
    inbox.data?.messages.filter(isWaitingMessage).length ?? 0;
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
  const plan = billing.data?.currentPlan ?? null;
  const aiBudget = billing.data?.aiActionBudget ?? null;

  function trailingFor(href: string): React.ReactNode {
    if (state === "collapsed") return null;
    if (href === "/today")
      return <CountBadge count={needsYou} urgent={hasUrgent} />;
    if (href === "/inbox")
      return <CountBadge count={needsYou} urgent={hasUrgent} />;
    if (href === "/drafts")
      return <CountBadge count={draftsCount} tone="muted" />;
    if (href === "/calendar" && todayCount > 0) {
      return <CountBadge count={todayCount} tone="muted" />;
    }
    if (href === "/waiting")
      return <CountBadge count={waitingCount} tone="muted" />;
    if (href === "/settings" && health) return <StatusDot health={health} />;
    return null;
  }

  function labelFor(item: NavItem): string {
    if (item.href === "/settings" && health === "none") {
      return "Connect accounts";
    }
    return item.label;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 pt-2">
          <Link
            href="/today"
            aria-label="SlotNest home"
            className="flex min-w-0 items-center gap-2"
          >
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <SlotNestMark className="size-full rounded-full object-cover" />
            </span>
            {state !== "collapsed" ? (
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                SlotNest
              </span>
            ) : null}
          </Link>
        </div>

        {state !== "collapsed" ? (
          <div className="px-2 pb-1">
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
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(pathname, item.href)}
                    tooltip={labelFor(item)}
                    variant={
                      isActive(pathname, item.href) ? "outline" : "default"
                    }
                    className="justify-between"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{labelFor(item)}</span>
                    </span>
                    {trailingFor(item.href) ? (
                      <span className="shrink-0">{trailingFor(item.href)}</span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(pathname, item.href)}
                    tooltip={labelFor(item)}
                    variant={
                      isActive(pathname, item.href) ? "outline" : "default"
                    }
                    className="justify-between"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{labelFor(item)}</span>
                    </span>
                    {trailingFor(item.href) ? (
                      <span className="shrink-0">{trailingFor(item.href)}</span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {state !== "collapsed" ? (
          <div className="px-2 pb-2">
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Plan
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium leading-tight">
                    {plan?.label ?? "Free"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {plan?.description ??
                      "Core SlotNest access for personal use."}
                  </div>
                  {aiBudget ? (
                    <div
                      className={cn(
                        "mt-2 text-xs",
                        aiBudget.exhausted
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      <div>
                        {aiBudget.exhausted
                          ? "AI budget exhausted"
                          : `${aiBudget.remaining} of ${aiBudget.limit} AI actions left`}
                      </div>
                      <div>Resets {formatBudgetReset(aiBudget.resetAt)}</div>
                    </div>
                  ) : null}
                </div>
              </div>
              {plan?.name !== "pro" ? (
                <BillingUpgradeButton
                  label="Upgrade now"
                  size="sm"
                  className="mt-3 w-full"
                />
              ) : null}
            </div>
          </div>
        ) : null}
        <AccountMenu health={health} />
      </SidebarFooter>
    </Sidebar>
  );
}

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
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums",
        tone === "muted"
          ? "bg-muted/80 text-muted-foreground"
          : urgent
            ? "bg-urgent-subtle text-urgent"
            : "bg-primary/15 text-honey-ink",
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

function StatusDot({ health }: { health: ConnHealth }) {
  const cfg = {
    ok: { cls: "bg-success", label: "All accounts connected" },
    partial: { cls: "bg-primary", label: "Finish connecting your accounts" },
    none: { cls: "bg-urgent", label: "No accounts connected" },
  }[health];
  return (
    <span role="img" title={cfg.label} aria-label={cfg.label}>
      <span
        className={cn("block size-2 rounded-full ring-2 ring-sidebar", cfg.cls)}
        aria-hidden
      />
    </span>
  );
}

function AccountMenu({ health }: { health?: ConnHealth | null }) {
  const router = useRouter();
  const { state } = useSidebar();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const avatarUrl = user?.image ?? undefined;
  const needsConnect = !!health && health !== "ok";

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
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent",
              state === "collapsed" && "justify-center px-0",
            )}
          />
        }
      >
        <span className="relative">
          <Avatar className="size-7 rounded-full">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback className="rounded-full bg-primary/15 text-xs font-semibold text-honey-ink">
              {initials}
            </AvatarFallback>
          </Avatar>
          {needsConnect ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-sidebar",
                health === "none" ? "bg-urgent" : "bg-primary",
              )}
              aria-hidden
            />
          ) : null}
        </span>
        {state !== "collapsed" ? (
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
        ) : null}
        {state !== "collapsed" ? (
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
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
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Plug className="size-4" />
          {health === "none" ? "Connect accounts" : "Settings"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
