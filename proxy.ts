import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "./server/auth/server";

export async function proxy(request: NextRequest) {
  const session = await getSession();
  if (session) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"],
};
