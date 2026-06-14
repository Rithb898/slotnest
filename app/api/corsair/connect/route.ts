import { generateOAuthUrl } from "corsair/oauth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSession } from "@/server/auth/server";
import { corsair } from "@/server/corsair";

const REDIRECT_URI = `${env.APP_URL}/api/corsair/callback`;
const PLUGINS = ["gmail", "googlecalendar"] as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { searchParams } = new URL(request.url);
  const plugin = searchParams.get("plugin");
  if (!plugin || !PLUGINS.includes(plugin as (typeof PLUGINS)[number])) {
    return new NextResponse("Invalid or missing plugin.", { status: 400 });
  }

  // Chained connect (Option A): `?next=<plugin>` asks the callback to continue
  // into a second OAuth once this one finishes — so "Connect Google" links
  // Gmail → Calendar in a single click. Carried in a cookie because Corsair owns
  // the `state` param and the redirect_uri must match generateOAuthUrl exactly.
  const nextParam = searchParams.get("next");
  const next =
    nextParam &&
    nextParam !== plugin &&
    PLUGINS.includes(nextParam as (typeof PLUGINS)[number])
      ? nextParam
      : null;

  const { url, state } = await generateOAuthUrl(corsair, plugin, {
    tenantId: session.user.id,
    redirectUri: REDIRECT_URI,
  });

  const response = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  response.cookies.set("corsair_oauth_state", state, cookieOpts);
  // Set the chain target, or clear any stale one so a standalone connect
  // (e.g. "Reconnect Gmail") never accidentally drags the user into a second flow.
  if (next) {
    response.cookies.set("corsair_oauth_next", next, cookieOpts);
  } else {
    response.cookies.delete("corsair_oauth_next");
  }
  return response;
}
