import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { createCorsair } from "corsair";
import { env } from "@/lib/config/env";
import { conn } from "./db";

export const corsair = createCorsair({
  plugins: [
    gmail({
      authType: "oauth_2",
      webhookHooks: {
        messageChanged: {
          after: async () => {
            // Ingest-time seam for plan 007 triage and plan 008 embeddings.
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
