import "dotenv/config";

import { eq } from "drizzle-orm";

import { extractBody, getHeader } from "@/lib/gmail";
import {
  ensureSentEmbeddingStore,
  upsertSentEmbedding,
} from "@/lib/sent-embeddings";
import { corsair } from "@/server/corsair";
import { db } from "@/server/db";
import { corsairAccounts, corsairIntegrations } from "@/server/db/schema";

/**
 * Backfill the `slotnest_sent` voice store (plan 011 step 3). For every Gmail
 * tenant, list SENT messages live (`gmail.api.messages.list({ labelIds:
 * ["SENT"] })`), fetch each with `format: "full"` for headers + body, and embed
 * them as user-voice exemplars. Mirrors `backfill-message-embeddings.ts`.
 */

type GmailMessage = {
  id?: string;
  internalDate?: string | number | Date | null;
  payload?: Parameters<typeof extractBody>[0];
  snippet?: string;
};

const perTenant = Number.parseInt(process.env.BACKFILL_SENT_LIMIT ?? "100", 10);
const limit = Number.isFinite(perTenant) && perTenant > 0 ? perTenant : 100;

async function main() {
  const storeReady = await ensureSentEmbeddingStore();
  if (!storeReady) {
    console.log(
      "Sent embedding backfill skipped: OPENAI_API_KEY and QDRANT_URL must be configured.",
    );
    return;
  }

  const accounts = await db
    .select({ tenantId: corsairAccounts.tenantId })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(eq(corsairIntegrations.name, "gmail"));

  const tenantIds = [...new Set(accounts.map((a) => a.tenantId))];
  let embedded = 0;
  let skipped = 0;

  for (const tenantId of tenantIds) {
    const tenant = corsair.withTenant(tenantId);
    const list = await tenant.gmail.api.messages.list({
      labelIds: ["SENT"],
      maxResults: limit,
    });
    const ids = (list.messages ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));

    for (const id of ids) {
      const message = (await tenant.gmail.api.messages.get({
        id,
        format: "full",
      })) as GmailMessage;
      const headers = message.payload?.headers;
      const body = extractBody(message.payload);
      const text = (body.text ?? body.html ?? message.snippet ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) {
        skipped += 1;
        continue;
      }

      const date = message.internalDate
        ? new Date(Number(message.internalDate))
        : null;
      const didEmbed = await upsertSentEmbedding({
        tenantId,
        entityId: `${tenantId}:${id}`,
        to: getHeader(headers, "To") ?? "",
        subject: getHeader(headers, "Subject") ?? "",
        text,
        date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      });
      if (didEmbed) embedded += 1;
      else skipped += 1;
    }
  }

  console.log(
    `Sent embedding backfill complete: tenants=${tenantIds.length} embedded=${embedded} skipped=${skipped}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
