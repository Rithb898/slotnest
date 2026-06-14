import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
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

/** A free-busy interval as returned by `getAvailability`. */
type BusyInterval = { start: string; end: string };

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

export const calendarRouter = createTRPCRouter({
  /**
   * Events in a date range (defaults to the next 7 days). `singleEvents` +
   * `orderBy: "startTime"` so recurring events are expanded and sorted.
   */
  events: protectedProcedure
    .input(
      z
        .object({
          timeMin: z.string().optional(),
          timeMax: z.string().optional(),
          timeZone: z.string().optional(),
          maxResults: z.number().min(1).max(250).optional(),
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

      const res = await tenant.googlecalendar.api.events.getMany({
        calendarId: "primary",
        timeMin: input?.timeMin ?? now.toISOString(),
        timeMax: input?.timeMax ?? weekOut.toISOString(),
        timeZone: input?.timeZone,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: input?.maxResults ?? 100,
      });

      const events = (res.items ?? [])
        .filter((e) => e.status !== "cancelled")
        .map((e) => ({
          id: e.id ?? "",
          summary: e.summary ?? "(no title)",
          // All-day events use `date`; timed events use `dateTime`.
          start: e.start?.dateTime ?? e.start?.date ?? null,
          end: e.end?.dateTime ?? e.end?.date ?? null,
          allDay: Boolean(e.start?.date && !e.start?.dateTime),
          location: e.location ?? null,
          htmlLink: e.htmlLink ?? null,
          attendees: (e.attendees ?? [])
            .map((a) => a.email)
            .filter((x): x is string => Boolean(x)),
        }));

      return { connected: true as const, events };
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
        { busy?: BusyInterval[] }
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

      // Invert busy intervals into free slots, per day, within the work window.
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

        // Clamp the day's window to the overall range and to "now".
        let cursor = Math.max(
          windowStart.getTime(),
          rangeStart.getTime(),
          now.getTime(),
        );
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
