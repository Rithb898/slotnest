/**
 * Helpers for turning raw Gmail message payloads (from `gmail.api.messages.get`)
 * into the normalized shape the UI consumes. Gmail returns headers as a flat
 * list and bodies as base64url-encoded MIME parts.
 */

type Header = { name?: string; value?: string };

type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: Header[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};

export type GmailPayload = GmailPart;

export function getHeader(
  headers: Header[] | undefined,
  name: string,
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
    ?.value;
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf-8");
}

/**
 * Walks the MIME tree and returns the best body representation: prefers
 * `text/html`, falls back to `text/plain`. Returns `{ html?, text? }`.
 */
export function extractBody(payload: GmailPayload | undefined): {
  html?: string;
  text?: string;
} {
  if (!payload) return {};
  let html: string | undefined;
  let text: string | undefined;

  const walk = (part: GmailPart) => {
    const mime = part.mimeType ?? "";
    const data = part.body?.data;
    if (data && !part.filename) {
      if (mime === "text/html" && html === undefined) {
        html = decodeBase64Url(data);
      } else if (mime === "text/plain" && text === undefined) {
        text = decodeBase64Url(data);
      }
    }
    part.parts?.forEach(walk);
  };

  walk(payload);
  return { html, text };
}

/**
 * "Jane Doe <jane@x.com>" -> { name: "Jane Doe", email: "jane@x.com" }.
 * Falls back to the raw string as both fields when it can't be parsed.
 */
export function parseAddress(raw: string | undefined): {
  name: string;
  email: string;
} {
  if (!raw) return { name: "", email: "" };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || match[2].trim(), email: match[2].trim() };
  }
  return { name: raw.trim(), email: raw.trim() };
}

export function toDate(
  internalDate: string | number | Date | null | undefined,
): Date | null {
  if (internalDate == null) return null;
  if (internalDate instanceof Date) return internalDate;
  const ms =
    typeof internalDate === "string" ? Number(internalDate) : internalDate;
  return Number.isFinite(ms) ? new Date(ms) : null;
}
