import { createHash, randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

import { BILLING_PLAN_CATALOG } from "@/lib/billing-plans";
import { aiActionBudget, subscription } from "@/server/db/schema";

export const AI_ACTION_BUDGET_LIMITS = {
  free: 5,
  pro: 300,
} as const;

export const AI_ACTION_BUDGET_EXHAUSTED_MESSAGE =
  "AI action budget exhausted. Upgrade to Pro to keep using SlotNest.";

export type AiActionBudgetPeriodKind = "daily" | "monthly";

export type AiActionBudgetSummary = {
  periodKind: AiActionBudgetPeriodKind;
  periodKey: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
  exhausted: boolean;
};

type BillingSummaryLike = {
  currentPlan: {
    name: string;
  };
  subscription: {
    currentStart: Date | null;
    currentEnd: Date | null;
  } | null;
};

type BudgetReservationInput = {
  actionKind: string;
  source: string;
  model: string;
  now?: Date;
};

type BudgetQueryDb = {
  select: typeof import("@/server/db").db.select;
};

type BudgetTransaction = BudgetQueryDb & {
  execute: typeof import("@/server/db").db.execute;
  insert: typeof import("@/server/db").db.insert;
};

const STATUS_PRIORITY = [
  "active",
  "authenticated",
  "pending",
  "paused",
  "halted",
  "created",
  "cancelled",
  "completed",
  "expired",
] as const;

function statusRank(status: string): number {
  const index = STATUS_PRIORITY.indexOf(
    status as (typeof STATUS_PRIORITY)[number],
  );
  return index === -1 ? STATUS_PRIORITY.length : index;
}

function selectSubscription(rows: Array<typeof subscription.$inferSelect>) {
  return (
    [...rows].sort((a, b) => {
      const rankDelta = statusRank(a.status) - statusRank(b.status);
      if (rankDelta !== 0) return rankDelta;
      return b.referenceId.localeCompare(a.referenceId);
    })[0] ?? null
  );
}

function hasPaidAccess(status: string) {
  return !["created", "cancelled", "completed", "expired"].includes(status);
}

function toPlanSummary(planName: string | null | undefined) {
  if (!planName) return BILLING_PLAN_CATALOG.free;
  const plan =
    BILLING_PLAN_CATALOG[planName as keyof typeof BILLING_PLAN_CATALOG];
  return plan ?? BILLING_PLAN_CATALOG.free;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addOneUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function resolveMonthlyWindow(
  subscription: BillingSummaryLike["subscription"],
  now: Date,
) {
  const start = subscription?.currentStart ?? startOfUtcMonth(now);
  const resetAt = subscription?.currentEnd ?? addOneUtcMonth(start);
  const periodKey = `monthly:${start.toISOString()}:${resetAt.toISOString()}`;

  return {
    periodKind: "monthly" as const,
    periodKey,
    limit: AI_ACTION_BUDGET_LIMITS.pro,
    resetAt,
  };
}

function resolveDailyWindow(now: Date) {
  const start = startOfUtcDay(now);
  const resetAt = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    periodKind: "daily" as const,
    periodKey: `daily:${start.toISOString().slice(0, 10)}`,
    limit: AI_ACTION_BUDGET_LIMITS.free,
    resetAt,
  };
}

export function resolveAiActionBudgetWindow(
  summary: BillingSummaryLike,
  now = new Date(),
) {
  return summary.currentPlan.name === "pro"
    ? resolveMonthlyWindow(summary.subscription, now)
    : resolveDailyWindow(now);
}

export function summarizeAiActionBudget(
  summary: BillingSummaryLike,
  used: number,
  now = new Date(),
): AiActionBudgetSummary {
  const window = resolveAiActionBudgetWindow(summary, now);
  const remaining = Math.max(window.limit - used, 0);

  return {
    ...window,
    used,
    remaining,
    exhausted: remaining <= 0,
  };
}

export async function loadAiActionBudgetBillingSummary(
  db: BudgetQueryDb,
  userId: string,
): Promise<BillingSummaryLike> {
  const rows = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, userId));
  const current = selectSubscription(rows);

  return {
    subscription: current
      ? {
          currentStart: current.currentStart,
          currentEnd: current.currentEnd,
        }
      : null,
    currentPlan:
      current && hasPaidAccess(current.status)
        ? toPlanSummary(current.plan)
        : BILLING_PLAN_CATALOG.free,
  };
}

export function getAiActionBudgetLockKey(
  userId: string,
  periodKey: string,
): bigint {
  const hash = createHash("sha256").update(`${userId}:${periodKey}`).digest();
  return hash.readBigInt64BE(0);
}

async function countAiActionBudgetUsage(
  db: BudgetQueryDb,
  userId: string,
  periodKey: string,
) {
  try {
    const [row] = await db
      .select({
        used: sql<number>`coalesce(count(*), 0)::int`,
      })
      .from(aiActionBudget)
      .where(
        and(
          eq(aiActionBudget.userId, userId),
          eq(aiActionBudget.periodKey, periodKey),
        ),
      );

    return row?.used ?? 0;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null
        ? (error as { code?: unknown }).code
        : undefined;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      code === "42P01"
    ) {
      return 0;
    }

    throw error;
  }
}

export async function getAiActionBudgetSummary(
  db: BudgetQueryDb,
  userId: string,
  now = new Date(),
): Promise<AiActionBudgetSummary> {
  const summary = await loadAiActionBudgetBillingSummary(db, userId);
  const window = resolveAiActionBudgetWindow(summary, now);
  const used = await countAiActionBudgetUsage(db, userId, window.periodKey);
  return summarizeAiActionBudget(summary, used, now);
}

export async function reserveAiActionBudget(
  db: typeof import("@/server/db").db,
  userId: string,
  input: BudgetReservationInput,
): Promise<AiActionBudgetSummary> {
  const now = input.now ?? new Date();
  const summary = await loadAiActionBudgetBillingSummary(db, userId);
  const window = resolveAiActionBudgetWindow(summary, now);

  await db.transaction(async (tx) => {
    const budgetTx = tx as BudgetTransaction;

    await budgetTx.execute(
      sql`select pg_advisory_xact_lock(${getAiActionBudgetLockKey(userId, window.periodKey)})`,
    );

    const used = await countAiActionBudgetUsage(
      budgetTx,
      userId,
      window.periodKey,
    );
    if (used >= window.limit) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: AI_ACTION_BUDGET_EXHAUSTED_MESSAGE,
      });
    }

    await budgetTx.insert(aiActionBudget).values({
      id: randomUUID(),
      userId,
      actionKind: input.actionKind,
      periodKey: window.periodKey,
      source: input.source,
      model: input.model,
    });
  });

  return summarizeAiActionBudget(
    summary,
    await countAiActionBudgetUsage(db, userId, window.periodKey),
    now,
  );
}
