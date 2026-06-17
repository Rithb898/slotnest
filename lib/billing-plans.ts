export const BILLING_PLAN_CATALOG = {
  free: {
    name: "free",
    label: "Free",
    description: "Core SlotNest access for personal use.",
    priceInr: 0,
  },
  pro: {
    name: "pro",
    label: "Pro",
    description: "Single-user billing for the full SlotNest control room.",
    priceInr: 299,
  },
} as const;
