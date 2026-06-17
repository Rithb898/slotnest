import { Agent, run } from "@openai/agents";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import {
  extractBody,
  type GmailPayload,
  getHeader,
  parseAddress,
  toDate,
} from "@/lib/gmail";
import { buildRfc2822ReplyRaw } from "@/lib/gmail-reply-raw";
import {
  ensureMessageEmbeddingStore,
  getQdrantClient,
  MESSAGE_EMBEDDINGS_COLLECTION,
  pointIdFromEntityId,
  searchMessageEmbeddings,
  upsertMessageEmbedding,
} from "@/lib/message-embeddings";
import { DRAFT_REPLY_INSTRUCTIONS } from "@/lib/prompts";
import { upsertSentEmbedding } from "@/lib/sent-embeddings";
import { type Triage, triage } from "@/lib/triage";
import { classifyTriage } from "@/lib/triage-llm";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";
import { db } from "@/server/db";
import {
  corsairAccounts,
  corsairEntities,
  corsairIntegrations,
  messageTriage,
  replyDraft,
} from "@/server/db/schema";

/**
 * Returns true if the signed-in tenant has a gmail account. Mirrors
 * `isCalendarConnected` in `server/api/routers/calendar.ts` — checking Corsair's
 * own account tables (same source as `connections.list`) so the read procedures
 * can degrade gracefully instead of letting the Corsair API call throw.
 */
async function isGmailConnected(userId: string): Promise<boolean> {
  const rows = await db
    .select({ name: corsairIntegrations.name })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(eq(corsairAccounts.tenantId, userId));
  return rows.some((r) => r.name === "gmail");
}

const storedTriageSchema = z.object({
  action: z.enum(["Needs reply", "FYI", "Ignore"]),
  urgency: z.enum(["Urgent", "Normal", "Low"]),
});

type TriageCacheRecord = {
  entityId: string;
  triage: Triage | null;
};

async function getTriageCacheByGmailMessageId(
  userId: string,
  gmailMessageIds: string[],
): Promise<Map<string, TriageCacheRecord>> {
  if (gmailMessageIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      gmailMessageId: corsairEntities.entityId,
      entityId: corsairEntities.id,
      action: messageTriage.action,
      urgency: messageTriage.urgency,
    })
    .from(corsairEntities)
    .leftJoin(messageTriage, eq(messageTriage.entityId, corsairEntities.id))
    .innerJoin(
      corsairAccounts,
      eq(corsairEntities.accountId, corsairAccounts.id),
    )
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(
      and(
        inArray(corsairEntities.entityId, gmailMessageIds),
        eq(corsairEntities.entityType, "messages"),
        eq(corsairAccounts.tenantId, userId),
        eq(corsairIntegrations.name, "gmail"),
      ),
    );

  const records = new Map<string, TriageCacheRecord>();
  for (const row of rows) {
    const parsed = storedTriageSchema.safeParse({
      action: row.action,
      urgency: row.urgency,
    });
    records.set(row.gmailMessageId, {
      entityId: row.entityId,
      triage: parsed.success ? parsed.data : null,
    });
  }
  return records;
}

async function classifyAndStoreTriage(
  entityId: string,
  input: Parameters<typeof classifyTriage>[0],
): Promise<Triage> {
  const classification = await classifyTriage(input);
  await db
    .insert(messageTriage)
    .values({
      entityId,
      action: classification.triage.action,
      urgency: classification.triage.urgency,
      model: classification.model,
    })
    .onConflictDoUpdate({
      target: messageTriage.entityId,
      set: {
        action: classification.triage.action,
        urgency: classification.triage.urgency,
        model: classification.model,
      },
    });
  return classification.triage;
}

type DraftReplyResult =
  | { configured: false; text: string }
  | { configured: true; text: string };

type CachedGmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string | number | Date | null;
  payload?: GmailPayload;
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
};

type NormalizedGmailMessage = {
  id: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  messageIdHeader: string | null;
  references: string | null;
  snippet: string;
  date: Date | null;
  unread: boolean;
  labelIds: string[];
  html: string | null;
  text: string | null;
  triageInput: Parameters<typeof classifyTriage>[0];
};

