import { tool } from "@openai/agents";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import {
  type GmailPayload,
  extractBody,
  getHeader,
  parseAddress,
  toDate,
} from "@/lib/gmail";
import { searchMessageEmbeddings } from "@/lib/message-embeddings";
import { isWaitingMessage, waitingDuration } from "@/lib/workspace";
import { corsairReadonly } from "@/server/corsair";
import { db } from "@/server/db";
import {
  corsairAccounts,
  corsairEntities,
  corsairIntegrations,
  replyDraft,
} from "@/server/db/schema";

type CachedGmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string | number | Date | null;
  payload?: GmailPayload;
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
};

type EmailRef = {
  id: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  date: string | null;
};

type ThreadMessage = EmailRef & {
  messageIdHeader: string | null;
  references: string | null;
  labelIds: string[];
  body: string;
};

type CalendarEventLike = {
  id?: string;
  status?: "tentative" | "confirmed" | "cancelled";
  htmlLink?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: { email?: string }[];
  calendarId?: string;
};

type NormalizedCalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
  attendees: string[];
  status: "tentative" | "confirmed" | "cancelled" | null;
  calendarId: string | null;
};

function normalizeGmailMessage(
  message: CachedGmailMessage,
  fallbackId: string,
): ThreadMessage {
  const headers = message.payload?.headers;
  const from = parseAddress(getHeader(headers, "From") ?? message.from);
  const body = extractBody(message.payload);
  const subject =
    getHeader(headers, "Subject") ?? message.subject ?? "(no subject)";
  const snippet = message.snippet ?? "";
  const labelIds = message.labelIds ?? [];
  const date = toDate(message.internalDate);
  const sourceText =
    body.text?.trim() || message.body?.trim() || body.html?.trim() || snippet;

  return {
    id: message.id ?? fallbackId,
    threadId: message.threadId ?? null,
    fromName: from.name,
    fromEmail: from.email,
    to: getHeader(headers, "To") ?? message.to ?? "",
    subject,
    snippet,
    date: date ? date.toISOString() : null,
    messageIdHeader: getHeader(headers, "Message-ID") ?? null,
    references: getHeader(headers, "References") ?? null,
    labelIds,
    body: sourceText,
  };
}

function toEmailRef(message: ThreadMessage): EmailRef {
  return {
    id: message.id,
    threadId: message.threadId,
    fromName: message.fromName,
    fromEmail: message.fromEmail,
    to: message.to,
    subject: message.subject,
    snippet: message.snippet,
    date: message.date,
  };
}

async function hasIntegration(userId: string, name: string): Promise<boolean> {
  const rows = await db
    .select({ name: corsairIntegrations.name })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(eq(corsairAccounts.tenantId, userId));
  return rows.some((row) => row.name === name);
}

async function searchEmailRows({
  userId,
  query,
  limit,
}: {
  userId: string;
  query: string;
  limit: number;
}): Promise<ThreadMessage[]> {
  const tenant = corsairReadonly.withTenant(userId);

  const fields = ["subject", "snippet", "body", "from", "to"] as const;
  const rows = await Promise.all(
    fields.map((field) =>
      tenant.gmail.db.messages.search({
        data: { [field]: { contains: query } },
        limit,
      }),
    ),
  );

  const byId = new Map<string, ThreadMessage>();
  for (const row of rows.flat()) {
    const message = normalizeGmailMessage(
      row.data as CachedGmailMessage,
      row.entity_id,
    );
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }

  if (env.OPENAI_API_KEY && env.QDRANT_URL) {
    try {
      const hits = await searchMessageEmbeddings({
        tenantId: userId,
        query,
        limit,
      });
      if (hits.length > 0) {
        const entities = await db
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

        const rowsByEntityId = new Map(
          entities.map((row) => [row.entityId, row]),
        );
        for (const hit of hits) {
          const row = rowsByEntityId.get(hit.entityId);
          if (!row) continue;
          const message = normalizeGmailMessage(
            row.data as CachedGmailMessage,
            row.gmailMessageId,
          );
          if (!byId.has(message.id)) {
            byId.set(message.id, message);
          }
        }
      }
    } catch (error) {
      console.warn("Semantic chat search failed:", error);
    }
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        (b.date ? new Date(b.date).getTime() : 0) -
        (a.date ? new Date(a.date).getTime() : 0),
    )
    .slice(0, limit);
}

