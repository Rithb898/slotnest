import { tool } from "@openai/agents";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import { extractBody, getHeader, parseAddress, toDate } from "@/lib/gmail";
import { searchMessageEmbeddings } from "@/lib/message-embeddings";
import { corsairReadonly } from "@/server/corsair";
import { db } from "@/server/db";
import {
  corsairAccounts,
  corsairEntities,
  corsairIntegrations,
} from "@/server/db/schema";

/**
 * Read-only agent toolset (plan 011 step 2, ADR 0001).
 *
 * Every tool here is read-only and tenant-scoped through `corsairReadonly`
 * (permission mode `readonly` — writes are denied at the platform layer as a
 * structural backstop). There is deliberately NO send/book tool: outbound
 * actions are emitted by the agent as structured proposals and executed
 * elsewhere through the deterministic mutations after a human approval.
 *
 * Tool results are structured (IDs included) so the chat layer can render a
 * real `email_list` card and later turns can resolve "the second one" by stored
 * Gmail ID rather than re-parsed prose.
 */

export type EmailRef = {
  id: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  date: string | null;
};

type CachedMessageData = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string | number | Date | null;
  payload?: Parameters<typeof extractBody>[0];
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
};

/** Collects the most recent email list a tool produced, for the card render. */
export type ToolCollector = { lastEmailList: EmailRef[] | null };

function normalizeRef(
  message: CachedMessageData,
  fallbackId: string,
): EmailRef {
  const headers = message.payload?.headers;
  const from = parseAddress(getHeader(headers, "From") ?? message.from);
  const date = toDate(message.internalDate);
  return {
    id: message.id ?? fallbackId,
    threadId: message.threadId ?? null,
    fromName: from.name,
    fromEmail: from.email,
    to: getHeader(headers, "To") ?? message.to ?? "",
    subject: getHeader(headers, "Subject") ?? message.subject ?? "(no subject)",
    snippet: message.snippet ?? "",
    date: date ? date.toISOString() : null,
  };
}

function bodyText(message: CachedMessageData): string {
  const body = extractBody(message.payload);
  return (body.text ?? body.html ?? message.body ?? message.snippet ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function keywordSearch(
  tenant: ReturnType<typeof corsairReadonly.withTenant>,
  query: string,
  limit: number,
): Promise<EmailRef[]> {
  const fields = ["subject", "snippet", "body", "from", "to"] as const;
  const rows = await Promise.all(
    fields.map((field) =>
      tenant.gmail.db.messages.search({
        data: { [field]: { contains: query } },
        limit,
      }),
    ),
  );
  const byId = new Map<string, EmailRef>();
  for (const row of rows.flat()) {
    const ref = normalizeRef(row.data, row.entity_id);
    if (!byId.has(ref.id)) byId.set(ref.id, ref);
  }
  return [...byId.values()];
}

async function semanticSearch(
  userId: string,
  query: string,
  limit: number,
): Promise<EmailRef[]> {
  if (!env.OPENAI_API_KEY || !env.QDRANT_URL) return [];
  const hits = await searchMessageEmbeddings({
    tenantId: userId,
    query,
    limit,
  });
  if (hits.length === 0) return [];

  const rows = await db
    .select({
      data: corsairEntities.data,
      gmailMessageId: corsairEntities.entityId,
      entityId: corsairEntities.id,
    })
    .from(corsairEntities)
    .innerJoin(
      corsairAccounts,
      eq(corsairEntities.accountId, corsairAccounts.id),
    )
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(
      and(
        inArray(
          corsairEntities.id,
          hits.map((hit) => hit.entityId),
        ),
        eq(corsairAccounts.tenantId, userId),
        eq(corsairIntegrations.name, "gmail"),
        eq(corsairEntities.entityType, "messages"),
      ),
    );

  const byEntityId = new Map(rows.map((row) => [row.entityId, row]));
  return hits.flatMap((hit) => {
    const row = byEntityId.get(hit.entityId);
    return row
      ? [normalizeRef(row.data as CachedMessageData, row.gmailMessageId)]
      : [];
  });
}

async function searchEmails(
  userId: string,
  query: string,
  limit: number,
): Promise<EmailRef[]> {
  const tenant = corsairReadonly.withTenant(userId);
  const keyword = await keywordSearch(tenant, query, limit);
  let semantic: EmailRef[] = [];
  try {
    semantic = await semanticSearch(userId, query, limit);
  } catch (error) {
    console.warn("Semantic email search failed:", error);
  }

  const byId = new Map<string, EmailRef>();
  for (const ref of [...keyword, ...semantic]) {
    if (!byId.has(ref.id)) byId.set(ref.id, ref);
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0),
    )
    .slice(0, limit);
}

/** Compact, deterministic free-slot inversion (mirrors calendar.availability). */
function computeFreeSlots({
  busy,
  timeMin,
  timeMax,
  minMinutes,
  dayStartHour,
  dayEndHour,
}: {
  busy: { start: number; end: number }[];
  timeMin: string;
  timeMax: string;
  minMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
}): { start: string; end: string }[] {
  busy.sort((a, b) => a.start - b.start);
  const slots: { start: string; end: string }[] = [];
  const rangeStart = new Date(timeMin);
  const rangeEnd = new Date(timeMax);
  const now = Date.now();
  const minMs = minMinutes * 60 * 1000;

  const day = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate(),
  );
  while (day <= rangeEnd) {
    const windowStart = new Date(day);
    windowStart.setHours(dayStartHour, 0, 0, 0);
    const windowEnd = new Date(day);
    windowEnd.setHours(dayEndHour, 0, 0, 0);

    let cursor = Math.max(windowStart.getTime(), rangeStart.getTime(), now);
    const dayEnd = Math.min(windowEnd.getTime(), rangeEnd.getTime());

    for (const b of busy) {
      if (b.end <= cursor || b.start >= dayEnd) continue;
      if (b.start > cursor && b.start - cursor >= minMs) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(b.start).toISOString(),
        });
      }
      cursor = Math.max(cursor, b.end);
    }
    if (dayEnd - cursor >= minMs) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(dayEnd).toISOString(),
      });
    }
    day.setDate(day.getDate() + 1);
  }
  return slots;
}

