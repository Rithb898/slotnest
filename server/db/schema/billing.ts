import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    referenceId: text("reference_id").notNull(),
    razorpayCustomerId: text("razorpay_customer_id"),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    razorpayPlanId: text("razorpay_plan_id"),
    status: text("status").default("created").notNull(),
    currentStart: timestamp("current_start"),
    currentEnd: timestamp("current_end"),
    endedAt: timestamp("ended_at"),
    quantity: integer("quantity").default(1).notNull(),
    totalCount: integer("total_count"),
    paidCount: integer("paid_count").default(0).notNull(),
    remainingCount: integer("remaining_count"),
    cancelledAt: timestamp("cancelled_at"),
    pausedAt: timestamp("paused_at"),
    shortUrl: text("short_url"),
    cancelAtCycleEnd: boolean("cancel_at_cycle_end").default(false).notNull(),
    billingPeriod: text("billing_period"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    metadata: text("metadata"),
    renewedAt: timestamp("renewed_at"),
  },
  (table) => [
    index("subscription_reference_id_idx").on(table.referenceId),
    index("subscription_status_idx").on(table.status),
    index("subscription_razorpay_subscription_id_idx").on(
      table.razorpaySubscriptionId,
    ),
  ],
);
