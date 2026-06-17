import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { parseAddress } from "@/lib/gmail";
import { AGENT_ASK_INSTRUCTIONS } from "@/lib/prompts";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { corsair } from "@/server/corsair";

/**
 * ⌘K natural-language agent (plan 003 step 6).
 *
 * OpenAI Agents SDK + Corsair MCP (`docs/corsair/openai-agents.md`). The agent
 * is given Corsair's `list_operations` / `get_schema` / `run_script` tools and
 * acts ON BEHALF OF the signed-in user.
 *
 * TENANCY (docs/corsair/concepts/multi-tenancy.md): with `multiTenancy: true`,
 * every Corsair operation must go through `withTenant()`. The MCP provider's
 * `run_script` tool executes scripts with whatever `corsair` we pass into
 * `build()` as the in-scope `corsair` variable (verified in
 * node_modules/@corsair-dev/mcp/dist/index.js → `fn(corsair)`). So we pass the
 * tenant-scoped instance `corsair.withTenant(ctx.session.user.id)`; the agent
 * physically cannot reach another user's data. We also set `tenantId` so the
 * provider's setup tool defaults to the same tenant.
 *
 * GRACEFUL DEGRADATION (guardrail): `OPENAI_API_KEY` is OPTIONAL. With no key,
 * this returns `{ configured: false }` rather than throwing.
 *
 * WRITE-GATING CAVEAT (see NOTES): `run_script` is a single general tool that
 * can call ANY Corsair operation, including writes. The documented MCP API
 * exposes no per-tool approval hook here, so draft-then-approve cannot be
 * enforced structurally. We instead constrain the agent via instructions to
 * READ/propose only and to NEVER send or book — and surface its answer for the
 * user to act on through the existing approve-first UI.
 */

export const inviteProposalSchema = z.object({
  kind: z.literal("invite"),
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  attendees: z.array(z.string().email()).default([]),
  description: z.string().optional(),
});

export const replyProposalSchema = z.object({
  kind: z.literal("reply"),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  threadId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  inReplyTo: z.string().min(1).optional(),
  references: z.string().min(1).optional(),
});

// The CLEAN, validated proposal shape used everywhere except the model output
// (stored rows, tRPC return types, UI). A discriminated union is fine here — it
// is never sent to OpenAI.
const agentProposalSchema = z.discriminatedUnion("kind", [
  inviteProposalSchema,
  replyProposalSchema,
]);

export type AgentProposal = z.infer<typeof agentProposalSchema>;

/**
 * Agent OUTPUT proposal schemas. OpenAI structured outputs (strict) reject
 * `oneOf` — what a Zod discriminated union compiles to — and forbid optional
 * fields. So the model sees an `anyOf` (`z.union`) of two branches whose
 * optional fields are `.nullable()` instead, per the OpenAI guide. We validate
 * the chosen branch back into a clean `AgentProposal` with `toAgentProposal`.
 */
const inviteOutputSchema = z.object({
  kind: z.literal("invite"),
  summary: z.string(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()).nullable(),
  description: z.string().nullable(),
});

const replyOutputSchema = z.object({
  kind: z.literal("reply"),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  threadId: z.string().nullable(),
  messageId: z.string().nullable(),
  inReplyTo: z.string().nullable(),
  references: z.string().nullable(),
});

export const proposalOutputUnion = z.union([
  inviteOutputSchema,
  replyOutputSchema,
]);
export type ProposalOutput = z.infer<typeof proposalOutputUnion>;

/** Validate one model-emitted proposal into a clean AgentProposal, or drop it. */
export function toAgentProposal(out: ProposalOutput): AgentProposal | null {
  if (out.kind === "invite") {
    const parsed = inviteProposalSchema.safeParse({
      kind: "invite",
      summary: out.summary,
      start: out.start,
      end: out.end,
      attendees: out.attendees ?? [],
      description: out.description ?? undefined,
    });
    return parsed.success ? parsed.data : null;
  }
  const parsedTo = parseAddress(out.to).email;
  const parsed = replyProposalSchema.safeParse({
    kind: "reply",
    to: parsedTo || out.to,
    subject: out.subject,
    body: out.body,
    threadId: out.threadId ?? undefined,
    messageId: out.messageId ?? undefined,
    inReplyTo: out.inReplyTo ?? undefined,
    references: out.references ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

const agentOutputSchema = z.object({
  text: z.string(),
  proposals: z.array(proposalOutputUnion),
});

export type AgentResult =
  | { configured: false; text: string; proposals: [] }
  | { configured: true; text: string; proposals: AgentProposal[] };

export const agentRouter = createTRPCRouter({
  ask: protectedProcedure
    .input(z.object({ prompt: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }): Promise<AgentResult> => {
      if (!env.OPENAI_API_KEY) {
        return {
          configured: false,
          text: "Agent not configured (set OPENAI_API_KEY).",
          proposals: [],
        };
      }

      const tenant = corsair.withTenant(ctx.session.user.id);
      const provider = new OpenAIAgentsProvider();
      const tools = await provider.build({
        corsair: tenant as unknown as Record<string, unknown>,
        tool,
        tenantId: ctx.session.user.id,
        setup: false,
      });

      const agent = new Agent({
        name: "slotnest-agent",
        model: "gpt-4.1-mini",
        instructions: AGENT_ASK_INSTRUCTIONS,
        tools,
        outputType: agentOutputSchema,
      });

      const result = await run(agent, input.prompt);
      const output = result.finalOutput ?? {
        text: "(no response)",
        proposals: [],
      };
      const proposals = output.proposals
        .map(toAgentProposal)
        .filter((p): p is AgentProposal => p !== null);
      return {
        configured: true,
        text: output.text,
        proposals,
      };
    }),
});