/**
 * Build the read-only tool array for one tenant. `collector` captures the most
 * recent email list so the chat layer can persist a real `email_list` card.
 */
export function buildAgentTools(userId: string, collector: ToolCollector) {
  const tenant = corsairReadonly.withTenant(userId);
  const weekOut = () =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return [
    tool({
      name: "search_emails",
      description:
        "Search the user's Gmail for messages by sender name/email, subject, or keywords. Returns a numbered list of emails with their Gmail IDs. Use whenever the user wants to find, list, or reference emails.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Search terms: a person's name/email, subject words, or keywords.",
          ),
        limit: z
          .number()
          .min(1)
          .max(15)
          .nullable()
          .describe("Max results (default 8)."),
      }),
      execute: async ({ query, limit }) => {
        const refs = await searchEmails(userId, query, limit ?? 8);
        collector.lastEmailList = refs;
        return {
          count: refs.length,
          emails: refs.map((r, i) => ({
            index: i + 1,
            id: r.id,
            threadId: r.threadId,
            from: r.fromName || r.fromEmail,
            fromEmail: r.fromEmail,
            subject: r.subject,
            snippet: r.snippet,
            date: r.date,
          })),
        };
      },
    }),

    tool({
      name: "get_thread",
      description:
        "Read the full content of an email thread — every message's sender, date, and body — given the Gmail messageId of any email in it (from search_emails). Use to summarize a thread or to gather details (recipient, subject, threading headers) before proposing a reply.",
      parameters: z.object({
        messageId: z
          .string()
          .describe("A Gmail message ID from search_emails."),
      }),
      execute: async ({ messageId }) => {
        const root = (await tenant.gmail.api.messages.get({
          id: messageId,
          format: "full",
        })) as CachedMessageData;
        const threadId = root.threadId;
        if (!threadId) {
          return {
            threadId: null,
            messages: [normalizeMessageForThread(root, messageId)],
            replyTo: replyHeaders(root, messageId),
          };
        }
        const thread = await tenant.gmail.api.threads.get({
          id: threadId,
          format: "full",
        });
        const messages = (thread.messages ?? []).map((m) =>
          normalizeMessageForThread(m as CachedMessageData, m.id ?? messageId),
        );
        // The latest message NOT from the user is the one a reply answers.
        const last = (thread.messages ?? []).at(-1) as
          | CachedMessageData
          | undefined;
        return {
          threadId,
          messages,
          replyTo: replyHeaders(last ?? root, last?.id ?? messageId),
        };
      },
    }),

    tool({
      name: "find_free_slots",
      description:
        "Find the user's open calendar slots (deterministic free/busy math) within a date range and daily working-hours window. Use before proposing a meeting time.",
      parameters: z.object({
        timeMin: z
          .string()
          .nullable()
          .describe("ISO start of range (default now)."),
        timeMax: z
          .string()
          .nullable()
          .describe("ISO end of range (default +7 days)."),
        minMinutes: z
          .number()
          .min(15)
          .max(480)
          .nullable()
          .describe("Minimum slot length (default 30)."),
      }),
      execute: async ({ timeMin, timeMax, minMinutes }) => {
        const min = timeMin ?? new Date().toISOString();
        const max = timeMax ?? weekOut();
        const res = await tenant.googlecalendar.api.calendar.getAvailability({
          timeMin: min,
          timeMax: max,
          items: [{ id: "primary" }],
        });
        const calendars = (res.calendars ?? {}) as Record<
          string,
          { busy?: { start: string; end: string }[] }
        >;
        const busy: { start: number; end: number }[] = [];
        for (const cal of Object.values(calendars)) {
          for (const b of cal.busy ?? []) {
            const s = Date.parse(b.start);
            const e = Date.parse(b.end);
            if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
              busy.push({ start: s, end: e });
            }
          }
        }
        const slots = computeFreeSlots({
          busy,
          timeMin: min,
          timeMax: max,
          minMinutes: minMinutes ?? 30,
          dayStartHour: 9,
          dayEndHour: 17,
        });
        return { slots: slots.slice(0, 20) };
      },
    }),

    tool({
      name: "get_events",
      description:
        "List the user's calendar events in a date range. Use to answer questions about their schedule.",
      parameters: z.object({
        timeMin: z.string().nullable().describe("ISO start (default now)."),
        timeMax: z.string().nullable().describe("ISO end (default +7 days)."),
      }),
      execute: async ({ timeMin, timeMax }) => {
        const res = await tenant.googlecalendar.api.events.getMany({
          calendarId: "primary",
          timeMin: timeMin ?? new Date().toISOString(),
          timeMax: timeMax ?? weekOut(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });
        const events = (res.items ?? [])
          .filter((e) => e.status !== "cancelled")
          .map((e) => ({
            summary: e.summary ?? "(no title)",
            start: e.start?.dateTime ?? e.start?.date ?? null,
            end: e.end?.dateTime ?? e.end?.date ?? null,
            attendees: (e.attendees ?? [])
              .map((a) => a.email)
              .filter((x): x is string => Boolean(x)),
          }));
        return { events };
      },
    }),

    tool({
      name: "find_follow_ups",
      description:
        "Find emails the user SENT that have not received a reply yet (awaiting a response). Use for 'did they ever reply?' or 'what am I waiting on?'.",
      parameters: z.object({
        limit: z
          .number()
          .min(1)
          .max(15)
          .nullable()
          .describe("Max sent emails to inspect (default 10)."),
      }),
      execute: async ({ limit }) => {
        const refs = await findFollowUps(userId, limit ?? 10);
        collector.lastEmailList = refs;
        return {
          count: refs.length,
          awaitingReply: refs.map((r, i) => ({
            index: i + 1,
            id: r.id,
            threadId: r.threadId,
            to: r.to,
            subject: r.subject,
            snippet: r.snippet,
            sentDate: r.date,
          })),
        };
      },
    }),
  ];
}

