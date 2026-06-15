import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { env } from "@/lib/config/env";
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

const inviteProposalSchema = z.object({
  kind: z.literal("invite"),
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  attendees: z.array(z.string().email()).default([]),
  description: z.string().optional(),
});

const replyProposalSchema = z.object({
  kind: z.literal("reply"),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  threadId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  inReplyTo: z.string().min(1).optional(),
  references: z.string().min(1).optional(),
});

const agentProposalSchema = z.discriminatedUnion("kind", [
  inviteProposalSchema,
  replyProposalSchema,
]);

const agentOutputSchema = z.object({
  text: z.string().min(1),
  proposals: z.array(agentProposalSchema).max(4).default([]),
});

export type AgentProposal = z.infer<typeof agentProposalSchema>;

export type AgentResult =
  | { configured: false; text: string; proposals: [] }
  | { configured: true; text: string; proposals: AgentProposal[] };

const INSTRUCTIONS = `You are SlotNest's assistant for a Gmail + Google Calendar workspace.
You have Corsair tools: use list_operations to discover APIs, get_schema to learn arguments, and run_script to read data.
The connected plugins are "gmail" and "googlecalendar". Always reference resources by ID.

STRICT RULES:
- READ ONLY. You may inspect email and calendar data (e.g. gmail.api.messages.list/get, googlecalendar.api.events.getMany, googlecalendar.api.calendar.getAvailability).
- NEVER perform a write: do not send email, create/update/delete events, or change any state. Do not call any operation whose risk is "write".
- If the user asks to send, reply, schedule, book, or invite, DO NOT do it. Instead, gather the relevant details (proposed time, attendees, free slots) and return proposals the user can approve in the app.
- Return structured output with:
  - text: concise plain text for a small result panel.
  - proposals: zero or more proposed actions.
- For invite proposals, include ISO datetime strings for start/end, a title, and attendee email addresses.
- For reply proposals, include to, subject, body, and include threadId/messageId/inReplyTo/references when known from Gmail.
- If one sentence implies both a calendar invite and an email, return both proposals.
- If required details are missing, explain what is missing in text and omit that proposal.`;

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
        instructions: INSTRUCTIONS,
        tools,
        outputType: agentOutputSchema,
      });

      const result = await run(agent, input.prompt);
      const output = result.finalOutput ?? {
        text: "(no response)",
        proposals: [],
      };
      return {
        configured: true,
        text: output.text,
        proposals: output.proposals,
      };
    }),
});
