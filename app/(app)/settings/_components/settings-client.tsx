"use client";

import {
  CalendarDays,
  Check,
  LogOut,
  Mail,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/auth/client";

type SettingsTab = "connections" | "account";

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

/**
 * /settings — a quiet, tabbed settings surface (DESIGN: "Quiet Desk").
 *
 * Connections is the primary tab (formerly its own /connections page); Account
 * shows the signed-in profile and sign-out. Honey is reserved for the single
 * active "Connect" action, matching the One Light Rule used across the app.
 */
export function SettingsClient({ connected }: { connected: string[] }) {
  const searchParams = useSearchParams();
  const initialTab: SettingsTab =
    searchParams.get("tab") === "account" ? "account" : "connections";
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
      <TabsList className="w-full max-w-xs">
        <TabsTrigger value="connections" className="flex-1">
          <Plug />
          Connections
        </TabsTrigger>
        <TabsTrigger value="account" className="flex-1">
          Account
        </TabsTrigger>
      </TabsList>

      <TabsContent value="connections" className="pt-5">
        <ConnectionsPanel connected={connected} />
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
  const missing = PROVIDERS.filter((p) => !connected.includes(p.key));
  const allConnected = missing.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {/* One-click chain: connect both missing providers in sequence. Only worth
       * its own CTA when more than one is missing — otherwise the row handles it. */}
      {missing.length > 1 ? (
        <div className="flex items-center gap-4 rounded-3xl border border-primary/30 bg-primary/5 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-[var(--honey-ink)]">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] font-semibold">Connect Google</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gmail and Calendar together — one click.
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
        />
      ))}

      <p className="mt-1 flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        <span>
          {allConnected
            ? "SlotNest is connected. Tokens are encrypted at rest and only used to act on your behalf."
            : "SlotNest only reads what it needs to triage and schedule. Tokens are encrypted at rest — disconnect any time in Google."}
        </span>
      </p>
    </div>
  );
}

function ProviderRow({
  provider,
  isConnected,
}: {
  provider: (typeof PROVIDERS)[number];
  isConnected: boolean;
}) {
  const Icon = provider.icon;
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl",
          isConnected
            ? "bg-success-subtle text-success"
            : "bg-primary/10 text-[var(--honey-ink)]",
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

      {isConnected ? (
        <Link
          href={`/api/corsair/connect?plugin=${provider.key}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "shrink-0 text-muted-foreground",
          )}
        >
          Reconnect
        </Link>
      ) : (
        <Link
          href={`/api/corsair/connect?plugin=${provider.key}`}
          className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
        >
          Connect
        </Link>
      )}
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
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-[var(--honey-ink)]">
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
