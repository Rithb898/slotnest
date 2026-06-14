export function cleanReplySubject(
  subject: string,
  fallback = "(no subject)",
): string {
  return subject.replace(/^(\s*(re|fw|fwd):\s*)+/i, "").trim() || fallback;
}

export function toReplySubject(subject: string): string {
  return `Re: ${cleanReplySubject(subject)}`;
}

export function toReplyReferences(
  references?: string | null,
  messageIdHeader?: string | null,
): string | null {
  return [references, messageIdHeader].filter(Boolean).join(" ").trim() || null;
}
