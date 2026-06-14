import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  extractBody,
  type GmailPayload,
  getHeader,
  parseAddress,
  toDate,
} from "@/lib/gmail";
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
        date: toDate(msg.internalDate),
        snippet: msg.snippet ?? "",
        html: body.html ?? null,
        text: body.text ?? null,
      };
    }),
});
