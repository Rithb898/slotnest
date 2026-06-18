import { Suspense } from "react";

import { InboxClient } from "./_components/inbox-client";

// Static shell. All request-scoped data is fetched client-side via tRPC hooks
// in <InboxClient/>, so this page itself touches no headers/session (keeps
// Cache Components happy). Auth is enforced by the proxy + `protectedProcedure`.
export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxClient />
    </Suspense>
  );
}
