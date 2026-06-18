import { run } from "@openai/agents";

import { reserveAiActionBudget } from "@/server/billing/ai-action-budget";

type BudgetedAgentCallInput = {
  db: typeof import("@/server/db").db;
  userId: string;
  actionKind: string;
  source: string;
  model: string;
  agent: any;
  input: string;
  reserveBudget?: any;
  runAgent?: (agent: any, input: string) => Promise<any>;
};

export async function reserveAndRunAgentCall({
  db,
  userId,
  actionKind,
  source,
  model,
  agent,
  input,
  reserveBudget = reserveAiActionBudget,
  runAgent = run,
}: BudgetedAgentCallInput): Promise<any> {
  await reserveBudget(db, userId, {
    actionKind,
    source,
    model,
  });
  return runAgent(agent, input);
}
