import { env } from "@/lib/config/env";
import {
  createTextEmbedding,
  EMBEDDING_DIMENSIONS,
  getQdrantClient,
  pointIdFromEntityId,
} from "@/lib/message-embeddings";

/**
 * "User voice" store (plan 011 step 3). A Qdrant collection of the user's own
 * SENT mail. At draft time we retrieve the user's past sent emails — preferring
 * ones to the same recipient — and inject them as style exemplars so the
 * drafter writes in the user's real voice. Voice comes ONLY from real Sent mail
 * (STOP condition: never fabricate a persona).
 *
 * Mirrors `lib/message-embeddings.ts`; reuses its Qdrant client, embedding call,
 * and point-id derivation.
 */

export const SENT_EMBEDDINGS_COLLECTION = "slotnest_sent";

export type SentExemplar = {
  to: string;
  subject: string;
  text: string;
};

type SentEmbeddingPayload = SentExemplar & {
  tenantId: string;
  date: string | null;
};

let collectionReady = false;

async function ensureSentCollection(): Promise<
  ReturnType<typeof getQdrantClient>
> {
  const client = getQdrantClient();
  if (!env.OPENAI_API_KEY || !client) return null;
  if (collectionReady) return client;

  try {
    const exists = await client.collectionExists(SENT_EMBEDDINGS_COLLECTION);
    if (!exists.exists) {
      await client.createCollection(SENT_EMBEDDINGS_COLLECTION, {
        vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" },
      });
    }
  } catch (error) {
    throw new Error(
      `Qdrant is not reachable at ${env.QDRANT_URL}. Check that the Qdrant endpoint is running and reachable from this machine.`,
      { cause: error },
    );
  }
  collectionReady = true;
  return client;
}

export async function ensureSentEmbeddingStore(): Promise<boolean> {
  return Boolean(await ensureSentCollection());
}

export function buildSentEmbeddingInput(exemplar: SentExemplar): string {
  return [
    exemplar.subject ? `Subject: ${exemplar.subject}` : null,
    exemplar.to ? `To: ${exemplar.to}` : null,
    exemplar.text ? `Body: ${exemplar.text}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export async function upsertSentEmbedding({
  tenantId,
  entityId,
  to,
  subject,
  text,
  date,
}: {
  tenantId: string;
  entityId: string;
  to: string;
  subject: string;
  text: string;
  date: string | null;
}): Promise<boolean> {
  const input = buildSentEmbeddingInput({ to, subject, text });
  const client = await ensureSentCollection();
  if (!input || !client) return false;

  const embedding = await createTextEmbedding(input);
  await client.upsert(SENT_EMBEDDINGS_COLLECTION, {
    wait: true,
    points: [
      {
        id: pointIdFromEntityId(entityId),
        vector: embedding,
        payload: {
          tenantId,
          to,
          subject,
          text: text.slice(0, 4000),
          date,
        } satisfies SentEmbeddingPayload,
      },
    ],
  });
  return true;
}

/**
 * Semantic exemplars for a tenant, optionally biased toward a recipient. The
 * recipient is folded into the query text (the embedding already encodes "To:")
 * so retrieval favors mail to that person without a brittle keyword filter.
 */
export async function searchSentExemplars({
  tenantId,
  query,
  recipient,
  limit,
}: {
  tenantId: string;
  query: string;
  recipient?: string;
  limit: number;
}): Promise<SentExemplar[]> {
  const client = await ensureSentCollection();
  if (!client) return [];

  const embedding = await createTextEmbedding(
    recipient ? `To: ${recipient}\n${query}` : query,
  );
  const results = await client.search(SENT_EMBEDDINGS_COLLECTION, {
    vector: embedding,
    limit,
    with_payload: true,
    filter: { must: [{ key: "tenantId", match: { value: tenantId } }] },
  });

  return results.flatMap((result) => {
    const payload = result.payload as Partial<SentEmbeddingPayload> | null;
    return payload?.text
      ? [
          {
            to: payload.to ?? "",
            subject: payload.subject ?? "",
            text: payload.text,
          },
        ]
      : [];
  });
}
