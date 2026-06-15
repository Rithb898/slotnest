import { createHash } from "node:crypto";
import { Agent, run } from "@openai/agents";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import { DAILY_BRIEF_INSTRUCTIONS } from "@/lib/prompts";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { dailyBrief as dailyBriefTable } from "@/server/db/schema";

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

/** Model used for briefs — stored per row so a model/prompt bump invalidates. */
const BRIEF_MODEL = "gpt-4.1-mini";

/**
 * Hash only the fields whose change should justify a fresh paragraph. Counts
 * jittering elsewhere (open slots, etc.) won't invalidate the cached brief.
 */
function briefSignature(input: z.infer<typeof dailyBriefInput>): string {
  const reduced = {
    needsReply: input.needsReply,
    waitingCount: input.waitingCount,
    eventCount: input.eventCount,
    bestSlot: input.bestSlot,
    topSubject: input.topMessages[0]?.subject ?? null,
  };
  return createHash("sha256").update(JSON.stringify(reduced)).digest("hex");
}

export const workspaceRouter = createTRPCRouter({
  dailyBrief: protectedProcedure
    .input(dailyBriefInput)
    .query(async ({ ctx, input }): Promise<DailyBriefResult> => {
      const briefHighlights = highlightSchema
        .array()
        .parse(highlights(input))
        .map((h) => `${h.label}: ${h.detail}`);
      const fallback = deterministicBrief(input);

      if (!env.OPENAI_API_KEY) {
        // Don't persist the deterministic fallback — a real brief replaces it
        // once the key is set.
        return {
          configured: false,
          brief: fallback,
          highlights: briefHighlights,
        };
      }

      const userId = ctx.session.user.id;
      const date = new Date().toISOString().slice(0, 10);
      const id = `${userId}:${date}`;
      const signature = briefSignature(input);

      // Read-through: reuse today's brief while its shape + model still match.
      const [cached] = await db
        .select({
          brief: dailyBriefTable.brief,
          signature: dailyBriefTable.signature,
          model: dailyBriefTable.model,
        })
        .from(dailyBriefTable)
        .where(eq(dailyBriefTable.id, id))
        .limit(1);
      if (
        cached &&
        cached.signature === signature &&
        cached.model === BRIEF_MODEL
      ) {
        return {
          configured: true,
          brief: cached.brief,
          highlights: briefHighlights,
        };
      }

      const agent = new Agent({
        name: "slotnest-daily-brief",
        model: BRIEF_MODEL,
        instructions: DAILY_BRIEF_INSTRUCTIONS,
      });

      const result = await run(
        agent,
        `Daily workspace data:\n${JSON.stringify(input, null, 2)}\n\nWrite the brief.`,
      );
      const brief = cleanBrief(result.finalOutput ?? "") || fallback;

      await db
        .insert(dailyBriefTable)
        .values({ id, userId, date, signature, model: BRIEF_MODEL, brief })
        .onConflictDoUpdate({
          target: dailyBriefTable.id,
          set: { signature, model: BRIEF_MODEL, brief, updatedAt: new Date() },
        });

      return { configured: true, brief, highlights: briefHighlights };
    }),
});
