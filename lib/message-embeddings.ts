import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "@/lib/config/env";

export const MESSAGE_EMBEDDING_MODEL = "text-embedding-3-small";
export const MESSAGE_EMBEDDINGS_COLLECTION = "slotnest_messages";
const MESSAGE_EMBEDDING_DIMENSIONS = 1536;

type EmbeddableGmailMessage = {
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
  from?: string | null;
  to?: string | null;
  date?: Date | string | null;
};

type EmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
};

export type MessageEmbeddingPayload = {
  tenantId: string;
  entityId: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  date: string | null;
};

export type MessageSemanticSearchHit = {
  entityId: string;
  score: number;
};

let qdrantClient: QdrantClient | null = null;
let collectionReady = false;

function getQdrantClient(): QdrantClient | null {
  if (!env.QDRANT_URL) return null;
  qdrantClient ??= new QdrantClient({
    url: env.QDRANT_URL,
    ...(env.QDRANT_API_KEY ? { apiKey: env.QDRANT_API_KEY } : {}),
  });
  return qdrantClient;
}

function pointIdFromEntityId(entityId: string): string {
  const bytes = createHash("sha256").update(entityId).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function ensureMessageCollection(client: QdrantClient): Promise<void> {
  if (collectionReady) return;

  const exists = await client.collectionExists(MESSAGE_EMBEDDINGS_COLLECTION);
  if (!exists.exists) {
    await client.createCollection(MESSAGE_EMBEDDINGS_COLLECTION, {
      vectors: {
        size: MESSAGE_EMBEDDING_DIMENSIONS,
        distance: "Cosine",
      },
    });
  }

  collectionReady = true;
}

export function buildMessageEmbeddingInput(
  message: EmbeddableGmailMessage,
): string {
  return [
    message.subject ? `Subject: ${message.subject}` : null,
    message.from ? `From: ${message.from}` : null,
    message.to ? `To: ${message.to}` : null,
    message.snippet ? `Snippet: ${message.snippet}` : null,
    message.body ? `Body: ${message.body}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export async function createTextEmbedding(input: string): Promise<number[]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      model: MESSAGE_EMBEDDING_MODEL,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as EmbeddingsResponse;
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== MESSAGE_EMBEDDING_DIMENSIONS) {
    throw new Error("Embedding response did not include a 1536-d vector.");
  }

  return embedding;
}

export async function upsertMessageEmbedding({
  tenantId,
  entityId,
  gmailMessageId,
  message,
}: {
  tenantId: string;
  entityId: string;
  gmailMessageId: string;
  message: EmbeddableGmailMessage;
}): Promise<boolean> {
  const input = buildMessageEmbeddingInput(message);
  const client = getQdrantClient();
  if (!input || !env.OPENAI_API_KEY || !client) return false;

  const embedding = await createTextEmbedding(input);
  await ensureMessageCollection(client);
  await client.upsert(MESSAGE_EMBEDDINGS_COLLECTION, {
    wait: true,
    points: [
      {
        id: pointIdFromEntityId(entityId),
        vector: embedding,
        payload: {
          tenantId,
          entityId,
          gmailMessageId,
          subject: message.subject ?? "",
          from: message.from ?? "",
          date: message.date ? new Date(message.date).toISOString() : null,
        } satisfies MessageEmbeddingPayload,
      },
    ],
  });

  return true;
}

export async function searchMessageEmbeddings({
  tenantId,
  query,
  limit,
}: {
  tenantId: string;
  query: string;
  limit: number;
}): Promise<MessageSemanticSearchHit[]> {
  const client = getQdrantClient();
  if (!env.OPENAI_API_KEY || !client) return [];

  const embedding = await createTextEmbedding(query);
  await ensureMessageCollection(client);
  const results = await client.search(MESSAGE_EMBEDDINGS_COLLECTION, {
    vector: embedding,
    limit,
    with_payload: true,
    filter: {
      must: [
        {
          key: "tenantId",
          match: { value: tenantId },
        },
      ],
    },
  });

  return results
    .map((result) => {
      const payload = result.payload as Partial<MessageEmbeddingPayload> | null;
      return payload?.entityId
        ? { entityId: payload.entityId, score: result.score }
        : null;
    })
    .filter((hit): hit is MessageSemanticSearchHit => Boolean(hit));
}
