import { Suspense } from "react";

import { TodayClient } from "./_components/today-client";

// Static shell. Request-scoped data (the triaged inbox) is fetched client-side
// via tRPC hooks in <TodayClient/>, matching the /inbox page pattern. Auth is
// enforced by the (app) layout + the proxy + `protectedProcedure`.
//
// <TodayClient/> reads the current time (`new Date()`) to build today's
// calendar window, which Cache Components excludes from the static prerender —
// so it must sit under a Suspense boundary.
export default function TodayPage() {
  return (
    <Suspense>
      <TodayClient />
    </Suspense>
  );
}
