"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LogOut,
  Mail,
  Plug,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BILLING_PLAN_CATALOG } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/auth/client";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";
import posthog from "posthog-js";

type SettingsTab = "connections" | "billing" | "trust" | "account" | "admin";
type BillingSummary = RouterOutputs["billing"]["summary"];
type AdminSearchResult = RouterOutputs["admin"]["searchUsers"];
type AdminUser = AdminSearchResult["users"][number];

const PROVIDERS = [
  {
    key: "gmail",
    label: "Gmail",
    description: "Read what needs a reply and draft responses in your voice.",
    icon: Mail,
  },
  {
    key: "googlecalendar",
    label: "Google Calendar",
    description: "See today's events and find the open slots worth booking.",
    icon: CalendarDays,
  },
] as const;

export function SettingsClient({
  connected,
  billing,
  isAdmin,
}: {
  connected: string[];
  billing: BillingSummary;
  isAdmin: boolean;
}) {
  const searchParams = useSearchParams();
  const initialTab = resolveSettingsTab(searchParams, isAdmin);
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const handled = useRef(false);

  // OAuth callback redirects back here with ?connected= or ?error=.
  useEffect(() => {
    if (handled.current) return;
    const ok = searchParams.get("connected");
    const err = searchParams.get("error");
    if (ok) {
      toast.success(`Connected ${labelFor(ok)}`);
      handled.current = true;
    } else if (err === "oauth_cancelled") {
      toast("Connection cancelled.");
      handled.current = true;
    } else if (err) {
      toast.error("Connection failed. Please try again.");
      handled.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    setTab(resolveSettingsTab(searchParams, isAdmin));
  }, [isAdmin, searchParams]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
      <TabsList className="w-full flex-wrap justify-start gap-1 sm:w-auto">
        <TabsTrigger value="connections" className="flex-1">
          <Plug />
          Connections
        </TabsTrigger>
        <TabsTrigger value="billing" className="flex-1">
          <CreditCard />
          Billing
        </TabsTrigger>
        <TabsTrigger value="trust" className="flex-1">
          <Shield />
          Trust & Safety
        </TabsTrigger>
        <TabsTrigger value="account" className="flex-1">
          Account
        </TabsTrigger>
        {isAdmin ? (
          <TabsTrigger value="admin" className="flex-1">
            <ShieldCheck />
            Admin
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="connections" className="pt-5">
        <ConnectionsPanel connected={connected} />
      </TabsContent>

      <TabsContent value="billing" className="pt-5">
        <BillingPanel billing={billing} />
      </TabsContent>

      <TabsContent value="trust" className="pt-5">
        <TrustPanel />
      </TabsContent>

      <TabsContent value="account" className="pt-5">
        <AccountPanel />
      </TabsContent>

      {isAdmin ? (
        <TabsContent value="admin" className="pt-5">
          <AdminPanel />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function resolveSettingsTab(
  searchParams: ReturnType<typeof useSearchParams>,
  isAdmin: boolean,
): SettingsTab {
  const tab = searchParams.get("tab");
  if (tab === "billing") return "billing";
  if (tab === "trust") return "trust";
  if (tab === "account") return "account";
  if (tab === "admin" && isAdmin) return "admin";
  return "connections";
}

function labelFor(key: string): string {
  return PROVIDERS.find((p) => p.key === key)?.label ?? key;
}

function ConnectionsPanel({ connected }: { connected: string[] }) {
  const router = useRouter();
  const missing = PROVIDERS.filter((p) => !connected.includes(p.key));
  const allConnected = missing.length === 0;
  const connectionState = allConnected
    ? "connected"
    : connected.length > 0
      ? "partial"
      : "missing";
  const utils = api.useUtils();
  const disconnect = api.connections.disconnect.useMutation({
    onSuccess: async (_, variables) => {
      posthog.capture("integration_disconnected", { provider: variables.provider });
      toast.success(`Disconnected ${labelFor(variables.provider)}`);
      await utils.connections.list.invalidate();
      router.refresh();
    },
    onError: () => {
      toast.error("Could not disconnect right now.");
    },
  });

  async function handleDisconnect(provider: (typeof PROVIDERS)[number]["key"]) {
    if (!window.confirm(`Disconnect ${labelFor(provider)} from SlotNest?`)) {
      return;
    }
    disconnect.mutate({ provider });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Connections</CardTitle>
            <CardDescription>
              Gmail and Calendar stay separate, with connect, reconnect, and
              disconnect controls.
            </CardDescription>
          </div>
          <Badge variant="ghost" className="shrink-0 uppercase tracking-wide">
            {connectionState}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {missing.length > 1 ? (
          <div className="flex items-center gap-4 rounded-3xl border border-primary/30 bg-primary/5 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-honey-ink">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold">
                Connect Google
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gmail and Calendar together, one click.
              </p>
            </div>
            <Link
              href={`/api/corsair/connect?plugin=${missing[0].key}&next=${missing[1].key}`}
              className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
            >
              Connect Google
            </Link>
          </div>
        ) : null}

        {PROVIDERS.map((provider) => (
          <ProviderRow
            key={provider.key}
            provider={provider}
            isConnected={connected.includes(provider.key)}
            onDisconnect={handleDisconnect}
          />
        ))}

        <p className="mt-1 flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          <span>
            {allConnected
              ? "SlotNest is connected. Tokens are encrypted at rest and only used to act on your behalf."
              : "SlotNest only reads what it needs to triage and schedule. Tokens are encrypted at rest, and you can disconnect any time."}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function ProviderRow({
  provider,
  isConnected,
  onDisconnect,
}: {
  provider: (typeof PROVIDERS)[number];
  isConnected: boolean;
  onDisconnect: (provider: (typeof PROVIDERS)[number]["key"]) => void;
}) {
  const Icon = provider.icon;
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl",
          isConnected
            ? "bg-success-subtle text-success"
            : "bg-primary/10 text-honey-ink",
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] font-semibold">
            {provider.label}
          </span>
          {isConnected ? (
            <Badge
              variant="ghost"
              className="bg-success-subtle text-success hover:bg-success-subtle"
            >
              <Check className="size-3" />
              Connected
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {provider.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isConnected ? (
          <>
            <Link
              href={`/api/corsair/connect?plugin=${provider.key}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-muted-foreground",
              )}
            >
              Reconnect
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDisconnect(provider.key)}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Link
            href={`/api/corsair/connect?plugin=${provider.key}`}
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
          >
            Connect
          </Link>
        )}
      </div>
    </div>
  );
}

function BillingPanel({ billing }: { billing: BillingSummary }) {
  const subscription = billing.subscription;
  const plan = billing.currentPlan;
  const subscriptionLabel = subscription
    ? formatSubscriptionStatus(subscription.status)
    : "No subscription";
  const showCheckout = !subscription || plan.name !== "pro";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Plan status and Razorpay subscription checkout.
              </CardDescription>
            </div>
            <Badge variant="ghost">{subscriptionLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-3xl border border-foreground/5 bg-muted/30 p-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Current plan
              </div>
              <div className="mt-1 text-lg font-semibold">
                {plan?.label ?? "No active plan"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan?.description ?? BILLING_PLAN_CATALOG.pro.description}
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Renewal
              </div>
              <div className="mt-1 text-lg font-semibold">
                {subscription?.currentEnd
                  ? formatDate(subscription.currentEnd)
                  : "No active renewal"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription?.trialEnd
                  ? `Trial ends ${formatDate(subscription.trialEnd)}`
                  : subscription?.status === "created"
                    ? "Ready for Razorpay checkout."
                    : subscription?.status === "paused"
                      ? "Subscription is paused in Razorpay."
                      : subscription?.status === "pending"
                        ? "Razorpay is retrying payment."
                        : subscription?.status === "halted"
                          ? "Razorpay needs payment attention."
                          : "Renewal updates in Razorpay."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {showCheckout ? <BillingUpgradeButton label="Upgrade now" /> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ADMIN_PAGE_SIZE = 10;

function AdminPanel() {
  const utils = api.useUtils();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [upgradingUserId, setUpgradingUserId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setOffset(0);
      setActionError(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const usersQuery = api.admin.searchUsers.useQuery(
    {
      q: searchQuery,
      limit: ADMIN_PAGE_SIZE,
      offset,
    },
    { staleTime: 15_000 },
  );

  const upgrade = api.admin.upgradeToPro.useMutation({
    onMutate: ({ userId }) => {
      setUpgradingUserId(userId);
      setActionError(null);
    },
    onSuccess: async () => {
      toast.success("Subscription upgraded to Pro.");
      await utils.admin.searchUsers.invalidate();
      setActionError(null);
    },
    onError: (error) => {
      setActionError(error.message);
    },
    onSettled: () => {
      setUpgradingUserId(null);
    },
  });

  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + ADMIN_PAGE_SIZE < total;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + ADMIN_PAGE_SIZE, total);
  const isLoading = usersQuery.isLoading && !usersQuery.data;

  function handleSearch(value: string) {
    setSearchInput(value);
    setOffset(0);
    setActionError(null);
  }

  function handleUpgrade(user: AdminUser) {
    if (upgrade.isPending || upgradingUserId) return;
    upgrade.mutate({ userId: user.id });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Admin</CardTitle>
            <CardDescription>
              Search platform users and manually move an account to Pro.
            </CardDescription>
          </div>
          <Badge variant="ghost" className="shrink-0 uppercase tracking-wide">
            Server gated
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Search by name or email"
              className="h-10 rounded-2xl pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOffset((current) => Math.max(current - ADMIN_PAGE_SIZE, 0))
              }
              disabled={!hasPrev}
            >
              <ChevronLeft className="size-3.5" />
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOffset((current) => current + ADMIN_PAGE_SIZE)}
              disabled={!hasNext}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>Upgrade failed</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "No users found"
              : `Showing ${start}-${end} of ${total}`}
          </span>
          <span>
            {searchQuery ? `Filtered by "${searchQuery}"` : "All users"}
          </span>
        </div>

        <div className="rounded-3xl border border-foreground/5 bg-background/60">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-10 w-full rounded-2xl" />
            </div>
          ) : usersQuery.isError ? (
            <Empty className="min-h-56 border-0 p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldCheck className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Could not load users</EmptyTitle>
                <EmptyDescription>{usersQuery.error.message}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : users.length === 0 ? (
            <Empty className="min-h-56 border-0 p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No matching users</EmptyTitle>
                <EmptyDescription>
                  Try a different name or email address.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <div className="truncate font-medium">{user.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={
                            user.currentPlan.name === "pro"
                              ? "default"
                              : "outline"
                          }
                        >
                          {user.currentPlan.label}
                        </Badge>
                        {user.subscription ? (
                          <Badge variant="ghost">
                            {user.subscription.plan}
                          </Badge>
                        ) : (
                          <Badge variant="ghost">No subscription</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.subscription ? (
                        <Badge variant="outline">
                          {user.subscription.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Free</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.subscription?.currentEnd
                        ? formatDate(user.subscription.currentEnd)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.currentPlan.name === "pro" ? (
                        <Badge variant="ghost">Already Pro</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUpgrade(user)}
                          disabled={
                            upgrade.isPending || upgradingUserId === user.id
                          }
                        >
                          {upgradingUserId === user.id ? (
                            <Spinner className="size-3.5" />
                          ) : null}
                          Upgrade to Pro
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountPanel() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  const name = session?.user.name ?? "Your account";
  const email = session?.user.email ?? "";
  const image = session?.user.image ?? undefined;

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <Avatar className="size-12">
          {image ? <AvatarImage src={image} alt={name} /> : null}
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-honey-ink">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.9375rem] font-semibold">{name}</div>
          {email ? (
            <div className="truncate text-xs text-muted-foreground">
              {email}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          className="shrink-0"
        >
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function TrustPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trust & Safety</CardTitle>
        <CardDescription>
          What SlotNest can see, what it can do, and how billing stays separate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <TrustRow
          title="Data access"
          body="SlotNest reads only what it needs to triage, draft, and schedule."
        />
        <Separator />
        <TrustRow
          title="Approval policy"
          body="Outbound email and calendar actions require a human approval step in v1."
        />
        <Separator />
        <TrustRow
          title="Token handling"
          body="OAuth tokens are encrypted at rest and scoped to the connected account."
        />
        <Separator />
        <TrustRow
          title="Disconnect"
          body="You can disconnect Gmail or Calendar at any time from this page."
        />
        <Separator />
        <TrustRow
          title="Billing boundary"
          body="Billing uses Razorpay, but account identity and Gmail or Calendar access stay separate."
        />
      </CardContent>
    </Card>
  );
}

function TrustRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-honey-ink">
        <ShieldCheck className="size-4" />
      </span>
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-1 leading-6">{body}</div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(value);
}

function formatSubscriptionStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
