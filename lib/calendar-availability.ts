type BusyInterval = { start: string; end: string };

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type TimeZoneDateTime = LocalDateParts & {
  hour: number;
  minute: number;
  second: number;
};

type AvailabilitySlot = { start: string; end: string };

function getTimeZoneParts(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });

  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = timeZoneName?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function zonedDateTimeToUtc(
  value: TimeZoneDateTime,
  timeZone: string,
): Date {
  const localUtcGuess = new Date(
    Date.UTC(
      value.year,
      value.month - 1,
      value.day,
      value.hour === 24 ? 0 : value.hour,
      value.minute,
      value.second,
    ),
  );
  if (value.hour === 24) {
    localUtcGuess.setUTCDate(localUtcGuess.getUTCDate() + 1);
  }
  const offsetMinutes = getOffsetMinutes(localUtcGuess, timeZone);
  return new Date(localUtcGuess.getTime() - offsetMinutes * 60 * 1000);
}

function addLocalDays(
  value: LocalDateParts,
  days: number,
): LocalDateParts {
  const utc = new Date(Date.UTC(value.year, value.month - 1, value.day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function compareLocalDate(a: LocalDateParts, b: LocalDateParts): number {
  return (
    Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)
  );
}

function localDateKey(value: LocalDateParts): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(
    value.day,
  ).padStart(2, "0")}`;
}

function normalizeBusyIntervals(busy: BusyInterval[]) {
  return busy
    .map((interval) => ({
      start: new Date(interval.start).getTime(),
      end: new Date(interval.end).getTime(),
    }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
}

export function buildAvailabilitySlots({
  busy,
  timeMin,
  timeMax,
  timeZone,
  minMinutes,
  dayStartHour,
  dayEndHour,
}: {
  busy: BusyInterval[];
  timeMin: string;
  timeMax: string;
  timeZone: string;
  minMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
}): AvailabilitySlot[] {
  const busyIntervals = normalizeBusyIntervals(busy);
  const rangeStart = new Date(timeMin);
  const rangeEnd = new Date(timeMax);
  const rangeStartLocal = getTimeZoneParts(rangeStart, timeZone);
  const rangeEndLocal = getTimeZoneParts(rangeEnd, timeZone);
  const minMs = minMinutes * 60 * 1000;
  const slots: AvailabilitySlot[] = [];

  for (
    let day = rangeStartLocal;
    compareLocalDate(day, rangeEndLocal) <= 0;
    day = addLocalDays(day, 1)
  ) {
    const windowStart = zonedDateTimeToUtc(
      { ...day, hour: dayStartHour, minute: 0, second: 0 },
      timeZone,
    );
    const windowEnd = zonedDateTimeToUtc(
      {
        ...addLocalDays(day, dayEndHour === 24 ? 1 : 0),
        hour: dayEndHour === 24 ? 0 : dayEndHour,
        minute: 0,
        second: 0,
      },
      timeZone,
    );

    let cursor = Math.max(windowStart.getTime(), rangeStart.getTime());
    const dayEnd = Math.min(windowEnd.getTime(), rangeEnd.getTime());
    if (dayEnd - cursor < minMs) continue;

    for (const interval of busyIntervals) {
      if (interval.end <= cursor || interval.start >= dayEnd) continue;
      if (interval.start > cursor && interval.start - cursor >= minMs) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(interval.start).toISOString(),
        });
      }
      cursor = Math.max(cursor, interval.end);
    }

    if (dayEnd - cursor >= minMs) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(dayEnd).toISOString(),
      });
    }
  }

  return slots.filter(
    (slot) => new Date(slot.end).getTime() > new Date(slot.start).getTime(),
  );
}

export type { AvailabilitySlot, BusyInterval };