type GmailSearchResult = {
  id: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: Date | null;
  unread: boolean;
  score: number;
  matchedBy: Array<"keyword" | "semantic">;
};

/** Model used for drafts — stored on each row so prompt/model bumps invalidate. */
const DRAFT_MODEL = "gpt-4.1-mini";

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanDraftText(text: string): string {
  return text
    .replace(/^```(?:text|plain)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeGmailMessage(
  message: CachedGmailMessage,
  fallbackId: string,
): NormalizedGmailMessage {
  const headers = message.payload?.headers;
  const from = parseAddress(getHeader(headers, "From") ?? message.from);
  const body = extractBody(message.payload);
  const subject =
    getHeader(headers, "Subject") ?? message.subject ?? "(no subject)";
  const snippet = message.snippet ?? "";
  const labelIds = message.labelIds ?? [];
  const date = toDate(message.internalDate);
  const sourceText =
    body.text?.trim() ||
    message.body?.trim() ||
    (body.html ? stripHtml(body.html) : "") ||
    snippet;

  return {
    id: message.id ?? fallbackId,
    threadId: message.threadId ?? null,
    fromName: from.name,
    fromEmail: from.email,
    to: getHeader(headers, "To") ?? message.to ?? "",
    subject,
    messageIdHeader: getHeader(headers, "Message-ID") ?? null,
    references: getHeader(headers, "References") ?? null,
    snippet,
    date,
    unread: labelIds.includes("UNREAD"),
    labelIds,
    html: body.html ?? null,
    text: body.text ?? message.body ?? null,
    triageInput: {
      subject,
      snippet,
      body: sourceText,
      fromEmail: from.email,
      unread: labelIds.includes("UNREAD"),
      date,
      labelIds,
      listUnsubscribe: Boolean(getHeader(headers, "List-Unsubscribe")),
    },
  };
}

function messageMatchesQuery(message: NormalizedGmailMessage, query?: string) {
  const trimmed = query?.trim().toLowerCase();
  if (!trimmed) return true;
  return [
    message.fromName,
    message.fromEmail,
    message.to,
    message.subject,
    message.snippet,
    message.text ?? "",
    message.html ? stripHtml(message.html) : "",
  ].some((value) => value.toLowerCase().includes(trimmed));
}

async function getLiveInboxMessages({
  tenant,
  q,
  maxResults,
  pageToken,
}: {
  tenant: ReturnType<typeof corsair.withTenant>;
  q?: string;
  maxResults: number;
  pageToken?: string;
}) {
  const list = await tenant.gmail.api.messages.list({
    labelIds: ["INBOX"],
    maxResults,
    q,
    pageToken,
  });

  const ids = (list.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));

  const messages = await Promise.all(
    ids.map(async (id) => {
      const msg = await tenant.gmail.api.messages.get({
        id,
        format: "full",
      });
      return normalizeGmailMessage(msg as CachedGmailMessage, msg.id ?? id);
    }),
  );

  return {
    messages,
    nextPageToken: list.nextPageToken ?? null,
  };
}

async function getCachedInboxMessages({
  tenant,
  q,
  maxResults,
  pageToken,
}: {
  tenant: ReturnType<typeof corsair.withTenant>;
  q?: string;
  maxResults: number;
  pageToken?: string;
}) {
  const offset = pageToken ? Number(pageToken) : 0;
  const normalizedOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const rows = await tenant.gmail.db.messages.list({
    limit: Math.max(250, maxResults + normalizedOffset + 1),
    offset: 0,
  });

  const filtered = rows
    .map((row) => normalizeGmailMessage(row.data, row.entity_id))
    .filter((message) => message.labelIds.includes("INBOX"))
    .filter((message) => messageMatchesQuery(message, q))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  const page = filtered.slice(normalizedOffset, normalizedOffset + maxResults);
  const nextOffset = normalizedOffset + maxResults;
  return {
    messages: page,
    nextPageToken: filtered.length > nextOffset ? String(nextOffset) : null,
  };
}

async function getCachedMessage(
  tenant: ReturnType<typeof corsair.withTenant>,
  id: string,
) {
  const row = await tenant.gmail.db.messages.findByEntityId(id);
  return row ? normalizeGmailMessage(row.data, row.entity_id) : null;
}

async function getMessageTriage(
  userId: string,
  message: NormalizedGmailMessage,
) {
  const triageCache = await getTriageCacheByGmailMessageId(userId, [
    message.id,
  ]);
  const cached = triageCache.get(message.id);
  return (
    cached?.triage ??
    (cached
      ? await classifyAndStoreTriage(cached.entityId, message.triageInput)
      : triage(message.triageInput))
  );
}

function toSearchResult(
  message: NormalizedGmailMessage,
  score: number,
  matchedBy: Array<"keyword" | "semantic">,
): GmailSearchResult {
  return {
    id: message.id,
    threadId: message.threadId,
    fromName: message.fromName,
    fromEmail: message.fromEmail,
    subject: message.subject,
    snippet: message.snippet,
    date: message.date,
    unread: message.unread,
    score,
    matchedBy,
  };
}

function mergeSearchResults({
  keyword,
  semantic,
  limit,
}: {
  keyword: NormalizedGmailMessage[];
  semantic: Array<{ message: NormalizedGmailMessage; similarity: number }>;
  limit: number;
}): GmailSearchResult[] {
  const ranked = new Map<
    string,
    {
      message: NormalizedGmailMessage;
      score: number;
      matchedBy: Set<"keyword" | "semantic">;
    }
  >();

  keyword.forEach((message, index) => {
    ranked.set(message.id, {
      message,
      score: 1 / (60 + index + 1),
      matchedBy: new Set(["keyword"]),
    });
  });

  semantic.forEach(({ message, similarity }, index) => {
    const existing = ranked.get(message.id);
    const score = Math.max(0, similarity) + 1 / (60 + index + 1);
    if (existing) {
      existing.score += score;
      existing.matchedBy.add("semantic");
      return;
    }
    ranked.set(message.id, {
      message,
      score,
      matchedBy: new Set(["semantic"]),
    });
  });

  return [...ranked.values()]
    .sort((a, b) => {
      const delta = b.score - a.score;
      if (delta !== 0) return delta;
      return (
        (b.message.date?.getTime() ?? 0) - (a.message.date?.getTime() ?? 0)
      );
    })
    .slice(0, limit)
    .map((item) =>
      toSearchResult(item.message, item.score, [...item.matchedBy]),
    );
}

async function getKeywordSearchMessages({
  tenant,
  query,
  limit,
}: {
  tenant: ReturnType<typeof corsair.withTenant>;
  query: string;
  limit: number;
}): Promise<NormalizedGmailMessage[]> {
  const fields = ["subject", "snippet", "body", "from", "to"] as const;
  const rows = await Promise.all(
    fields.map((field) =>
      tenant.gmail.db.messages.search({
        data: { [field]: { contains: query } },
        limit,
      }),
    ),
  );

  const byId = new Map<string, NormalizedGmailMessage>();
  for (const row of rows.flat()) {
    const message = normalizeGmailMessage(row.data, row.entity_id);
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }

  return [...byId.values()].sort(
    (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
  );
}

async function getSemanticSearchMessages({
  userId,
  query,
  limit,
}: {
  userId: string;
  query: string;
  limit: number;
}): Promise<Array<{ message: NormalizedGmailMessage; similarity: number }>> {
  if (!env.OPENAI_API_KEY || !env.QDRANT_URL) return [];

  const hits = await searchMessageEmbeddings({
    tenantId: userId,
    query,
    limit,
  });
  if (hits.length === 0) return [];

  const rows = await db
    .select({
      data: corsairEntities.data,
      gmailMessageId: corsairEntities.entityId,
      entityId: corsairEntities.id,
    })
    .from(corsairEntities)
    .innerJoin(
      corsairAccounts,
      eq(corsairEntities.accountId, corsairAccounts.id),
    )
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(
      and(
        inArray(
          corsairEntities.id,
          hits.map((hit) => hit.entityId),
        ),
        eq(corsairAccounts.tenantId, userId),
        eq(corsairIntegrations.name, "gmail"),
        eq(corsairEntities.entityType, "messages"),
      ),
    );

  const rowsByEntityId = new Map(rows.map((row) => [row.entityId, row]));
  return hits.flatMap((hit) => {
    const row = rowsByEntityId.get(hit.entityId);
    return row
      ? [
          {
            message: normalizeGmailMessage(
              row.data as CachedGmailMessage,
              row.gmailMessageId,
            ),
            similarity: hit.score,
          },
        ]
      : [];
  });
}

/**
 * Embed-on-sync: ensure the inbox messages just loaded are in the semantic
 * store, without re-embedding ones already there. Since webhooks are disabled,
 * this is the live ingestion path for received mail (plan 011) — it runs
 * fire-and-forget from `inbox` so it never slows or breaks the read. Only
 * messages present in the local cache (`corsair_entities`) are embeddable;
 * live-only messages get embedded on a later load once cached.
 */
async function embedNewInboxMessages(
  userId: string,
  gmailMessageIds: string[],
): Promise<void> {
  const client = getQdrantClient();
  if (!env.OPENAI_API_KEY || !client || gmailMessageIds.length === 0) return;
  if (!(await ensureMessageEmbeddingStore())) return;

  const rows = await db
    .select({
      id: corsairEntities.id,
      gmailMessageId: corsairEntities.entityId,
      data: corsairEntities.data,
    })
    .from(corsairEntities)
    .innerJoin(
      corsairAccounts,
      eq(corsairEntities.accountId, corsairAccounts.id),
    )
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(
      and(
        inArray(corsairEntities.entityId, gmailMessageIds),
        eq(corsairAccounts.tenantId, userId),
        eq(corsairIntegrations.name, "gmail"),
        eq(corsairEntities.entityType, "messages"),
      ),
    );
  if (rows.length === 0) return;

  // Skip messages already embedded (idempotent point id = hash of entity id).
  const existing = await client.retrieve(MESSAGE_EMBEDDINGS_COLLECTION, {
    ids: rows.map((row) => pointIdFromEntityId(row.id)),
    with_payload: false,
    with_vector: false,
  });
  const have = new Set(existing.map((point) => String(point.id)));

  for (const row of rows) {
    if (have.has(pointIdFromEntityId(row.id))) continue;
    try {
      await upsertMessageEmbedding({
        tenantId: userId,
        entityId: row.id,
        gmailMessageId: row.gmailMessageId,
        message: row.data as CachedGmailMessage,
      });
    } catch (error) {
      console.warn("Embed-on-sync failed for a message:", error);
    }
  }
}

export const gmailRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        q: z.string().trim().min(1),
        limit: z.number().min(1).max(25).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!(await isGmailConnected(ctx.session.user.id))) {
        return {
          connected: false as const,
          semanticConfigured: Boolean(env.OPENAI_API_KEY && env.QDRANT_URL),
          results: [],
        };
      }

      const limit = input.limit ?? 8;
      const tenant = corsair.withTenant(ctx.session.user.id);
      const keyword = await getKeywordSearchMessages({
        tenant,
        query: input.q,
        limit,
      });

      let semantic: Array<{
        message: NormalizedGmailMessage;
        similarity: number;
      }> = [];
      try {
        semantic = await getSemanticSearchMessages({
          userId: ctx.session.user.id,
          query: input.q,
          limit,
        });
      } catch (error) {
        console.warn("Semantic Gmail search failed:", error);
      }

      return {
        connected: true as const,
        semanticConfigured: Boolean(env.OPENAI_API_KEY && env.QDRANT_URL),
        results: mergeSearchResults({ keyword, semantic, limit }),
      };
    }),

  /**
   * Lists INBOX messages from Corsair's tenant-scoped local DB. When the cache
   * is empty (or a caller asks for `forceFresh`), we keep the live API path as a
   * read-through fallback so first-run accounts still populate and render.
   */
  inbox: protectedProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          maxResults: z.number().min(1).max(50).optional(),
          pageToken: z.string().optional(),
          forceFresh: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!(await isGmailConnected(ctx.session.user.id))) {
        return {
          connected: false as const,
          messages: [],
          nextPageToken: null,
        };
      }

      const tenant = corsair.withTenant(ctx.session.user.id);
      const maxResults = input?.maxResults ?? 25;

      const cached = input?.forceFresh
        ? { messages: [], nextPageToken: null }
        : await getCachedInboxMessages({
            tenant,
            q: input?.q,
            maxResults,
            pageToken: input?.pageToken,
          });

      const source =
        cached.messages.length > 0 || input?.pageToken
          ? cached
          : await getLiveInboxMessages({
              tenant,
              q: input?.q,
              maxResults,
              pageToken: input?.pageToken,
            });

      const triageCache = await getTriageCacheByGmailMessageId(
        ctx.session.user.id,
        source.messages.map((m) => m.id),
      );
      const draftRows =
        source.messages.length > 0
          ? await db
              .select({
                messageId: replyDraft.messageId,
                status: replyDraft.status,
                body: replyDraft.body,
              })
              .from(replyDraft)
              .where(
                and(
                  eq(replyDraft.userId, ctx.session.user.id),
                  inArray(
                    replyDraft.messageId,
                    source.messages.map((m) => m.id),
                  ),
                ),
              )
          : [];
      const draftsByMessageId = new Map(
        draftRows.map((row) => [row.messageId, row]),
      );

      const messages = await Promise.all(
        source.messages.map(async (message) => {
          const cached = triageCache.get(message.id);
          const labels =
            cached?.triage ??
            (cached
              ? await classifyAndStoreTriage(
                  cached.entityId,
                  message.triageInput,
                )
              : triage(message.triageInput));
          return {
            id: message.id,
            threadId: message.threadId,
            fromName: message.fromName,
            fromEmail: message.fromEmail,
            subject: message.subject,
            messageIdHeader: message.messageIdHeader,
            references: message.references,
            snippet: message.snippet,
            date: message.date,
            unread: message.unread,
            replyStatus: draftsByMessageId.get(message.id)?.status ?? null,
            replyBody: draftsByMessageId.get(message.id)?.body ?? null,
            triage: labels,
          };
        }),
      );

      // Live ingestion for received mail (webhooks are off). Fire-and-forget so
      // the inbox response never waits on — or fails because of — embedding.
      void embedNewInboxMessages(
        ctx.session.user.id,
        source.messages.map((m) => m.id),
      ).catch((error) => {
        console.warn("Embed-on-sync batch failed:", error);
      });

      return {
        connected: true as const,
        messages,
        nextPageToken: source.nextPageToken,
      };
    }),

  /**
   * Full message for the reading pane: headers + decoded body (html preferred,
   * plain-text fallback).
   */
  message: protectedProcedure
    .input(z.object({ id: z.string(), forceFresh: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const tenant = corsair.withTenant(ctx.session.user.id);

      const cached = input.forceFresh
        ? null
        : await getCachedMessage(tenant, input.id);
      const message =
        cached ??
        normalizeGmailMessage(
          (await tenant.gmail.api.messages.get({
            id: input.id,
            format: "full",
          })) as CachedGmailMessage,
          input.id,
        );
      const labels = await getMessageTriage(ctx.session.user.id, message);

      return {
        id: message.id,
        threadId: message.threadId,
        fromName: message.fromName,
        fromEmail: message.fromEmail,
        to: message.to,
        subject: message.subject,
        messageIdHeader: message.messageIdHeader,
        references: message.references,
        date: message.date,
        snippet: message.snippet,
        triage: labels,
        html: message.html,
        text: message.text,
      };
    }),

  /**
   * Send a plain-text reply in the existing Gmail thread. The raw message is
   * built locally as RFC 2822 and sent only after the user's explicit approval.
   */
  sendEmail: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);
      const sent = await tenant.gmail.api.messages.send({
        raw: buildRfc2822ReplyRaw({
          to: input.to,
          subject: input.subject,
          body: input.body,
        }),
      });

      if (sent.id) {
        try {
          await upsertSentEmbedding({
            tenantId: userId,
            entityId: `${userId}:${sent.id}`,
            to: input.to,
            subject: input.subject,
            text: input.body,
            date: new Date().toISOString(),
          });
        } catch (error) {
          console.warn("Failed to embed sent email for voice store:", error);
        }
      }

      return {
        id: sent.id ?? null,
        threadId: sent.threadId ?? null,
      };
    }),

  sendReply: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().min(1),
        messageId: z.string().optional(),
        inReplyTo: z.string().optional(),
        references: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tenant = corsair.withTenant(userId);
      const sent = await tenant.gmail.api.messages.send({
        raw: buildRfc2822ReplyRaw({
          to: input.to,
          subject: input.subject,
          body: input.body,
          inReplyTo: input.inReplyTo,
          references: input.references,
        }),
        threadId: input.threadId,
      });

      // Embed the just-sent reply into the user-voice store so future drafts
      // reflect it — no webhook, no backfill re-run needed (plan 011). Best
      // effort: a failure here must never block the send.
      if (sent.id) {
        try {
          await upsertSentEmbedding({
            tenantId: userId,
            entityId: `${userId}:${sent.id}`,
            to: input.to,
            subject: input.subject,
            text: input.body,
            date: new Date().toISOString(),
          });
        } catch (error) {
          console.warn("Failed to embed sent reply for voice store:", error);
        }
      }

      // Keep the draft cache in sync with what was actually sent.
      if (input.messageId) {
        const id = `${userId}:${input.messageId}`;
        await db
          .insert(replyDraft)
          .values({
            id,
            userId,
            messageId: input.messageId,
            threadId: input.threadId,
            body: input.body,
            model: DRAFT_MODEL,
            status: "sent",
          })
          .onConflictDoUpdate({
            target: replyDraft.id,
            set: { body: input.body, status: "sent", updatedAt: new Date() },
          });
      }

      return {
        id: sent.id ?? null,
        threadId: sent.threadId ?? input.threadId,
      };
    }),

  /**
   * Generate (or reuse) an editable plain-text reply body for one Gmail message.
   * Read-through DB cache: a draft is generated once per message and persisted,
   * so reloads return the stored body without re-billing the model. The model
   * never sends mail; it only fills the body that `sendReply` later sends after
   * the user's explicit approval.
   *
   * - Cached `edited` drafts are always returned (user changes win).
   * - `generated` drafts are reused while the model matches.
   * - `force: true` regenerates and overwrites (used by a "Regenerate" action).
   */
  draftReply: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        force: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<DraftReplyResult> => {
      const userId = ctx.session.user.id;
      const id = `${userId}:${input.messageId}`;

      if (!input.force) {
        const [cached] = await db
          .select({
            body: replyDraft.body,
            status: replyDraft.status,
            model: replyDraft.model,
          })
          .from(replyDraft)
          .where(eq(replyDraft.id, id))
          .limit(1);
        if (
          cached &&
          (cached.status === "edited" || cached.model === DRAFT_MODEL)
        ) {
          return { configured: true, text: cached.body };
        }
      }

      if (!env.OPENAI_API_KEY) {
        return {
          configured: false,
          text: "Draft reply is not configured (set OPENAI_API_KEY).",
        };
      }

      const tenant = corsair.withTenant(userId);
      const sourceMessage =
        (await getCachedMessage(tenant, input.messageId)) ??
        normalizeGmailMessage(
          (await tenant.gmail.api.messages.get({
            id: input.messageId,
            format: "full",
          })) as CachedGmailMessage,
          input.messageId,
        );
      const sourceText =
        sourceMessage.text?.trim() ||
        (sourceMessage.html ? stripHtml(sourceMessage.html) : "") ||
        sourceMessage.snippet ||
        "";

      const agent = new Agent({
        name: "slotnest-draft-reply",
        model: DRAFT_MODEL,
        instructions: DRAFT_REPLY_INSTRUCTIONS,
      });

      const prompt = `Original email:
From: ${sourceMessage.fromName || sourceMessage.fromEmail} <${sourceMessage.fromEmail}>
Subject: ${sourceMessage.subject}

${sourceText.slice(0, 8000)}

Write the reply body now.`;

      const result = await run(agent, prompt);
      const text = cleanDraftText(result.finalOutput ?? "");

      // Persist for reuse. Overwrites a prior generated/forced draft for this id.
      await db
        .insert(replyDraft)
        .values({
          id,
          userId,
          messageId: input.messageId,
          threadId: sourceMessage.threadId,
          body: text,
          model: DRAFT_MODEL,
          status: "generated",
        })
        .onConflictDoUpdate({
          target: replyDraft.id,
          set: {
            body: text,
            model: DRAFT_MODEL,
            threadId: sourceMessage.threadId,
            status: "generated",
            updatedAt: new Date(),
          },
        });

      return { configured: true, text };
    }),
});
