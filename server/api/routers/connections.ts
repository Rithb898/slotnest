import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  corsairAccounts,
  corsairEntities,
  corsairEvents,
  corsairIntegrations,
} from "@/server/db/schema";

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

  disconnect: protectedProcedure
    .input(z.object({ provider: z.enum(["gmail", "googlecalendar"]) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ id: corsairAccounts.id })
        .from(corsairAccounts)
        .innerJoin(
          corsairIntegrations,
          eq(corsairAccounts.integrationId, corsairIntegrations.id),
        )
        .where(
          and(
            eq(corsairAccounts.tenantId, ctx.session.user.id),
            eq(corsairIntegrations.name, input.provider),
          ),
        );

      const accountIds = rows.map((row) => row.id);
      if (accountIds.length === 0) {
        return { disconnected: false as const };
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(corsairEvents)
          .where(inArray(corsairEvents.accountId, accountIds));
        await tx
          .delete(corsairEntities)
          .where(inArray(corsairEntities.accountId, accountIds));
        await tx
          .delete(corsairAccounts)
          .where(inArray(corsairAccounts.id, accountIds));
      });

      return { disconnected: true as const, provider: input.provider };
    }),
});
