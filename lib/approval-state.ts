export type ApprovalTargetKind = "thread" | "message";

export type ApprovalStateValue = "done" | "skipped" | "snoozed" | "resolved";

export type ApprovalTarget = {
  targetKind: ApprovalTargetKind;
  targetId: string;
  threadId: string | null;
  messageId: string | null;
};

export type ApprovalStateRecord = ApprovalTarget & {
  state: ApprovalStateValue;
  sourceInternalDate: Date | string | null;
  snoozedUntil: Date | string | null;
};

export type ApprovalVisibilityMessage = {
  id: string;
  threadId: string | null;
  date: Date | string | null;
};

function toTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function getApprovalTarget(input: {
  messageId: string;
  threadId?: string | null;
}): ApprovalTarget {
  if (input.threadId) {
    return {
      targetKind: "thread",
      targetId: input.threadId,
      threadId: input.threadId,
      messageId: input.messageId,
    };
  }

  return {
    targetKind: "message",
    targetId: input.messageId,
    threadId: null,
    messageId: input.messageId,
  };
}

export function approvalStateId(
  userId: string,
  targetKind: ApprovalTargetKind,
  targetId: string,
) {
  return `${userId}:${targetKind}:${targetId}`;
}

export function approvalStateKey(
  targetKind: ApprovalTargetKind,
  targetId: string,
) {
  return `${targetKind}:${targetId}`;
}

export function latestThreadActivity(
  messages: ApprovalVisibilityMessage[],
): Map<string, number> {
  const latest = new Map<string, number>();
  for (const message of messages) {
    if (!message.threadId) continue;
    const time = toTime(message.date);
    if (time === null) continue;
    const existing = latest.get(message.threadId);
    if (existing === undefined || time > existing) {
      latest.set(message.threadId, time);
    }
  }
  return latest;
}

export function isMessageHiddenByApprovalState(
  message: ApprovalVisibilityMessage,
  state: ApprovalStateRecord | undefined,
  latestByThread: Map<string, number>,
  now = new Date(),
) {
  if (!state) return false;

  if (state.state === "snoozed") {
    const snoozedUntil = toTime(state.snoozedUntil);
    return snoozedUntil !== null && snoozedUntil > now.getTime();
  }

  const sourceTime = toTime(state.sourceInternalDate);
  if (!message.threadId || sourceTime === null) {
    return true;
  }

  const latestThreadTime = latestByThread.get(message.threadId);
  return latestThreadTime === undefined || latestThreadTime <= sourceTime;
}

export function filterMessagesByApprovalState<
  T extends ApprovalVisibilityMessage,
>(messages: T[], states: ApprovalStateRecord[], now = new Date()) {
  const latestByThread = latestThreadActivity(messages);
  const statesByTarget = new Map(
    states.map((state) => [
      approvalStateKey(state.targetKind, state.targetId),
      state,
    ]),
  );

  return messages.filter((message) => {
    const target = getApprovalTarget({
      messageId: message.id,
      threadId: message.threadId,
    });
    return !isMessageHiddenByApprovalState(
      message,
      statesByTarget.get(approvalStateKey(target.targetKind, target.targetId)),
      latestByThread,
      now,
    );
  });
}
