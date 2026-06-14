import { Suspense } from "react";
import { CalendarClient } from "./_components/calendar-client";

// Static shell. Request-scoped data (events, free slots) is fetched client-side
// via tRPC hooks in <CalendarClient/>, matching the /inbox + /today pattern.
// Cache Components: the client subtree is wrapped in <Suspense> so the static
// shell can be extracted without blocking on uncached data.
// Auth is enforced by the (app) layout + the proxy + `protectedProcedure`.
export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarClient />
    </Suspense>
  );
}
