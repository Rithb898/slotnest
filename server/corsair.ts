import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { createCorsair } from "corsair";
import { eq } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { extractBody, getHeader } from "@/lib/gmail";
import { upsertMessageEmbedding } from "@/lib/message-embeddings";
import { conn, db } from "./db";
import { corsairAccounts, corsairEntities } from "./db/schema";

export const corsair = createCorsair({
  plugins: [
    gmail({
      authType: "oauth_2",
      webhookHooks: {
        messageChanged: {
          after: async (_ctx, response) => {
            const event = response.data;
            if (
              !event ||
              event.type === "messageDeleted" ||
              !response.corsairEntityId
            ) {
              return;
            }

            try {
              const [entity] = await db
                .select({
                  tenantId: corsairAccounts.tenantId,
                  gmailMessageId: corsairEntities.entityId,
                })
                .from(corsairEntities)
                .innerJoin(
                  corsairAccounts,
                  eq(corsairEntities.accountId, corsairAccounts.id),
                )
                .where(eq(corsairEntities.id, response.corsairEntityId))
                .limit(1);
              if (!entity) return;

              const body = extractBody(event.message.payload);
              const headers = event.message.payload?.headers;
              await upsertMessageEmbedding({
                tenantId: entity.tenantId,
                entityId: response.corsairEntityId,
                gmailMessageId: entity.gmailMessageId,
                message: {
                  subject: getHeader(headers, "Subject"),
                  snippet: event.message.snippet,
                  body: body.text ?? body.html,
                  from: getHeader(headers, "From"),
                  to: getHeader(headers, "To"),
                  date: event.message.internalDate ?? null,
                },
              });
            } catch (error) {
              console.warn("Failed to embed Gmail message on ingest:", error);
            }
          },
        },
      },
    }),
    googlecalendar({
      authType: "oauth_2",
      webhookHooks: {
        onEventChanged: {
          after: async () => {
            // Ingest-time seam for calendar-derived scheduling intelligence.
          },
        },
      },
    }),
  ],
  database: conn,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
});
