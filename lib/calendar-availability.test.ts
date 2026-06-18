import assert from "node:assert/strict";

import { buildAvailabilitySlots } from "./calendar-availability";

const tokyoSlots = buildAvailabilitySlots({
  busy: [],
  timeMin: "2026-06-17T16:30:00.000Z",
  timeMax: "2026-06-18T16:30:00.000Z",
  timeZone: "Asia/Tokyo",
  minMinutes: 30,
  dayStartHour: 9,
  dayEndHour: 17,
});

assert.deepEqual(tokyoSlots, [
  {
    start: "2026-06-18T00:00:00.000Z",
    end: "2026-06-18T08:00:00.000Z",
  },
]);

const laSlots = buildAvailabilitySlots({
  busy: [
    {
      start: "2026-06-19T06:30:00.000Z",
      end: "2026-06-19T07:30:00.000Z",
    },
  ],
  timeMin: "2026-06-18T06:30:00.000Z",
  timeMax: "2026-06-19T06:30:00.000Z",
  timeZone: "America/Los_Angeles",
  minMinutes: 30,
  dayStartHour: 9,
  dayEndHour: 17,
});

assert.deepEqual(laSlots, [
  {
    start: "2026-06-18T16:00:00.000Z",
    end: "2026-06-19T00:00:00.000Z",
  },
]);

for (const slot of [...tokyoSlots, ...laSlots]) {
  assert.ok(new Date(slot.end).getTime() > new Date(slot.start).getTime());
}

console.log("calendar availability timezone tests passed");
