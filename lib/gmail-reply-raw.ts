type ReplyMessageInput = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
};

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeBody(value: string): string {
  return value.replace(/\r\n|\r|\n/g, "\r\n");
}

export function buildRfc2822ReplyRaw(input: ReplyMessageInput): string {
  const headers = [
    ["To", input.to],
    ["Subject", input.subject],
    ["MIME-Version", "1.0"],
    ["Content-Type", 'text/plain; charset="UTF-8"'],
    ["Content-Transfer-Encoding", "8bit"],
  ];

  if (input.inReplyTo) {
    headers.push(["In-Reply-To", input.inReplyTo]);
  }

  if (input.references) {
    headers.push(["References", input.references]);
  }

  const message = [
    ...headers.map(([name, value]) => `${name}: ${sanitizeHeaderValue(value)}`),
    "",
    normalizeBody(input.body),
  ].join("\r\n");

  return base64Url(message);
}
