import { Agent, run } from "@openai/agents";
import { z } from "zod";

import { env } from "@/lib/config/env";
import { type Triage, type TriageInput, triage } from "@/lib/triage";

export const TRIAGE_LLM_MODEL = "gpt-4.1-mini";
export const TRIAGE_FALLBACK_MODEL = "heuristic";

const triageOutputSchema = z.object({
  action: z.enum(["Needs reply", "FYI", "Ignore"]),
  urgency: z.enum(["Urgent", "Normal", "Low"]),
});

export type TriageClassification = {
  triage: Triage;
  model: typeof TRIAGE_LLM_MODEL | typeof TRIAGE_FALLBACK_MODEL;
};

export type TriageLlmInput = TriageInput & {
  body?: string | null;
};

const TRIAGE_INSTRUCTIONS = `Classify one email for SlotNest.

Return exactly one JSON object and no other text:
{"action":"Needs reply|FYI|Ignore","urgency":"Urgent|Normal|Low"}

Action labels:
- Needs reply: the user likely needs to respond, decide, approve, schedule, review, or answer a direct question.
- FYI: useful information, status, confirmation, or context that does not require a reply.
- Ignore: promotions, newsletters, receipts, automated notices, social/forum updates, spam, or bulk mail.

Urgency labels:
- Urgent: time-sensitive, same-day, deadline, blocker, escalation, or important unread work.
- Normal: actionable or useful, but not time-critical.
- Low: bulk, ignorable, stale, or low-value information.

Rules:
- Use only the supplied email fields.
- Do not invent facts.
- Prefer Ignore + Low for bulk/promotional mail.
- Prefer Needs reply when the sender asks the user a direct question or requests confirmation.`;

function cleanModelOutput(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseTriageOutput(text: string): Triage | null {
  try {
    return triageOutputSchema.parse(JSON.parse(cleanModelOutput(text)));
  } catch {
    return null;
  }
}

function compactText(
  value: string | null | undefined,
  maxLength: number,
): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function fallback(input: TriageLlmInput): TriageClassification {
  return { triage: triage(input), model: TRIAGE_FALLBACK_MODEL };
}

export async function classifyTriage(
  input: TriageLlmInput,
): Promise<TriageClassification> {
  if (!env.OPENAI_API_KEY) {
    return fallback(input);
  }

  try {
    const agent = new Agent({
      name: "slotnest-triage",
      model: TRIAGE_LLM_MODEL,
      instructions: TRIAGE_INSTRUCTIONS,
    });

    const result = await run(
      agent,
      JSON.stringify({
        subject: compactText(input.subject, 300),
        snippet: compactText(input.snippet, 600),
        body: compactText(input.body, 2500),
        fromEmail: input.fromEmail,
        unread: input.unread,
        date: input.date ? new Date(input.date).toISOString() : null,
        labelIds: input.labelIds ?? [],
        listUnsubscribe: Boolean(input.listUnsubscribe),
      }),
    );
    const parsed = parseTriageOutput(result.finalOutput ?? "");
    if (!parsed) {
      return fallback(input);
    }
    return { triage: parsed, model: TRIAGE_LLM_MODEL };
  } catch {
    return fallback(input);
  }
}