async function getThreadMessages(
  userId: string,
  input: {
    threadId?: string;
    messageId?: string;
  },
): Promise<{ threadId: string | null; messages: ThreadMessage[] }> {
  const tenant = corsairReadonly.withTenant(userId);
  const messageId = input.messageId ?? null;
  let threadId = input.threadId ?? null;

  if (!threadId && messageId) {
    const message = (await tenant.gmail.api.messages.get({
      id: messageId,
      format: "full",
    })) as CachedGmailMessage;
    threadId = message.threadId ?? null;
  }

  if (!threadId) return { threadId: null, messages: [] };

  const thread = (await tenant.gmail.api.threads.get({
    id: threadId,
    format: "full",
  })) as {
    id?: string;
    messages?: CachedGmailMessage[];
  };

  return {
    threadId: thread.id ?? threadId,
    messages: (thread.messages ?? []).map((message, index) =>
      normalizeGmailMessage(message, message.id ?? `${threadId}:${index}`),
    ),
  };
}

async function getCalendarEvents({
  userId,
  timeMin,
  timeMax,
  timeZone,
  maxResults,
}: {
  userId: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  maxResults: number;
}) {
  const tenant = corsairReadonly.withTenant(userId);
  const cached = await tenant.googlecalendar.db.events.list({
    limit: Math.max(250, maxResults),
    offset: 0,
  });

  const toNormalizedEvent = (
    event: CalendarEventLike,
    fallbackId: string,
  ): NormalizedCalendarEvent => ({
    id: event.id ?? fallbackId,
    summary: event.summary ?? "(no title)",
    start: event.start?.dateTime ?? event.start?.date ?? null,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    location: event.location ?? null,
    htmlLink: event.htmlLink ?? null,
    attendees: (event.attendees ?? [])
      .map((attendee) => attendee.email)
      .filter((email): email is string => Boolean(email)),
    status: event.status ?? null,
    calendarId: event.calendarId ?? null,
  });

  const matchesRange = (event: NormalizedCalendarEvent) => {
    const rangeStart = new Date(timeMin).getTime();
    const rangeEnd = new Date(timeMax).getTime();
    const start = event.start ? new Date(event.start).getTime() : Number.NaN;
    const end = event.end ? new Date(event.end).getTime() : start;
    if (!Number.isFinite(start)) return false;
    return (
      start < rangeEnd && (Number.isFinite(end) ? end : start) >= rangeStart
    );
  };

  const normalizedCached = cached
    .map((row) =>
      toNormalizedEvent(row.data as CalendarEventLike, row.entity_id),
    )
    .filter((event) => event.status !== "cancelled")
    .filter((event) => !event.calendarId || event.calendarId === "primary")
    .filter(matchesRange)
    .sort(
      (a, b) =>
        new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime(),
    )
    .slice(0, maxResults);

  if (normalizedCached.length > 0) {
    return normalizedCached;
  }

  const live = await tenant.googlecalendar.api.events.getMany({
    calendarId: "primary",
    timeMin,
    timeMax,
    timeZone,
    singleEvents: true,
    orderBy: "startTime",
    maxResults,
  });

  return (live.items ?? [])
    .filter((event) => event.status !== "cancelled")
    .map((event) => toNormalizedEvent(event, event.id ?? ""))
    .slice(0, maxResults);
}

