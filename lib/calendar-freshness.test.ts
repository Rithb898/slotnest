import assert from "node:assert/strict";

import {
  getCalendarCacheAgeMs,
  shouldUseCachedCalendarEvents,
} from "@/lib/calendar-freshness";

const now = new Date("2026-06-18T12:00:00.000Z");

const freshRows = [
  { createdAt: "2026-06-18T11:58:00.000Z" },
  { createdAt: "2026-06-18T11:59:30.000Z" },
];

const staleRows = [
  { createdAt: "2026-06-18T11:45:00.000Z" },
  { createdAt: "2026-06-18T11:30:00.000Z" },
];

assert.equal(getCalendarCacheAgeMs(freshRows, now), 30_000);
assert.equal(shouldUseCachedCalendarEvents(freshRows, now), true);

assert.equal(getCalendarCacheAgeMs(staleRows, now), 15 * 60 * 1000);
assert.equal(shouldUseCachedCalendarEvents(staleRows, now), false);

const routeDecision = shouldUseCachedCalendarEvents(staleRows, now);
const chatDecision = shouldUseCachedCalendarEvents(staleRows, now);
assert.equal(routeDecision, chatDecision);

assert.equal(shouldUseCachedCalendarEvents([], now), false);

console.log("calendar freshness tests passed");
