import { z } from "zod";

import {
  extractBody,
  type GmailPayload,
  getHeader,
  parseAddress,
  toDate,
} from "@/lib/gmail";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";

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
          return {
            id: msg.id ?? id,
            threadId: msg.threadId ?? null,
            fromName: from.name,
            fromEmail: from.email,
            subject: getHeader(headers, "Subject") ?? "(no subject)",
            snippet: msg.snippet ?? "",
            date: toDate(msg.internalDate),
            unread: (msg.labelIds ?? []).includes("UNREAD"),
          };
        }),
      );

      return {
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
