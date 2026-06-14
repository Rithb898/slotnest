import { Suspense } from "react";

import { WaitingClient } from "./_components/waiting-client";

// Static shell; live Gmail data is fetched client-side through tRPC.
export default function WaitingPage() {
  return (
    <Suspense>
      <WaitingClient />
    </Suspense>
  );
}
