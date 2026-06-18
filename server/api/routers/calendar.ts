import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { shouldUseCachedCalendarEvents } from "@/lib/calendar-freshness";
import { buildAvailabilitySlots } from "@/lib/calendar-availability";
import { corsair } from "@/server/corsair";
import { db } from "@/server/db";
import { corsairAccounts, corsairIntegrations } from "@/server/db/schema";

/**
 * Calendar router — real Google Calendar data through Corsair (plan 003 step 5).
 *
 * Every call is tenant-scoped via `corsair.withTenant(ctx.session.user.id)`
 * (mirrors `server/api/routers/gmail.ts`). Read ops: `events.getMany` and
 * `calendar.getAvailability`. Write op: `events.create` (= send-invite), which
 * the UI gates behind an explicit user "Send" (draft-then-approve) — the server
 * never books anything on its own.
 *
 * "No calendar connected" degrades gracefully: rather than letting the Corsair
 * call throw, the read procedures first check Corsair's own account tables
 * (same source as `connections.list`) and return `{ connected: false }`.
 */

type CachedCalendarEvent = {
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

type CachedCalendarRow = {
  entity_id: string;
  createdAt?: string | Date | null;
  data: CachedCalendarEvent;
};

/** Returns true if the signed-in tenant has a googlecalendar account. */
async function isCalendarConnected(userId: string): Promise<boolean> {
  const rows = await db
    .select({ name: corsairIntegrations.name })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(eq(corsairAccounts.tenantId, userId));
  return rows.some((r) => r.name === "googlecalendar");
}

function normalizeCalendarEvent(
  event: CachedCalendarEvent,
  fallbackId: string,
) {
  return {
    id: event.id ?? fallbackId,
    summary: event.summary ?? "(no title)",
    // All-day events use `date`; timed events use `dateTime`.
    start: event.start?.dateTime ?? event.start?.date ?? null,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    location: event.location ?? null,
    htmlLink: event.htmlLink ?? null,
    attendees: (event.attendees ?? [])
      .map((a) => a.email)
      .filter((x): x is string => Boolean(x)),
    status: event.status,
    calendarId: event.calendarId,
  };
}

function eventOverlapsRange(
  event: ReturnType<typeof normalizeCalendarEvent>,
  timeMin: string,
  timeMax: string,
) {
  const rangeStart = new Date(timeMin).getTime();
  const rangeEnd = new Date(timeMax).getTime();
  const start = event.start ? new Date(event.start).getTime() : Number.NaN;
  const end = event.end ? new Date(event.end).getTime() : start;
  if (!Number.isFinite(start)) return false;
  return start < rangeEnd && (Number.isFinite(end) ? end : start) >= rangeStart;
}

async function getLiveEvents({
  tenant,
  timeMin,
  timeMax,
  timeZone,
  maxResults,
}: {
  tenant: ReturnType<typeof corsair.withTenant>;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  maxResults: number;
}) {
  const res = await tenant.googlecalendar.api.events.getMany({
    calendarId: "primary",
    timeMin,
    timeMax,
    timeZone,
    singleEvents: true,
    orderBy: "startTime",
    maxResults,
  });

  return (res.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => normalizeCalendarEvent(e, e.id ?? ""));
}

async function getCachedEvents({
  tenant,
  timeMin,
  timeMax,
  maxResults,
}: {
  tenant: ReturnType<typeof corsair.withTenant>;
  timeMin: string;
  timeMax: string;
  maxResults: number;
}) {
  const rows = (await tenant.googlecalendar.db.events.list({
    limit: Math.max(250, maxResults),
    offset: 0,
  })) as CachedCalendarRow[];

  const events = rows
    .map((row) => normalizeCalendarEvent(row.data, row.entity_id))
    .filter((event) => event.status !== "cancelled")
    .filter((event) => !event.calendarId || event.calendarId === "primary")
    .filter((event) => eventOverlapsRange(event, timeMin, timeMax))
    .sort(
      (a, b) =>
        new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime(),
    )
    .slice(0, maxResults);

  return { rows, events };
}

export const calendarRouter = createTRPCRouter({
  /**
   * Events in a date range (defaults to the next 7 days). Reads prefer
   * Corsair's tenant-scoped local DB; live API remains a read-through fallback
   * for first-run/forced refresh because webhook subscription is intentionally
   * not wired in this slice.
   */
  events: protectedProcedure
    .input(
      z
        .object({
          timeMin: z.string().optional(),
          timeMax: z.string().optional(),
          timeZone: z.string().optional(),
          maxResults: z.number().min(1).max(250).optional(),
          forceFresh: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!(await isCalendarConnected(ctx.session.user.id))) {
        return { connected: false as const, events: [] };
      }

      const now = new Date();
      const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const tenant = corsair.withTenant(ctx.session.user.id);
      const timeMin = input?.timeMin ?? now.toISOString();
      const timeMax = input?.timeMax ?? weekOut.toISOString();
      const maxResults = input?.maxResults ?? 100;
      const cached = input?.forceFresh
        ? { rows: [] as CachedCalendarRow[], events: [] }
        : await getCachedEvents({ tenant, timeMin, timeMax, maxResults });
      const useCached =
        !input?.forceFresh &&
        shouldUseCachedCalendarEvents(cached.rows, now);
      if (useCached) {
        return { connected: true as const, events: cached.events };
      }

      try {
        return {
          connected: true as const,
          events: await getLiveEvents({
            tenant,
            timeMin,
            timeMax,
            timeZone: input?.timeZone,
            maxResults,
          }),
        };
      } catch {
        return { connected: true as const, events: cached.events };
      }
    }),

  /**
   * Free-slot finder. Pulls busy intervals via `getAvailability` over a range
   * and inverts them into open gaps (>= `minMinutes`) inside a daily window.
   * Defaults: today→+7d, 09:00–17:00 local, 30-minute minimum.
   */
  availability: protectedProcedure
    .input(
      z
        .object({
          timeMin: z.string().optional(),
          timeMax: z.string().optional(),
          timeZone: z.string().optional(),
          minMinutes: z.number().min(5).max(480).optional(),
          dayStartHour: z.number().min(0).max(23).optional(),
          dayEndHour: z.number().min(1).max(24).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!(await isCalendarConnected(ctx.session.user.id))) {
        return { connected: false as const, slots: [] };
      }

      const now = new Date();
      const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const timeMin = input?.timeMin ?? now.toISOString();
      const timeMax = input?.timeMax ?? weekOut.toISOString();
      const minMinutes = input?.minMinutes ?? 30;
      const dayStartHour = input?.dayStartHour ?? 9;
      const dayEndHour = input?.dayEndHour ?? 17;

      const tenant = corsair.withTenant(ctx.session.user.id);
      const res = await tenant.googlecalendar.api.calendar.getAvailability({
        timeMin,
        timeMax,
        timeZone: input?.timeZone,
        items: [{ id: "primary" }],
      });

      // `calendars` is an open object keyed by calendar id; each value has a
      // `busy: {start,end}[]` array. Collect every busy interval.
      const calendars = (res.calendars ?? {}) as Record<
        string,
        { busy?: { start: string; end: string }[] }
      >;
      const busy: { start: number; end: number }[] = [];
      for (const cal of Object.values(calendars)) {
        for (const b of cal.busy ?? []) {
          const s = new Date(b.start).getTime();
          const e = new Date(b.end).getTime();
          if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
            busy.push({ start: s, end: e });
          }
        }
      }
      busy.sort((a, b) => a.start - b.start);

      const slots = buildAvailabilitySlots({
        busy: busy.map((interval) => ({
          start: new Date(interval.start).toISOString(),
          end: new Date(interval.end).toISOString(),
        })),
        timeMin: new Date(
          Math.max(new Date(timeMin).getTime(), now.getTime()),
        ).toISOString(),
        timeMax,
        timeZone: input?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        minMinutes,
        dayStartHour,
        dayEndHour,
      });

      return { connected: true as const, slots };
    }),

  /**
   * Send-invite (WRITE). Creates an event on the primary calendar and emails
   * attendees (`sendUpdates: "all"`). This fires ONLY from an explicit user
   * approval in the UI (draft-then-approve) — never speculatively.
   */
  createEvent: protectedProcedure
    .input(
      z.object({
        summary: z.string().min(1),
        start: z.string(),
        end: z.string(),
        timeZone: z.string(),
        attendees: z.array(z.string().email()).optional(),
        description: z.string().optional(),
        location: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = corsair.withTenant(ctx.session.user.id);
      const created = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "all",
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start, timeZone: input.timeZone },
          end: { dateTime: input.end, timeZone: input.timeZone },
          attendees: input.attendees?.map((email) => ({ email })),
        },
      });

      return {
        id: created.id ?? null,
        htmlLink: created.htmlLink ?? null,
        summary: created.summary ?? input.summary,
      };
    }),
});
