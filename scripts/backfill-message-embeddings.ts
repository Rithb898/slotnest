import "dotenv/config";

import { and, eq } from "drizzle-orm";
import {
  buildMessageEmbeddingInput,
  upsertMessageEmbedding,
} from "@/lib/message-embeddings";
import { db } from "@/server/db";
import {
  corsairAccounts,
  corsairEntities,
  corsairIntegrations,
} from "@/server/db/schema";

type CachedMessageData = {
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
  from?: string | null;
  to?: string | null;
};

const batchSize = Number.parseInt(process.env.BACKFILL_LIMIT ?? "100", 10);

const rows = await db
  .select({
    tenantId: corsairAccounts.tenantId,
    entityId: corsairEntities.id,
    gmailMessageId: corsairEntities.entityId,
    data: corsairEntities.data,
  })
  .from(corsairEntities)
  .innerJoin(corsairAccounts, eq(corsairEntities.accountId, corsairAccounts.id))
  .innerJoin(
    corsairIntegrations,
    eq(corsairAccounts.integrationId, corsairIntegrations.id),
  )
  .where(
    and(
      eq(corsairIntegrations.name, "gmail"),
      eq(corsairEntities.entityType, "messages"),
    ),
  )
  .limit(Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 100);

let embedded = 0;
let skipped = 0;

for (const row of rows) {
  const data = row.data as CachedMessageData;
  if (!buildMessageEmbeddingInput(data)) {
    skipped += 1;
    continue;
  }

  const didEmbed = await upsertMessageEmbedding({
    tenantId: row.tenantId,
    entityId: row.entityId,
    gmailMessageId: row.gmailMessageId,
    message: data,
  });
  if (didEmbed) {
    embedded += 1;
  } else {
    skipped += 1;
  }
}

console.log(
  `Message embedding backfill complete: embedded=${embedded} skipped=${skipped}`,
);