async function getFreeSlots({
  userId,
  timeMin,
  timeMax,
  timeZone,
  minMinutes,
  dayStartHour,
  dayEndHour,
}: {
  userId: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  minMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
}) {
  const tenant = corsairReadonly.withTenant(userId);
  const res = await tenant.googlecalendar.api.calendar.getAvailability({
    timeMin,
    timeMax,
    timeZone,
    items: [{ id: "primary" }],
  });

  const calendars = (res.calendars ?? {}) as Record<
    string,
    { busy?: { start: string; end: string }[] }
  >;
  const busy: { start: number; end: number }[] = [];
  for (const cal of Object.values(calendars)) {
    for (const interval of cal.busy ?? []) {
      const start = new Date(interval.start).getTime();
      const end = new Date(interval.end).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        busy.push({ start, end });
      }
    }
  }
  busy.sort((a, b) => a.start - b.start);

  const slots: { start: string; end: string }[] = [];
  const rangeStart = new Date(timeMin);
  const rangeEnd = new Date(timeMax);
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

    let cursor = Math.max(windowStart.getTime(), rangeStart.getTime());
    const dayBusy = busy.filter(
      (interval) =>
        interval.start < windowEnd.getTime() &&
        interval.end > windowStart.getTime(),
    );

    for (const interval of dayBusy) {
      const gapEnd = Math.min(interval.start, windowEnd.getTime());
      if (gapEnd - cursor >= minMs) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(gapEnd).toISOString(),
        });
      }
      cursor = Math.max(cursor, interval.end);
    }

    if (windowEnd.getTime() - cursor >= minMs) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(
          Math.min(windowEnd.getTime(), rangeEnd.getTime()),
        ).toISOString(),
      });
    }

    day.setDate(day.getDate() + 1);
  }

  return slots.filter(
    (slot) => new Date(slot.end).getTime() > new Date(slot.start).getTime(),
  );
}

