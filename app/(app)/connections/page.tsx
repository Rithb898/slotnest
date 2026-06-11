import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/server";
import { ConnectButtons } from "./_components/connect-buttons";

// Auth is enforced two ways: the proxy (`proxy.ts`) redirects signed-out users
// to /sign-in, and `connections.list` is a `protectedProcedure` (the real guard).
//
// Cache Components: the page shell is static; the request-dependent data fetch
// (`api.connections.list()` reads headers/session) lives in an async child
// inside <Suspense>, so the shell can stream immediately.
export default function ConnectionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Gmail and Google Calendar so SlotNest can work with your
          real inbox and schedule.
        </p>
      </div>
      <Suspense fallback={<ConnectionsFallback />}>
        <ConnectionsList />
      </Suspense>
    </div>
  );
}

async function ConnectionsList() {
  const connected = await api.connections.list();
  return <ConnectButtons connected={connected} />;
}

function ConnectionsFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-11 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-2xl" />
    </div>
  );
}
