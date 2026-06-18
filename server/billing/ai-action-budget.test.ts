import { strict as assert } from "node:assert";

import {
  AI_ACTION_BUDGET_EXHAUSTED_MESSAGE,
  resolveAiActionBudgetWindow,
  summarizeAiActionBudget,
} from "./ai-action-budget";

const freeSummary = {
  currentPlan: { name: "free" },
  subscription: null,
};

const proSummary = {
  currentPlan: { name: "pro" },
  subscription: {
    currentStart: new Date("2026-06-01T00:00:00.000Z"),
    currentEnd: new Date("2026-07-01T00:00:00.000Z"),
  },
};

const freeWindow = resolveAiActionBudgetWindow(
  freeSummary,
  new Date("2026-06-18T09:30:00.000Z"),
);
assert.equal(freeWindow.periodKind, "daily");
assert.equal(freeWindow.limit, 5);
assert.equal(freeWindow.periodKey, "daily:2026-06-18");
assert.equal(freeWindow.resetAt.toISOString(), "2026-06-19T00:00:00.000Z");

const proWindow = resolveAiActionBudgetWindow(
  proSummary,
  new Date("2026-06-18T09:30:00.000Z"),
);
assert.equal(proWindow.periodKind, "monthly");
assert.equal(proWindow.limit, 300);
assert.equal(
  proWindow.periodKey,
  "monthly:2026-06-01T00:00:00.000Z:2026-07-01T00:00:00.000Z",
);
assert.equal(proWindow.resetAt.toISOString(), "2026-07-01T00:00:00.000Z");

const fresh = summarizeAiActionBudget(
  freeSummary,
  2,
  new Date("2026-06-18T09:30:00.000Z"),
);
assert.equal(fresh.used, 2);
assert.equal(fresh.remaining, 3);
assert.equal(fresh.exhausted, false);

const exhausted = summarizeAiActionBudget(
  freeSummary,
  5,
  new Date("2026-06-18T09:30:00.000Z"),
);
assert.equal(exhausted.used, 5);
assert.equal(exhausted.remaining, 0);
assert.equal(exhausted.exhausted, true);
assert.equal(
  AI_ACTION_BUDGET_EXHAUSTED_MESSAGE,
  "AI action budget exhausted. Upgrade to Pro to keep using SlotNest.",
);
