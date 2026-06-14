import { Suspense } from "react";

import { DraftsClient } from "./_components/drafts-client";

// Static shell; live Gmail/Calendar data is fetched client-side through tRPC.
export default function DraftsPage() {
  return (
    <Suspense>
      <DraftsClient />
    </Suspense>
  );
}
