import { strict as assert } from "node:assert";

import { reserveAndRunAgentCall } from "@/server/billing/budgeted-agent-call";

const callOrder: string[] = [];

const fakeDb = {} as Parameters<typeof reserveAndRunAgentCall>[0]["db"];
const fakeAgent = {} as Parameters<typeof reserveAndRunAgentCall>[0]["agent"];

async function main() {
  await reserveAndRunAgentCall({
    db: fakeDb,
    userId: "user-1",
    actionKind: "chat.send",
    source: "server/api/routers/chat.ts:send",
    model: "gpt-4.1-mini",
    agent: fakeAgent,
    input: "plain turn",
    reserveBudget: async (_db: any, _userId: any, budget: any) => {
      callOrder.push(`reserve:${budget.actionKind}`);
    },
    runAgent: async (_agent: any, input: any) => {
      callOrder.push(`run:${input}`);
      return { finalOutput: "ok" };
    },
  });

  assert.deepEqual(callOrder, ["reserve:chat.send", "run:plain turn"]);

  const replyCallOrder: string[] = [];

  await reserveAndRunAgentCall({
    db: fakeDb,
    userId: "user-1",
    actionKind: "chat.voiceRewrite",
    source: "server/api/routers/chat.ts:draftReplyInVoice",
    model: "gpt-4.1",
    agent: fakeAgent,
    input: "rewrite turn",
    reserveBudget: async (_db: any, _userId: any, budget: any) => {
      replyCallOrder.push(`reserve:${budget.actionKind}`);
    },
    runAgent: async (_agent: any, input: any) => {
      replyCallOrder.push(`run:${input}`);
      return { finalOutput: "" };
    },
  });

  assert.deepEqual(replyCallOrder, [
    "reserve:chat.voiceRewrite",
    "run:rewrite turn",
  ]);

  let exhaustedMessage = "";
  const exhaustedOrder: string[] = [];

  await assert.rejects(
    reserveAndRunAgentCall({
      db: fakeDb,
      userId: "user-1",
      actionKind: "chat.send",
      source: "server/api/routers/chat.ts:send",
      model: "gpt-4.1-mini",
      agent: fakeAgent,
      input: "blocked turn",
      reserveBudget: async () => {
        exhaustedOrder.push("reserve");
        throw new Error("AI action budget exhausted");
      },
      runAgent: async () => {
        exhaustedOrder.push("run");
        return { finalOutput: "should not run" };
      },
    }),
    (error: unknown) => {
      exhaustedMessage =
        error instanceof Error ? error.message : String(error);
      return exhaustedMessage.includes("AI action budget exhausted");
    },
  );

  assert.deepEqual(exhaustedOrder, ["reserve"]);
}

main().catch((error) => {
  throw error;
});