function normalizeMessageForThread(
  message: CachedMessageData,
  fallbackId: string,
) {
  const headers = message.payload?.headers;
  const from = parseAddress(getHeader(headers, "From") ?? message.from);
  const date = toDate(message.internalDate);
  return {
    id: message.id ?? fallbackId,
    from: from.name || from.email,
    fromEmail: from.email,
    date: date ? date.toISOString() : null,
    subject: getHeader(headers, "Subject") ?? message.subject ?? "",
    body: bodyText(message).slice(0, 4000),
  };
}

/** The fields a reply proposal needs for deterministic RFC 2822 threading. */
function replyHeaders(message: CachedMessageData, fallbackId: string) {
  const headers = message.payload?.headers;
  const from = parseAddress(getHeader(headers, "From") ?? message.from);
  return {
    to: from.email,
    subject: getHeader(headers, "Subject") ?? message.subject ?? "",
    threadId: message.threadId ?? null,
    messageId: message.id ?? fallbackId,
    inReplyTo: getHeader(headers, "Message-ID") ?? null,
    references: getHeader(headers, "References") ?? null,
  };
}

/**
 * Sent emails awaiting a reply: list recent SENT messages, then for each thread
 * check whether anyone replied after the user's last sent message. Deterministic
 * — the "self" address is taken from the sent message's own From header.
 */
async function findFollowUps(
  userId: string,
  limit: number,
): Promise<EmailRef[]> {
  const tenant = corsairReadonly.withTenant(userId);
  const rows = await tenant.gmail.db.messages.list({ limit: 250, offset: 0 });
  const sent = rows
    .map((row) => ({
      ref: normalizeRef(row.data, row.entity_id),
      data: row.data as CachedMessageData,
    }))
    .filter((m) => (m.data.labelIds ?? []).includes("SENT"))
    .sort(
      (a, b) =>
        (b.ref.date ? Date.parse(b.ref.date) : 0) -
        (a.ref.date ? Date.parse(a.ref.date) : 0),
    )
    .slice(0, limit);

  const awaiting: EmailRef[] = [];
  const seenThreads = new Set<string>();
  for (const { ref, data } of sent) {
    const threadId = ref.threadId;
    if (!threadId || seenThreads.has(threadId)) continue;
    seenThreads.add(threadId);

    const selfHeaders = data.payload?.headers;
    const self = parseAddress(
      getHeader(selfHeaders, "From") ?? data.from,
    ).email;
    const sentAt = ref.date ? Date.parse(ref.date) : 0;

    try {
      const thread = await tenant.gmail.api.threads.get({
        id: threadId,
        format: "full",
      });
      const replied = (thread.messages ?? []).some((m) => {
        const md = m as CachedMessageData;
        const fromEmail = parseAddress(
          getHeader(md.payload?.headers, "From") ?? md.from,
        ).email;
        const at = toDate(md.internalDate)?.getTime() ?? 0;
        return fromEmail && fromEmail !== self && at > sentAt;
      });
      if (!replied) awaiting.push(ref);
    } catch (error) {
      console.warn("find_follow_ups thread fetch failed:", error);
    }
  }
  return awaiting;
}
