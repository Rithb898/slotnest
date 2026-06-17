import { createHmac, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import Razorpay from "razorpay";
import { z } from "zod";
import { BILLING_PLAN_CATALOG } from "@/lib/billing-plans";
import { env } from "@/lib/config/env";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { BILLING_PLANS } from "@/server/billing/plans";
import { subscription } from "@/server/db/schema";

const razorpayClient = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

type RazorpaySubscription = RazorpaySubscriptionRecord;

type RazorpaySubscriptionRecord = {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  quantity?: number | null;
  total_count: number;
  paid_count: number;
  remaining_count?: string | number | null;
  short_url?: string | null;
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

function toPlanSummary(planName: string | null | undefined) {
  if (!planName) return BILLING_PLAN_CATALOG.free;
  const plan =
    BILLING_PLAN_CATALOG[planName as keyof typeof BILLING_PLAN_CATALOG];
  return plan ?? BILLING_PLAN_CATALOG.free;
}

function toDate(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000) : undefined;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasPaidAccess(status: string) {
  return !["created", "cancelled", "completed", "expired"].includes(status);
}

function canReuseCheckout(status: string) {
  return !["cancelled", "completed", "expired"].includes(status);
}

function mapSubscription(remote: RazorpaySubscription) {
  return {
    razorpaySubscriptionId: remote.id,
    razorpayPlanId: remote.plan_id,
    status: remote.status,
    currentStart: toDate(remote.current_start),
    currentEnd: toDate(remote.current_end),
    endedAt: toDate(remote.ended_at),
    quantity: remote.quantity ?? 1,
    totalCount: remote.total_count,
    paidCount: remote.paid_count,
    remainingCount: toNumber(remote.remaining_count),
  };
}

function subscriptionMatches(
  current: typeof subscription.$inferSelect,
  next: ReturnType<typeof mapSubscription>,
) {
  return (
    current.razorpaySubscriptionId === next.razorpaySubscriptionId &&
    current.razorpayPlanId === next.razorpayPlanId &&
    current.status === next.status &&
    current.currentStart?.getTime() === next.currentStart?.getTime() &&
    current.currentEnd?.getTime() === next.currentEnd?.getTime() &&
    current.endedAt?.getTime() === next.endedAt?.getTime() &&
    current.quantity === next.quantity &&
    current.totalCount === next.totalCount &&
    current.paidCount === next.paidCount &&
    current.remainingCount === next.remainingCount
  );
}

function toCheckoutPayload(
  remoteSubscriptionId: string,
  user: { name?: string | null; email?: string | null },
) {
  const plan = BILLING_PLANS.pro;

  return {
    keyId: env.RAZORPAY_KEY_ID,
    subscriptionId: remoteSubscriptionId,
    planName: plan.name,
    planLabel: plan.label,
    amountInr: plan.priceInr,
    user: {
      name: user.name ?? "",
      email: user.email ?? "",
    },
  };
}

function isValidCheckoutSignature(input: {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}) {
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(
      `${input.razorpay_payment_id}|${input.razorpay_subscription_id}`,
      "utf8",
    )
    .digest("hex");

  const received = Buffer.from(input.razorpay_signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}

const verifySubscriptionCheckoutInput = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

async function syncSubscription(
  ctx: { db: typeof import("@/server/db").db },
  current: typeof subscription.$inferSelect,
) {
  if (!current.razorpaySubscriptionId) return current;

  try {
    const remote = (await razorpayClient.subscriptions.fetch(
      current.razorpaySubscriptionId,
    )) as RazorpaySubscription;
    const next = mapSubscription(remote);

    if (!subscriptionMatches(current, next)) {
      await ctx.db
        .update(subscription)
        .set(next)
        .where(eq(subscription.id, current.id));
      return { ...current, ...next };
    }

    return current;
  } catch {
    return current;
  }
}

export const billingRouter = createTRPCRouter({
  createCheckoutSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const existingRows = await ctx.db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, ctx.session.user.id));
    const current = selectSubscription(existingRows);

    if (current?.razorpaySubscriptionId && canReuseCheckout(current.status)) {
      return toCheckoutPayload(
        current.razorpaySubscriptionId,
        ctx.session.user,
      );
    }

    const localId = crypto.randomUUID();

    await ctx.db.insert(subscription).values({
      id: localId,
      plan: BILLING_PLANS.pro.name,
      referenceId: ctx.session.user.id,
      status: "created",
      quantity: 1,
      totalCount: BILLING_PLANS.pro.totalCount,
      billingPeriod: "monthly",
    });

    try {
      const remote = (await razorpayClient.subscriptions.create({
        plan_id: BILLING_PLANS.pro.razorpayPlanId,
        total_count: BILLING_PLANS.pro.totalCount,
        quantity: 1,
        customer_notify: true,
        notes: {
          userId: ctx.session.user.id,
          localSubscriptionId: localId,
          plan: BILLING_PLANS.pro.name,
        },
      })) as RazorpaySubscription;

      const next = mapSubscription(remote);
      await ctx.db
        .update(subscription)
        .set(next)
        .where(eq(subscription.id, localId));

      return {
        ...toCheckoutPayload(remote.id, ctx.session.user),
      };
    } catch (error) {
      await ctx.db.delete(subscription).where(eq(subscription.id, localId));
      throw error;
    }
  }),

  verifySubscriptionCheckout: protectedProcedure
    .input(verifySubscriptionCheckoutInput)
    .mutation(async ({ ctx, input }) => {
      if (!isValidCheckoutSignature(input)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Razorpay checkout signature.",
        });
      }

      const [current] = await ctx.db
        .select()
        .from(subscription)
        .where(
          and(
            eq(subscription.referenceId, ctx.session.user.id),
            eq(
              subscription.razorpaySubscriptionId,
              input.razorpay_subscription_id,
            ),
          ),
        );

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription was not found for this account.",
        });
      }

      const remote = (await razorpayClient.subscriptions.fetch(
        input.razorpay_subscription_id,
      )) as RazorpaySubscription;
      const next = mapSubscription(remote);

      await ctx.db
        .update(subscription)
        .set(next)
        .where(eq(subscription.id, current.id));

      return {
        ok: true,
        subscription: {
          ...current,
          ...next,
        },
      };
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, ctx.session.user.id));

    const current = selectSubscription(rows);
    const syncedCurrent = current ? await syncSubscription(ctx, current) : null;

    return {
      subscription: syncedCurrent,
      currentPlan:
        syncedCurrent && hasPaidAccess(syncedCurrent.status)
          ? toPlanSummary(syncedCurrent.plan)
          : BILLING_PLAN_CATALOG.free,
      availablePlans: Object.values(BILLING_PLAN_CATALOG).map((plan) => ({
        name: plan.name,
        label: plan.label,
        description: plan.description,
        priceInr: plan.priceInr,
      })),
    };
  }),
});
