import { Suspense } from "react";

import { ArchiveClient } from "./_components/archive-client";

// Static shell; live Gmail data is fetched client-side through tRPC.
export default function ArchivePage() {
  return (
    <Suspense>
      <ArchiveClient />
    </Suspense>
  );
}
