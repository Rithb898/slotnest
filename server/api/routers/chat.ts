import { randomUUID } from "node:crypto";

import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import { Agent, run, tool } from "@openai/agents";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import { type GmailPayload, getHeader, parseAddress } from "@/lib/gmail";
import {
  CHAT_AGENT_INSTRUCTIONS,
  VOICE_DRAFT_INSTRUCTIONS,
  withCurrentTimeContext,
} from "@/lib/prompts";
import { toReplyReferences, toReplySubject } from "@/lib/reply";
import { searchSentExemplars } from "@/lib/sent-embeddings";
import {
  type AgentProposal,
  proposalOutputUnion,
  toAgentProposal,
} from "@/server/api/routers/agent";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsairReadonly } from "@/server/corsair";
import { db } from "@/server/db";
import {
  chatConversation,
  chatMessage,
  corsairAccounts,
  corsairIntegrations,
} from "@/server/db/schema";

/**
 * Chat — the persistent conversational agent (plan 011, ADR 0001).
 *
 * The agent uses Corsair MCP tools on a tenant-scoped `readonly` Corsair
 * instance — it physically cannot send or book. Outbound actions are emitted as
 * structured proposals, persisted as `approval` messages, and only executed
 * later through the deterministic mutations on a human keypress.
 *
 * Conversation + messages are persisted (tenant-scoped) so references like "the
 * second one" resolve by stored Gmail ID across turns, and history survives a
 * reload.
 */

const CHAT_MODEL = "gpt-4.1-mini"; // cheap: routing + tool loop (plan 010)
const VOICE_MODEL = "gpt-4.1"; // bigger: reply drafting in user voice (swappable)

// Stored/rendered proposal shape (the clean discriminated union from agent.ts).
type Proposal = AgentProposal;

type EmailRef = {
  id: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  date: string | null;
};

type GmailHeaderMessage = {
  id?: string;
  threadId?: string;
  payload?: GmailPayload;
};

// Agent OUTPUT shape uses the `anyOf` proposal union (`z.union`) from agent.ts —
// OpenAI structured outputs support `anyOf` but reject `oneOf`. Each emitted
// proposal is validated back into a clean `Proposal` via `toAgentProposal`.
const chatOutputSchema = z.object({
  text: z.string(),
  proposals: z.array(proposalOutputUnion),
});

type ChatMessagePayload =
  | {
      id: string;
      role: string;
      type: "text";
      content: { text: string };
      createdAt: Date;
    }
  | {
      id: string;
      role: string;
      type: "email_list";
      content: { intro: string | null; emails: EmailRef[] };
      createdAt: Date;
    }
  | {
      id: string;
      role: string;
      type: "approval";
      content: { proposal: Proposal; status?: "sent"; sentAt?: string };
      createdAt: Date;
    };

