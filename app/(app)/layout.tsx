import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { CommandBar } from "@/components/command-bar";
import { getSession } from "@/server/auth/server";

/**
 * App shell for every `(app)` route (DESIGN: "App shell").
 *
 * Server layout: confirms the user is signed in (better-auth) — the proxy also
 * redirects signed-out users, but this is the real boundary for the shell.
 * Renders the left sidebar + the global ⌘K command bar so the command bar is
 * available on every `(app)` route. Connection guidance toward /connections is
 * handled per-page (and by the empty states on /today and /inbox) so the
 * /connections page itself isn't blocked.
 *
 * Cache Components: `getSession()` reads `headers()` (runtime data), so the
 * auth gate lives in an async child inside <Suspense>. This lets Next extract
 * the static shell without blocking the whole route on request-time data.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandBar>
      <div className="flex h-svh w-full overflow-hidden">
        <AppSidebar />
        {/* data-lenis-prevent: the app shell scrolls inside this <main>, not the
         * window — without it the root Lenis instance swallows wheel events and
         * the page can't scroll. */}
        <main className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
          <Suspense fallback={children}>
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </main>
      </div>
    </CommandBar>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return <>{children}</>;
}
