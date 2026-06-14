import { keepPreviousData } from "@tanstack/react-query";

/**
 * Shared options for the live Gmail/Calendar queries.
 *
 * Freshness: we don't use webhooks (see plans + AGENTS notes); instead we poll
 * the Corsair live API. TanStack Query's `refetchIntervalInBackground` defaults
 * to `false`, so these intervals pause while the tab is hidden — keeping us well
 * under Google's per-project API quotas. We also refetch on window focus.
 *
 * Robustness: `retry: false` so a failed call fails fast instead of waiting out
 * three exponential-backoff retries (which delayed the first-run screen). These
 * queries are gated on `connections.list` at each call site, so they only run
 * once an account is connected. `placeholderData: keepPreviousData` keeps the
 * current data on screen across polls and range changes instead of dropping
 * back to skeletons.
 */

/** Inbox: poll every 30s. */
export const INBOX_POLL_OPTIONS = {
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
  retry: false,
  placeholderData: keepPreviousData,
} as const;

/** Calendar/availability: poll every 60s (changes less often than mail). */
export const CALENDAR_POLL_OPTIONS = {
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
  retry: false,
  placeholderData: keepPreviousData,
} as const;
