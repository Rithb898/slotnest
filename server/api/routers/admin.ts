import { TRPCError } from "@trpc/server";
import { asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
import { BILLING_PLAN_CATALOG } from "@/lib/billing-plans";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { BILLING_PLANS } from "@/server/billing/plans";
import { subscription, user } from "@/server/db/schema";

const PAGE_LIMIT = 25;
const statusPriority = [
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

const searchUsersInput = z.object({
  q: z.string().default(""),
  limit: z.number().int().min(1).max(PAGE_LIMIT).default(10),
  offset: z.number().int().min(0).default(0),
});

function statusRank(status: string): number {
  const index = statusPriority.indexOf(
    status as (typeof statusPriority)[number],
  );
  return index === -1 ? statusPriority.length : index;
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

function selectSubscription(rows: Array<typeof subscription.$inferSelect>) {
  return (
    [...rows].sort((a, b) => {
      const rankDelta = statusRank(a.status) - statusRank(b.status);
      if (rankDelta !== 0) return rankDelta;
      return b.referenceId.localeCompare(a.referenceId);
    })[0] ?? null
  );
}

function addOneUtcMonth(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminEmail(ctx.session.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    });
  }

  return next();
});

export const adminRouter = createTRPCRouter({
  searchUsers: adminProcedure
    .input(searchUsersInput)
    .query(async ({ ctx, input }) => {
      const search = input.q.trim();
      const where =
        search.length > 0
          ? or(
              ilike(user.name, `%${search}%`),
              ilike(user.email, `%${search}%`),
            )
          : undefined;

      const [{ total }] = await ctx.db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(user)
        .where(where);

      const rows = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt), asc(user.email))
        .limit(input.limit)
        .offset(input.offset);

      const userIds = rows.map((row) => row.id);
      const subscriptions = userIds.length
        ? await ctx.db
            .select()
            .from(subscription)
            .where(inArray(subscription.referenceId, userIds))
        : [];

      const subscriptionsByUserId = new Map<
        string,
        (typeof subscription.$inferSelect)[]
      >();
      for (const row of subscriptions) {
        const current = subscriptionsByUserId.get(row.referenceId) ?? [];
        current.push(row);
        subscriptionsByUserId.set(row.referenceId, current);
      }

      return {
        total,
        users: rows.map((row) => {
          const currentSubscription = selectSubscription(
            subscriptionsByUserId.get(row.id) ?? [],
          );
          return {
            id: row.id,
            name: row.name,
            email: row.email,
            image: row.image,
            subscription: currentSubscription
              ? {
                  plan: currentSubscription.plan,
                  status: currentSubscription.status,
                  currentStart: currentSubscription.currentStart,
                  currentEnd: currentSubscription.currentEnd,
                }
              : null,
            currentPlan:
              currentSubscription && hasPaidAccess(currentSubscription.status)
                ? toPlanSummary(currentSubscription.plan)
                : BILLING_PLAN_CATALOG.free,
          };
        }),
      };
    }),

  upgradeToPro: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [targetUser] = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
        })
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      const existingRows = await ctx.db
        .select()
        .from(subscription)
        .where(eq(subscription.referenceId, targetUser.id));
      const current = selectSubscription(existingRows);
      const now = new Date();
      const next = {
        plan: BILLING_PLANS.pro.name,
        referenceId: targetUser.id,
        razorpayCustomerId: null,
        razorpaySubscriptionId: null,
        razorpayPlanId: null,
        status: "active",
        currentStart: now,
        currentEnd: addOneUtcMonth(now),
        endedAt: null,
        quantity: 1,
        totalCount: BILLING_PLANS.pro.totalCount,
        paidCount: 0,
        remainingCount: BILLING_PLANS.pro.totalCount,
        cancelledAt: null,
        pausedAt: null,
        shortUrl: null,
        cancelAtCycleEnd: false,
        billingPeriod: "monthly",
        trialStart: null,
        trialEnd: null,
        metadata: null,
        renewedAt: now,
      } as const;

      if (current) {
        await ctx.db
          .update(subscription)
          .set(next)
          .where(eq(subscription.id, current.id));
      } else {
        await ctx.db.insert(subscription).values({
          id: crypto.randomUUID(),
          ...next,
        });
      }

      return {
        ok: true as const,
        userId: targetUser.id,
      };
    }),
});
