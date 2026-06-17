"use client";

import {
  CalendarDays,
  Check,
  CreditCard,
  LogOut,
  Mail,
  Plug,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BILLING_PLAN_CATALOG } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/auth/client";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";

type SettingsTab = "connections" | "billing" | "trust" | "account";
type BillingSummary = RouterOutputs["billing"]["summary"];

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
}: {
  connected: string[];
  billing: BillingSummary;
}) {
  const searchParams = useSearchParams();
  const initialTab: SettingsTab =
    searchParams.get("tab") === "billing"
      ? "billing"
      : searchParams.get("tab") === "trust"
        ? "trust"
        : searchParams.get("tab") === "account"
          ? "account"
          : "connections";
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
    </Tabs>
  );
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
                Plan status and the hosted Razorpay subscription flow.
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
                    ? "Opening Razorpay checkout in a popup."
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
    router.push("/sign-in");
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
