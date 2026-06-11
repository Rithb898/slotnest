import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "./server/auth/server";

// Routes only signed-OUT users should see — signed-in users get bounced home.
const AUTH_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
];
// App routes that require a session — signed-out users get sent to /sign-in.
// NOTE: this is a UX redirect only. The real guard is `protectedProcedure` in
// the tRPC layer (a matcher edit must never become the sole auth boundary).
const PROTECTED_ROUTES = ["/connections", "/inbox"];

export async function proxy(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return session
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    return session
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/connections",
    "/connections/:path*",
    "/inbox",
    "/inbox/:path*",
  ],
};
