import { BILLING_PLAN_CATALOG } from "@/lib/billing-plans";
import { env } from "@/lib/config/env";

export const BILLING_PLANS = {
  pro: {
    ...BILLING_PLAN_CATALOG.pro,
    razorpayPlanId: env.RAZORPAY_PRO_PLAN_ID,
    totalCount: 1200,
  },
} as const;

export type BillingPlanName = keyof typeof BILLING_PLANS;
