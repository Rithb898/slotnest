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

export type AgentResult =
  | { configured: false; text: string }
  | { configured: true; text: string };

const INSTRUCTIONS = `You are SlotNest's assistant for a Gmail + Google Calendar workspace.
You have Corsair tools: use list_operations to discover APIs, get_schema to learn arguments, and run_script to read data.
The connected plugins are "gmail" and "googlecalendar". Always reference resources by ID.

STRICT RULES:
- READ ONLY. You may inspect email and calendar data (e.g. gmail.api.messages.list/get, googlecalendar.api.events.getMany, googlecalendar.api.calendar.getAvailability).
- NEVER perform a write: do not send email, create/update/delete events, or change any state. Do not call any operation whose risk is "write".
- If the user asks to send, reply, schedule, book, or invite, DO NOT do it. Instead, gather the relevant details (proposed time, attendees, free slots) and return a clear PROPOSAL the user can approve in the app. Explain that they must confirm it themselves.
- Be concise. Return plain text suitable for a small result panel.`;

export const agentRouter = createTRPCRouter({
  ask: protectedProcedure
    .input(z.object({ prompt: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }): Promise<AgentResult> => {
      if (!env.OPENAI_API_KEY) {
        return {
          configured: false,
          text: "Agent not configured (set OPENAI_API_KEY).",
        };
      }

      // Imported lazily so the optional peer deps never load at module init and
      // the app stays bootable without the agent SDK present.
      const { OpenAIAgentsProvider } = await import("@corsair-dev/mcp");
      const { Agent, run, tool } = await import("@openai/agents");

      const tenant = corsair.withTenant(ctx.session.user.id);
      const provider = new OpenAIAgentsProvider();
      // `build()` is documented async; await is safe even if it returns sync.
      const tools = await provider.build({
        corsair: tenant as unknown as Record<string, unknown>,
        tool,
        tenantId: ctx.session.user.id,
        setup: false,
      });

      const agent = new Agent({
        name: "slotnest-agent",
        model: "gpt-4.1",
        instructions: INSTRUCTIONS,
        tools,
      });

      const result = await run(agent, input.prompt);
      return {
        configured: true,
        text: result.finalOutput ?? "(no response)",
      };
    }),
});