async function findFollowUpCandidates(userId: string, limit: number) {
  const tenant = corsairReadonly.withTenant(userId);
  const cues = [
    "follow up",
    "following up",
    "waiting",
    "checking in",
    "reminder",
    "any update",
    "circle back",
  ];
  const rows = await Promise.all(
    cues.flatMap((cue) =>
      ["subject", "snippet", "body", "from", "to"].map((field) =>
        tenant.gmail.db.messages.search({
          data: { [field]: { contains: cue } },
          limit: Math.max(10, limit),
        }),
      ),
    ),
  );

  const draftRows = await db
    .select({
      messageId: replyDraft.messageId,
      status: replyDraft.status,
      body: replyDraft.body,
    })
    .from(replyDraft)
    .where(eq(replyDraft.userId, userId));
  const draftsByMessageId = new Map(
    draftRows.map((row) => [row.messageId, row]),
  );

  const candidates = rows
    .flat()
    .map((row) =>
      normalizeGmailMessage(row.data as CachedGmailMessage, row.entity_id),
    )
    .map((message) => {
      const replyStatus = draftsByMessageId.get(message.id)?.status ?? null;
      const waiting = isWaitingMessage({
        subject: message.subject,
        snippet: message.snippet,
        triage: { action: "FYI", urgency: "Normal" },
      });
      return {
        ...toEmailRef(message),
        waiting,
        waitingDuration: waitingDuration(message.date),
        replyStatus,
      };
    })
    .filter((item) => item.waiting)
    .filter(
      (item, index, array) =>
        array.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .slice(0, limit);

  return candidates;
}

export function createChatAgentTools(userId: string) {
  return [
    tool({
      name: "searchEmails",
      description:
        "Search Gmail by subject, snippet, body, sender, or recipient and return real email IDs the user can pick from later.",
      parameters: z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(10).optional(),
      }),
      async execute({ query, limit }) {
        const emails = await searchEmailRows({
          userId,
          query,
          limit: limit ?? 6,
        });
        return {
          emails: emails.map(toEmailRef),
        };
      },
    }),
    tool({
      name: "getThread",
      description:
        "Load a Gmail thread by thread ID, or by message ID when only a message is known.",
      parameters: z.object({
        threadId: z.string().optional(),
        messageId: z.string().optional(),
      }),
      async execute(input) {
        const thread = await getThreadMessages(userId, input);
        return {
          threadId: thread.threadId,
          messages: thread.messages.map(toEmailRef),
        };
      },
    }),
    tool({
      name: "findFreeSlots",
      description:
        "Find available calendar slots in the user's primary calendar over a date range.",
      parameters: z.object({
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        timeZone: z.string().optional(),
        minMinutes: z.number().min(5).max(480).optional(),
        dayStartHour: z.number().min(0).max(23).optional(),
        dayEndHour: z.number().min(1).max(24).optional(),
      }),
      async execute(input) {
        if (!(await hasIntegration(userId, "googlecalendar"))) {
          return {
            connected: false,
            slots: [] as { start: string; end: string }[],
          };
        }
        const now = new Date();
        const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return {
          connected: true,
          slots: await getFreeSlots({
            userId,
            timeMin: input.timeMin ?? now.toISOString(),
            timeMax: input.timeMax ?? weekOut.toISOString(),
            timeZone: input.timeZone,
            minMinutes: input.minMinutes ?? 30,
            dayStartHour: input.dayStartHour ?? 9,
            dayEndHour: input.dayEndHour ?? 17,
          }),
        };
      },
    }),
    tool({
      name: "getEvents",
      description:
        "Load calendar events in a date range so the agent can summarize the user's schedule.",
      parameters: z.object({
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        timeZone: z.string().optional(),
        maxResults: z.number().min(1).max(50).optional(),
      }),
      async execute(input) {
        if (!(await hasIntegration(userId, "googlecalendar"))) {
          return {
            connected: false,
            events: [] as Awaited<ReturnType<typeof getCalendarEvents>>,
          };
        }
        const now = new Date();
        const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return {
          connected: true,
          events: await getCalendarEvents({
            userId,
            timeMin: input.timeMin ?? now.toISOString(),
            timeMax: input.timeMax ?? weekOut.toISOString(),
            timeZone: input.timeZone,
            maxResults: input.maxResults ?? 25,
          }),
        };
      },
    }),
    tool({
      name: "findFollowUps",
      description:
        "Find threads that look like they still need a reply, or inspect a specific thread for whether the other person has replied.",
      parameters: z.object({
        threadId: z.string().optional(),
        messageId: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().min(1).max(10).optional(),
      }),
      async execute(input) {
        if (input.threadId || input.messageId) {
          const thread = await getThreadMessages(userId, input);
          let lastSentIndex = -1;
          thread.messages.forEach((message, index) => {
            if (message.labelIds.includes("SENT")) {
              lastSentIndex = index;
            }
          });
          const hasReply =
            lastSentIndex >= 0 &&
            thread.messages
              .slice(lastSentIndex + 1)
              .some((message) => !message.labelIds.includes("SENT"));
          return {
            connected: true,
            threadId: thread.threadId,
            hasReply,
            messages: thread.messages.map((message) => ({
              ...toEmailRef(message),
              labelIds: message.labelIds,
            })),
          };
        }

        const limit = input.limit ?? 5;
        const query = input.query?.trim();
        if (query) {
          const emails = await searchEmailRows({
            userId,
            query,
            limit,
          });
          return {
            connected: true,
            followUps: emails
              .map((message) => {
                const replyStatus = null;
                const waiting = isWaitingMessage({
                  subject: message.subject,
                  snippet: message.snippet,
                  triage: { action: "FYI", urgency: "Normal" },
                });
                return {
                  ...toEmailRef(message),
                  waiting,
                  waitingDuration: waitingDuration(message.date),
                };
              })
              .filter((message) => message.waiting)
              .slice(0, limit),
          };
        }

        const candidates = await findFollowUpCandidates(userId, limit);
        return { connected: true, followUps: candidates };
      },
    }),
  ];
}
