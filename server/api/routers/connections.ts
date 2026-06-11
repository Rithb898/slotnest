import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsairAccounts, corsairIntegrations } from "@/server/db/schema";

export const connectionsRouter = createTRPCRouter({
  /**
   * Returns the distinct Corsair integration names the current user has
   * connected (e.g. ["gmail", "googlecalendar"]). Reads Corsair's own tables
   * scoped to the user's id (the Corsair tenant id).
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ name: corsairIntegrations.name })
      .from(corsairAccounts)
      .innerJoin(
        corsairIntegrations,
        eq(corsairAccounts.integrationId, corsairIntegrations.id),
      )
      .where(eq(corsairAccounts.tenantId, ctx.session.user.id));

    return [...new Set(rows.map((r) => r.name))];
  }),
});
