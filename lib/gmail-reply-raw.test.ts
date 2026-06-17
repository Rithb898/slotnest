import { strict as assert } from "node:assert";

import { buildRfc2822ReplyRaw } from "./gmail-reply-raw";

function decodeBase64Url(raw: string): string {
  const padded = raw.padEnd(raw.length + ((4 - (raw.length % 4)) % 4), "=");
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf-8");
}

const raw = buildRfc2822ReplyRaw({
  to: "sam@example.com",
  subject: "Re: Project update",
  body: "Sounds good.\nI'll review today.",
  inReplyTo: "<original@example.com>",
  references: "<first@example.com> <original@example.com>",
});

assert(!raw.includes("+"));
assert(!raw.includes("/"));
assert(!raw.endsWith("="));

assert.equal(
  decodeBase64Url(raw),
  [
    "To: sam@example.com",
    "Subject: Re: Project update",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "In-Reply-To: <original@example.com>",
    "References: <first@example.com> <original@example.com>",
    "",
    "Sounds good.\r\nI'll review today.",
  ].join("\r\n"),
);

const injected = decodeBase64Url(
  buildRfc2822ReplyRaw({
    to: "sam@example.com\r\nBcc: leak@example.com",
    subject: "Hi\nInjected: nope",
    body: "Body keeps user newlines.",
  }),
);

assert(injected.includes("To: sam@example.com Bcc: leak@example.com"));
assert(injected.includes("Subject: Hi Injected: nope"));
assert(injected.endsWith("Body keeps user newlines."));
