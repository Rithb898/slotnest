import { Suspense } from "react";

import { DraftsClient } from "./_components/drafts-client";

// Static shell. Draft data is fetched client-side so the page stays responsive
// and keeps matching the rest of the authenticated workspace.
export default function DraftsPage() {
  return (
    <Suspense>
      <DraftsClient />
    </Suspense>
  );
}
