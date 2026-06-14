import { Agent, run } from "@openai/agents";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import {
  extractBody,
  type GmailPayload,
  getHeader,
  parseAddress,
  toDate,
} from "@/lib/gmail";
import { buildRfc2822ReplyRaw } from "@/lib/gmail-reply-raw";
import { triage } from "@/lib/triage";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { db } from "@/server/db";
import { corsairAccounts, corsairIntegrations } from "@/server/db/schema";

/**
 * Returns true if the signed-in tenant has a gmail account. Mirrors
 * `isCalendarConnected` in `server/api/routers/calendar.ts` — checking Corsair's
 * own account tables (same source as `connections.list`) so the read procedures
 * can degrade gracefully instead of letting the Corsair API call throw.
 */
async function isGmailConnected(userId: string): Promise<boolean> {
  const rows = await db
    .select({ name: corsairIntegrations.name })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(eq(corsairAccounts.tenantId, userId));
  return rows.some((r) => r.name === "gmail");
}

type DraftReplyResult =
  | { configured: false; text: string }
  | { configured: true; text: string };

const DRAFT_REPLY_INSTRUCTIONS = `You write concise plain-text email replies for SlotNest.

Rules:
- Draft only the reply body. Do not include a subject line, greeting labels, markdown, or code fences.
- Be neutral, professional, and specific to the message.
- Keep it short: 2-5 sentences unless the email clearly needs less.
- Do not invent commitments, dates, attachments, or facts not present in the email.
- If the message asks for scheduling and no availability is provided, ask for a suitable time or say you will coordinate timing.
- The user will review and edit before sending.`;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanDraftText(text: string): string {
  return text
    .replace(/^```(?:text|plain)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export const gmailRouter = createTRPCRouter({
  /**
   * Lists INBOX messages with the metadata needed for a list row (from,
   * subject, date, snippet, unread). Gmail's list endpoint returns only ids, so
   * we fan out `messages.get` per id.
   *
   * NOTE: we request `format: "full"`, not `metadata`. Corsair's `metadata`
   * format drops `payload.headers` entirely (verified against the live API), so
   * From/Subject/Date are only readable via `full`. Heavier, but correct.
   */
  inbox: protectedProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          maxResults: z.number().min(1).max(50).optional(),
          pageToken: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!(await isGmailConnected(ctx.session.user.id))) {
        return {
          connected: false as const,
          messages: [],
          nextPageToken: null,
        };
      }

      const tenant = corsair.withTenant(ctx.session.user.id);

      const list = await tenant.gmail.api.messages.list({
        labelIds: ["INBOX"],
        maxResults: input?.maxResults ?? 25,
        q: input?.q,
        pageToken: input?.pageToken,
      });

      const ids = (list.messages ?? [])
        .map((m) => m.id)
        .filter((id): id is string => Boolean(id));

      const messages = await Promise.all(
        ids.map(async (id) => {
          const msg = await tenant.gmail.api.messages.get({
            id,
            format: "full",
          });
          const headers = msg.payload?.headers;
          const from = parseAddress(getHeader(headers, "From"));
          const subject = getHeader(headers, "Subject") ?? "(no subject)";
          const messageIdHeader = getHeader(headers, "Message-ID") ?? null;
          const references = getHeader(headers, "References") ?? null;
          const snippet = msg.snippet ?? "";
          const date = toDate(msg.internalDate);
          const unread = (msg.labelIds ?? []).includes("UNREAD");
          // Heuristic triage (no LLM) — see lib/triage.ts. Computed per-request;
          // cheap enough that a local cache isn't warranted yet.
          const labels = triage({
            subject,
            snippet,
            fromEmail: from.email,
            unread,
            date,
          });
          return {
            id: msg.id ?? id,
            threadId: msg.threadId ?? null,
            fromName: from.name,
            fromEmail: from.email,
            subject,
            messageIdHeader,
            references,
            snippet,
            date,
            unread,
            triage: labels,
          };
        }),
      );

      return {
        connected: true as const,
        messages,
        nextPageToken: list.nextPageToken ?? null,
      };
    }),

  /**
   * Full message for the reading pane: headers + decoded body (html preferred,
   * plain-text fallback).
   */
  message: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenant = corsair.withTenant(ctx.session.user.id);

      const msg = await tenant.gmail.api.messages.get({
        id: input.id,
        format: "full",
      });

      const headers = msg.payload?.headers;
      const from = parseAddress(getHeader(headers, "From"));
      const body = extractBody(msg.payload as GmailPayload | undefined);

      return {
        id: msg.id ?? input.id,
        threadId: msg.threadId ?? null,
        fromName: from.name,
        fromEmail: from.email,
        to: getHeader(headers, "To") ?? "",
        subject: getHeader(headers, "Subject") ?? "(no subject)",
        messageIdHeader: getHeader(headers, "Message-ID") ?? null,
        references: getHeader(headers, "References") ?? null,
        date: toDate(msg.internalDate),
        snippet: msg.snippet ?? "",
        html: body.html ?? null,
        text: body.text ?? null,
      };
    }),

  /**
   * Send a plain-text reply in the existing Gmail thread. The raw message is
   * built locally as RFC 2822 and sent only after the user's explicit approval.
   */
  sendReply: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().min(1),
        inReplyTo: z.string().optional(),
        references: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = corsair.withTenant(ctx.session.user.id);
      const sent = await tenant.gmail.api.messages.send({
        raw: buildRfc2822ReplyRaw({
          to: input.to,
          subject: input.subject,
          body: input.body,
          inReplyTo: input.inReplyTo,
          references: input.references,
        }),
        threadId: input.threadId,
      });

      return {
        id: sent.id ?? null,
        threadId: sent.threadId ?? input.threadId,
      };
    }),

  /**
   * Generate an editable plain-text reply body for one Gmail message. This is
   * intentionally read-only: the model never sends mail; it only fills the body
   * that `sendReply` later sends after the user's explicit approval.
   */
  draftReply: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }): Promise<DraftReplyResult> => {
      if (!env.OPENAI_API_KEY) {
        return {
          configured: false,
          text: "Draft reply is not configured (set OPENAI_API_KEY).",
        };
      }

      const tenant = corsair.withTenant(ctx.session.user.id);
      const msg = await tenant.gmail.api.messages.get({
        id: input.messageId,
        format: "full",
      });

      const headers = msg.payload?.headers;
      const from = parseAddress(getHeader(headers, "From"));
      const subject = getHeader(headers, "Subject") ?? "(no subject)";
      const body = extractBody(msg.payload as GmailPayload | undefined);
      const sourceText =
        body.text?.trim() ||
        (body.html ? stripHtml(body.html) : "") ||
        msg.snippet ||
        "";

      const agent = new Agent({
        name: "slotnest-draft-reply",
        model: "gpt-4.1-mini",
        instructions: DRAFT_REPLY_INSTRUCTIONS,
      });

      const prompt = `Original email:
From: ${from.name || from.email} <${from.email}>
Subject: ${subject}

${sourceText.slice(0, 8000)}

Write the reply body now.`;

      const result = await run(agent, prompt);
      return {
        configured: true,
        text: cleanDraftText(result.finalOutput ?? ""),
      };
    }),
});
