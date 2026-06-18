import { Suspense } from "react";

import { SentClient } from "./_components/sent-client";

// Static shell; live Gmail data is fetched client-side through tRPC.
export default function SentPage() {
  return (
    <Suspense>
      <SentClient />
    </Suspense>
  );
}