function cleanBody(text: string): string {
  return text
    .replace(/^```(?:text|plain)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function approvalSuccessText(proposal: Proposal): string {
  if (proposal.kind === "invite") {
    return `Done. I created "${proposal.summary}" on ${formatDay(
      proposal.start,
    )} from ${formatTime(proposal.start)} to ${formatTime(proposal.end)}.`;
  }
  return `Done. I sent the reply to ${proposal.to}.`;
}

/** Render stored history into a transcript the agent reads as context. */
function renderHistory(messages: ChatMessagePayload[]): string {
  return messages
    .map((m) => {
      if (m.type === "text") {
        return `${m.role === "user" ? "User" : "Assistant"}: ${m.content.text}`;
      }
      if (m.type === "email_list") {
        const lines = m.content.emails
          .map(
            (e, i) =>
              `  ${i + 1}. [id=${e.id} threadId=${e.threadId ?? ""}] "${e.subject}" — from ${e.fromName || e.fromEmail} <${e.fromEmail}>`,
          )
          .join("\n");
        return `Assistant showed these emails:\n${lines}`;
      }
      const p = m.content.proposal;
      return `Assistant proposed a ${p.kind} action (awaiting user approval).`;
    })
    .join("\n");
}

/** Refine an agent's first-draft reply body into the user's voice (plan 011). */
async function draftReplyInVoice(
  userId: string,
  proposal: Extract<Proposal, { kind: "reply" }>,
): Promise<string> {
  let exemplars: Awaited<ReturnType<typeof searchSentExemplars>> = [];
  try {
    exemplars = await searchSentExemplars({
      tenantId: userId,
      query: `${proposal.subject}\n${proposal.body}`,
      recipient: proposal.to,
      limit: 3,
    });
  } catch (error) {
    console.warn("Voice exemplar retrieval failed:", error);
  }

  const styleBlock = exemplars.length
    ? `The user's past sent emails (match this voice):\n\n${exemplars
        .map((e, i) => `Example ${i + 1} (to ${e.to}):\n${e.text}`)
        .join("\n\n")}`
    : "No past examples are available — write naturally, do not invent a persona.";

  const agent = new Agent({
    name: "slotnest-voice-drafter",
    model: VOICE_MODEL,
    instructions: VOICE_DRAFT_INSTRUCTIONS,
  });
  const prompt = `Recipient: ${proposal.to}
Subject: ${proposal.subject}

Intended message (rewrite in the user's voice):
${proposal.body}

${styleBlock}

Write the final reply body now.`;

  const result = await run(agent, withCurrentTimeContext(prompt));
  return cleanBody(result.finalOutput ?? "") || proposal.body;
}

async function hydrateReplyProposal(
  userId: string,
  proposal: Extract<Proposal, { kind: "reply" }>,
): Promise<Extract<Proposal, { kind: "reply" }>> {
  if (!proposal.messageId) return proposal;

  try {
    const tenant = corsairReadonly.withTenant(userId);
    const message = (await tenant.gmail.api.messages.get({
      id: proposal.messageId,
      format: "full",
    })) as GmailHeaderMessage;
    const headers = message.payload?.headers;
    const from = parseAddress(getHeader(headers, "From"));
    const subject = getHeader(headers, "Subject");
    const messageIdHeader = getHeader(headers, "Message-ID");
    const references = getHeader(headers, "References");

    return {
      ...proposal,
      to: from.email || proposal.to,
      subject: subject ? toReplySubject(subject) : proposal.subject,
      threadId: message.threadId ?? proposal.threadId,
      inReplyTo: proposal.inReplyTo ?? messageIdHeader,
      references:
        proposal.references ??
        toReplyReferences(references, messageIdHeader) ??
        undefined,
    };
  } catch (error) {
    console.warn("Failed to hydrate chat reply proposal:", error);
    return proposal;
  }
}

async function loadMessages(
  conversationId: string,
): Promise<ChatMessagePayload[]> {
  const rows = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.conversationId, conversationId))
    .orderBy(asc(chatMessage.createdAt));
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    type: row.type,
    content: row.content,
    createdAt: row.createdAt,
  })) as ChatMessagePayload[];
}

async function insertMessage(
  conversationId: string,
  message: Omit<ChatMessagePayload, "id" | "createdAt">,
): Promise<ChatMessagePayload> {
  const id = randomUUID();
  const [row] = await db
    .insert(chatMessage)
    .values({
      id,
      conversationId,
      role: message.role,
      type: message.type,
      content: message.content,
    })
    .returning();
  return {
    id: row.id,
    role: row.role,
    type: row.type,
    content: row.content,
    createdAt: row.createdAt,
  } as ChatMessagePayload;
}

async function getConnectionNames(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ name: corsairIntegrations.name })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(eq(corsairAccounts.tenantId, userId));

  return rows.map((row) => row.name);
}

export const chatRouter = createTRPCRouter({
  conversations: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: chatConversation.id,
        title: chatConversation.title,
        updatedAt: chatConversation.updatedAt,
      })
      .from(chatConversation)
      .where(eq(chatConversation.userId, ctx.session.user.id))
      .orderBy(desc(chatConversation.updatedAt));
  }),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [conversation] = await db
        .select({ id: chatConversation.id })
        .from(chatConversation)
        .where(
          and(
            eq(chatConversation.id, input.conversationId),
            eq(chatConversation.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!conversation) return { messages: [] as ChatMessagePayload[] };
      return { messages: await loadMessages(input.conversationId) };
    }),

  markApprovalSent: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await db
        .select({
          id: chatMessage.id,
          type: chatMessage.type,
          content: chatMessage.content,
          conversationId: chatMessage.conversationId,
        })
        .from(chatMessage)
        .innerJoin(
          chatConversation,
          eq(chatMessage.conversationId, chatConversation.id),
        )
        .where(
          and(
            eq(chatMessage.id, input.messageId),
            eq(chatConversation.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!message || message.type !== "approval") {
        return { updated: false as const };
      }

      const content = message.content as Extract<
        ChatMessagePayload,
        { type: "approval" }
      >["content"];
      if (content.status === "sent") {
        return {
          updated: false as const,
          content,
          assistantMessage: null as ChatMessagePayload | null,
        };
      }

      const nextContent = {
        ...content,
        status: "sent" as const,
        sentAt: new Date().toISOString(),
      };

      await db
        .update(chatMessage)
        .set({ content: nextContent })
        .where(eq(chatMessage.id, input.messageId));

      const assistantMessage = await insertMessage(message.conversationId, {
        role: "assistant",
        type: "text",
        content: { text: approvalSuccessText(content.proposal) },
      });

      await db
        .update(chatConversation)
        .set({ updatedAt: new Date() })
        .where(eq(chatConversation.id, message.conversationId));

      return {
        updated: true as const,
        content: nextContent,
        assistantMessage,
      };
    }),

  send: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().optional(),
        prompt: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const connections = await getConnectionNames(userId);
      if (connections.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect Gmail or Calendar before using Chat.",
        });
      }

      // Resolve (or create) the conversation, verifying ownership.
      let conversationId = input.conversationId ?? null;
      let history: ChatMessagePayload[] = [];
      if (conversationId) {
        const [conversation] = await db
          .select({ id: chatConversation.id })
          .from(chatConversation)
          .where(
            and(
              eq(chatConversation.id, conversationId),
              eq(chatConversation.userId, userId),
            ),
          )
          .limit(1);
        if (!conversation) conversationId = null;
        else history = await loadMessages(conversationId);
      }
      if (!conversationId) {
        conversationId = randomUUID();
        await db.insert(chatConversation).values({
          id: conversationId,
          userId,
          title: input.prompt.slice(0, 60),
        });
      }

      const userMessage = await insertMessage(conversationId, {
        role: "user",
        type: "text",
        content: { text: input.prompt },
      });

      if (!env.OPENAI_API_KEY) {
        const stub = await insertMessage(conversationId, {
          role: "assistant",
          type: "text",
          content: { text: "Agent not configured (set OPENAI_API_KEY)." },
        });
        return {
          conversationId,
          configured: false as const,
          messages: [userMessage, stub],
        };
      }

      const tenant = corsairReadonly.withTenant(userId);
      const provider = new OpenAIAgentsProvider();
      const tools = await provider.build({
        corsair: tenant as unknown as Record<string, unknown>,
        tool,
        tenantId: userId,
        setup: false,
      });

      const agent = new Agent({
        name: "slotnest-chat",
        model: CHAT_MODEL,
        instructions: CHAT_AGENT_INSTRUCTIONS,
        tools,
        outputType: chatOutputSchema,
      });

      const transcript = renderHistory(history);
      const agentInput = transcript
        ? `Conversation so far:\n${transcript}\n\nUser: ${input.prompt}`
        : input.prompt;
      const result = await run(agent, withCurrentTimeContext(agentInput));
      const output = result.finalOutput ?? {
        text: "(no response)",
        proposals: [],
      };

      const newMessages: ChatMessagePayload[] = [userMessage];

      if (output.text.trim()) {
        newMessages.push(
          await insertMessage(conversationId, {
            role: "assistant",
            type: "text",
            content: { text: output.text.trim() },
          }),
        );
      }

      for (const out of output.proposals) {
        const proposal = toAgentProposal(out);
        if (!proposal) continue;
        const finalProposal: Proposal =
          proposal.kind === "reply"
            ? await hydrateReplyProposal(userId, {
                ...proposal,
                body: await draftReplyInVoice(userId, proposal),
              })
            : proposal;
        newMessages.push(
          await insertMessage(conversationId, {
            role: "assistant",
            type: "approval",
            content: { proposal: finalProposal },
          }),
        );
      }

      // Touch updatedAt so the conversation sorts to the top.
      await db
        .update(chatConversation)
        .set({ updatedAt: new Date() })
        .where(eq(chatConversation.id, conversationId));

      return {
        conversationId,
        configured: true as const,
        messages: newMessages,
      };
    }),
});
