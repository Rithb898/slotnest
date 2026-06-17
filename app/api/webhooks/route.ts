import { processWebhook } from "corsair";
import { type NextRequest, NextResponse } from "next/server";
import { corsair } from "@/server/corsair";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const contentType = request.headers.get("content-type");

  let body: string | Record<string, unknown>;

  if (contentType?.includes("application/json")) {
    body = await request.json();
  } else {
    const text = await request.text();
    body = text?.trim() ? text : {};
  }

  const tenantId =
    url.searchParams.get("tenantId") ||
    url.searchParams.get("tenant_id") ||
    undefined;

  const result = await processWebhook(corsair, headers, body, { tenantId });

  console.log("Plugin Processed:", result.plugin, result.action);

  const responseHeders = result.responseHeaders;
  const nextHeaders = new Headers();
  if (responseHeders) {
    for (const [key, value] of Object.entries(responseHeders)) {
      nextHeaders.set(key, value);
    }
  }

  if (!result.response) {
    return NextResponse.json(
      { success: false, message: "No matching webhook handler found" },
      { status: 404 },
    );
  }

  if (result.response !== undefined) {
    return NextResponse.json(result.response, { headers: nextHeaders });
  }

  return new NextResponse(null, { status: 200, headers: nextHeaders });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
