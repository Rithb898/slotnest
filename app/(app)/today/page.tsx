import { TodayClient } from "./_components/today-client";

// Static shell. Request-scoped data (the triaged inbox) is fetched client-side
// via tRPC hooks in <TodayClient/>, matching the /inbox page pattern. Auth is
// enforced by the (app) layout + the proxy + `protectedProcedure`.
export default function TodayPage() {
  return <TodayClient />;
}
