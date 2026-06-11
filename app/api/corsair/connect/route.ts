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

  const plugin = new URL(request.url).searchParams.get("plugin");
  if (!plugin || !PLUGINS.includes(plugin as (typeof PLUGINS)[number])) {
    return new NextResponse("Invalid or missing plugin.", { status: 400 });
  }

  const { url, state } = await generateOAuthUrl(corsair, plugin, {
    tenantId: session.user.id,
    redirectUri: REDIRECT_URI,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set("corsair_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
