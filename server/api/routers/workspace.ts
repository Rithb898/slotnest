import { Agent, run } from "@openai/agents";
import { z } from "zod";

import { env } from "@/lib/config/env";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export type DailyBriefResult =
  | { configured: false; brief: string; highlights: string[] }
  | { configured: true; brief: string; highlights: string[] };

const highlightSchema = z.object({
  label: z.string().min(1).max(80),
  detail: z.string().min(1).max(160),
});

const dailyBriefInput = z.object({
  needsReply: z.number().int().min(0).max(50),
  draftCount: z.number().int().min(0).max(50),
  waitingCount: z.number().int().min(0).max(50),
  eventCount: z.number().int().min(0).max(50),
  openSlotCount: z.number().int().min(0).max(50),
  bestSlot: z.string().max(40).nullable(),
  topMessages: z
    .array(
      z.object({
        sender: z.string().min(1).max(120),
        subject: z.string().min(1).max(180),
        reason: z.string().min(1).max(120),
      }),
    )
    .max(5),
  nextEvent: z
    .object({
      summary: z.string().min(1).max(160),
      time: z.string().max(40).nullable(),
    })
    .nullable(),
});

const BRIEF_INSTRUCTIONS = `Write SlotNest daily workspace briefs.

Rules:
- Use only the supplied structured data.
- One short paragraph, 18-35 words.
- Mention the highest-value sender or scheduling opportunity when present.
- Plain text only. No markdown, no greeting, no fake facts.
- The product is draft-then-approve: say "prepared" or "ready", never imply anything was sent or booked.`;

function deterministicBrief(input: z.infer<typeof dailyBriefInput>): string {
  const top = input.topMessages[0];
  if (input.needsReply > 0 && top) {
    const slot = input.bestSlot
      ? ` ${input.bestSlot} is the cleanest slot.`
      : "";
    return `${input.needsReply} ${input.needsReply === 1 ? "email needs" : "emails need"} a decision today. ${top.sender} is first because ${top.reason.toLowerCase()}.${slot} ${input.draftCount} ${input.draftCount === 1 ? "draft is" : "drafts are"} ready for review.`;
  }
  if (input.waitingCount > 0) {
    return `${input.waitingCount} ${input.waitingCount === 1 ? "thread looks" : "threads look"} worth following up. SlotNest prepared the waiting queue so you can nudge, snooze, or mark resolved.`;
  }
  if (input.eventCount > 0) {
    return `Your calendar has ${input.eventCount} ${input.eventCount === 1 ? "event" : "events"} today. SlotNest will keep watching for replies, scheduling requests, and open gaps.`;
  }
  return "Nothing needs approval right now. SlotNest is watching Gmail and Calendar for the next reply, follow-up, or scheduling decision.";
}

function highlights(input: z.infer<typeof dailyBriefInput>) {
  return [
    {
      label: "Decisions",
      detail: `${input.needsReply} ${input.needsReply === 1 ? "email needs" : "emails need"} you`,
    },
    {
      label: "Prepared",
      detail: `${input.draftCount} ${input.draftCount === 1 ? "draft" : "drafts"} waiting for approval`,
    },
    {
      label: "Calendar",
      detail: input.bestSlot
        ? `Best open slot: ${input.bestSlot}`
        : `${input.eventCount} ${input.eventCount === 1 ? "event" : "events"} today`,
    },
  ];
}

function cleanBrief(text: string) {
  return text
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export const workspaceRouter = createTRPCRouter({
  dailyBrief: protectedProcedure
    .input(dailyBriefInput)
    .query(async ({ input }): Promise<DailyBriefResult> => {
      const fallback = deterministicBrief(input);
      if (!env.OPENAI_API_KEY) {
        return {
          configured: false,
          brief: fallback,
          highlights: highlights(input).map((h) => `${h.label}: ${h.detail}`),
        };
      }

      const agent = new Agent({
        name: "slotnest-daily-brief",
        model: "gpt-4.1-mini",
        instructions: BRIEF_INSTRUCTIONS,
      });

      const result = await run(
        agent,
        `Daily workspace data:\n${JSON.stringify(input, null, 2)}\n\nWrite the brief.`,
      );
      const brief = cleanBrief(result.finalOutput ?? "") || fallback;
      return {
        configured: true,
        brief,
        highlights: highlightSchema
          .array()
          .parse(highlights(input))
          .map((h) => `${h.label}: ${h.detail}`),
      };
    }),
});
