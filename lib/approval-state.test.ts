import assert from "node:assert/strict";

import {
  type ApprovalStateRecord,
  approvalStateKey,
  filterMessagesByApprovalState,
  getApprovalTarget,
  isMessageHiddenByApprovalState,
  latestThreadActivity,
} from "@/lib/approval-state";

const messages = [
  {
    id: "msg-1",
    threadId: "thread-1",
    date: "2026-06-18T08:00:00.000Z",
  },
  {
    id: "msg-2",
    threadId: "thread-1",
    date: "2026-06-18T10:00:00.000Z",
  },
  {
    id: "msg-3",
    threadId: null,
    date: "2026-06-18T09:00:00.000Z",
  },
];

const latestByThread = latestThreadActivity(messages);

assert.equal(latestByThread.get("thread-1"), Date.parse(messages[1].date));

const threadState: ApprovalStateRecord = {
  ...getApprovalTarget({ messageId: "msg-1", threadId: "thread-1" }),
  state: "done",
  sourceInternalDate: "2026-06-18T10:00:00.000Z",
  snoozedUntil: null,
};

assert.equal(
  isMessageHiddenByApprovalState(
    messages[0],
    threadState,
    latestByThread,
    new Date("2026-06-18T11:00:00.000Z"),
  ),
  true,
);

assert.equal(
  isMessageHiddenByApprovalState(
    messages[0],
    {
      ...threadState,
      sourceInternalDate: "2026-06-18T09:00:00.000Z",
    },
    latestByThread,
    new Date("2026-06-18T11:00:00.000Z"),
  ),
  false,
);

const snoozedState: ApprovalStateRecord = {
  ...getApprovalTarget({ messageId: "msg-3", threadId: null }),
  state: "snoozed",
  sourceInternalDate: "2026-06-18T09:00:00.000Z",
  snoozedUntil: "2026-06-19T09:00:00.000Z",
};

assert.equal(
  isMessageHiddenByApprovalState(
    messages[2],
    snoozedState,
    latestByThread,
    new Date("2026-06-18T11:00:00.000Z"),
  ),
  true,
);

assert.equal(
  isMessageHiddenByApprovalState(
    messages[2],
    snoozedState,
    latestByThread,
    new Date("2026-06-19T10:00:00.000Z"),
  ),
  false,
);

const filtered = filterMessagesByApprovalState(messages, [
  threadState,
  snoozedState,
]);
assert.deepEqual(
  filtered.map((message) => message.id),
  [],
);

const visibleAfterWake = filterMessagesByApprovalState(messages, [
  {
    ...threadState,
    sourceInternalDate: "2026-06-18T09:00:00.000Z",
  },
  {
    ...snoozedState,
    snoozedUntil: "2026-06-18T08:00:00.000Z",
  },
]);
assert.deepEqual(
  visibleAfterWake.map((message) =>
    approvalStateKey(
      getApprovalTarget({
        messageId: message.id,
        threadId: message.threadId,
      }).targetKind,
      getApprovalTarget({
        messageId: message.id,
        threadId: message.threadId,
      }).targetId,
    ),
  ),
  ["thread:thread-1", "thread:thread-1", "message:msg-3"],
);

console.log("approval-state tests passed");
