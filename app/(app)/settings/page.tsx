import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/server";
import { SettingsClient } from "./_components/settings-client";

// Auth is enforced two ways: the proxy (`proxy.ts`) redirects signed-out users
// to /sign-in, and `connections.list` is a `protectedProcedure` (the real guard).
//
// Cache Components: the page shell is static; the request-dependent data fetch
// (`api.connections.list()` reads headers/session) lives in an async child
// inside <Suspense>, so the shell can stream immediately.
export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-7 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage the accounts SlotNest works with and your profile.
        </p>
      </header>
      <Suspense fallback={<SettingsFallback />}>
        <SettingsData />
      </Suspense>
    </div>
  );
}

async function SettingsData() {
  const connected = await api.connections.list();
  return <SettingsClient connected={connected} />;
}

function SettingsFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-64 rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-28 w-full rounded-3xl" />
    </div>
  );
}
