const CALENDAR_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

type CalendarCacheRow = {
  createdAt?: string | Date | null;
};

function toTimestamp(value: string | Date | null | undefined): number {
  if (!value) return Number.NaN;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

export function getCalendarCacheAgeMs(
  rows: CalendarCacheRow[],
  now = new Date(),
) {
  const latest = rows
    .map((row) => toTimestamp(row.createdAt))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), Number.NEGATIVE_INFINITY);

  if (!Number.isFinite(latest)) {
    return Number.POSITIVE_INFINITY;
  }

  return now.getTime() - latest;
}

/**
 * In the no-webhook calendar design, trust cached rows only when they were
 * synced recently enough to still be a good approximation of the live window.
 * Otherwise fall back to live reads so newly created or moved events show up.
 */
export function shouldUseCachedCalendarEvents(
  rows: CalendarCacheRow[],
  now = new Date(),
) {
  return getCalendarCacheAgeMs(rows, now) <= CALENDAR_CACHE_MAX_AGE_MS;
}

export const CALENDAR_CACHE_MAX_AGE_MINUTES = CALENDAR_CACHE_MAX_AGE_MS / 60000;
