"use client";

import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  History,
  Loader2,
  Mail,
  MessageSquarePlus,
  PanelRightOpen,
  Plug,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";

/**
 * Chat (plan 011): the conversational front door to the Agent.
 *
 * The agent is read-only server-side (ADR 0001): it shows its work as typed
 * messages (text, email_list, approval) and ends outbound actions in an
 * approval card. The actual send/book runs through the existing deterministic
 * dialogs (ReplyDialog / InviteDialog) on a human keypress, never the agent.
 */

type ChatMessage = RouterOutputs["chat"]["send"]["messages"][number];

const SUGGESTIONS = [
  "Find emails that need a reply",
  "What am I waiting on a reply for?",
  "When am I free on Thursday?",
];

function formatDate(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatHistoryDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ChatClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("c");

  const [conversationId, setConversationId] = useState<string | null>(
    initialId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
  const hydratedConversationRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversations = api.chat.conversations.useQuery();
  const markApprovalSent = api.chat.markApprovalSent.useMutation();
  const connections = api.connections.list.useQuery();
  const billingEnabled =
    connections.isSuccess && (connections.data?.length ?? 0) > 0;
  const billing = api.billing.summary.useQuery(undefined, {
    enabled: billingEnabled,
  });
  const gmailConnected = connections.data?.includes("gmail") ?? false;
  const calendarConnected =
    connections.data?.includes("googlecalendar") ?? false;
  const hasAnyConnection = gmailConnected || calendarConnected;
  const aiBudget = billing.data?.aiActionBudget ?? null;
  const aiBudgetExhausted = aiBudget?.exhausted ?? false;
  const canUpgrade = billing.data?.currentPlan.name !== "pro";

  const history = api.chat.messages.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: Boolean(conversationId) },
  );

  // Seed the thread from server history only when a conversation is first
  // loaded/switched. Mutation responses already return the canonical new rows.
  const send = api.chat.send.useMutation();
  useEffect(() => {
    if (!conversationId || !history.data) return;
    if (hydratedConversationRef.current === conversationId) return;
    setMessages(history.data.messages);
    hydratedConversationRef.current = conversationId;
  }, [conversationId, history.data]);

  // Keep pinned to the newest message.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on count + pending
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, send.isPending]);

  function submit(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || send.isPending || !hasAnyConnection) {
      if (!hasAnyConnection) {
        toast.error("Connect Gmail or Calendar first.");
      }
      return;
    }
    if (aiBudgetExhausted) {
      toast.error("AI action budget exhausted.", {
        description: "Upgrade to keep using Chat.",
      });
      return;
    }
    setInput("");
    const optimisticId = `optimistic-${Date.now()}`;
    // Optimistic user bubble; the canonical row arrives with the response.
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: "user",
        type: "text",
        content: { text: trimmed },
        createdAt: new Date(),
      } as ChatMessage,
    ]);
    send.mutate(
      { conversationId: conversationId ?? undefined, prompt: trimmed },
      {
        onSuccess: (res) => {
          if (res.conversationId !== conversationId) {
            setConversationId(res.conversationId);
            window.history.replaceState(
              null,
              "",
              `/chat?c=${res.conversationId}`,
            );
          }
          setMessages((prev) => {
            const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
            return [...withoutOptimistic, ...res.messages];
          });
          hydratedConversationRef.current = res.conversationId;
          void conversations.refetch();
        },
        onError: (err) => {
          toast.error("Couldn't send message", { description: err.message });
        },
      },
    );
  }

  function openConversation(id: string) {
    if (id === conversationId) return;
    hydratedConversationRef.current = null;
    setConversationId(id);
    setMessages([]);
    router.replace(`/chat?c=${id}`);
  }

  function newChat() {
    hydratedConversationRef.current = null;
    setConversationId(null);
    setMessages([]);
    setInput("");
    router.replace("/chat");
  }

  function approve(message: Extract<ChatMessage, { type: "approval" }>) {
    const proposal = message.content.proposal;
    if (message.content.status === "sent") return;
    if (proposal.kind === "invite") {
      setInviteDraft({
        summary: proposal.summary,
        start: proposal.start,
        end: proposal.end,
        attendees: proposal.attendees,
        description: proposal.description,
      });
      setInviteOpen(true);
      return;
    }
    setActiveApprovalId(message.id);
    setReplyDraft({
      to: proposal.to,
      subject: proposal.subject,
      body: proposal.body,
      threadId: proposal.threadId ?? null,
      messageId: proposal.messageId,
      inReplyTo: proposal.inReplyTo,
      references: proposal.references,
    });
    setReplyOpen(true);
  }

  function markActiveApprovalSent() {
    if (!activeApprovalId) return;
    const sentAt = new Date().toISOString();
    const messageId = activeApprovalId;
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId || message.type !== "approval") {
          return message;
        }
        return {
          ...message,
          content: { ...message.content, status: "sent", sentAt },
        };
      }),
    );
    markApprovalSent.mutate({ messageId });
    setActiveApprovalId(null);
  }

  const isEmpty = messages.length === 0 && !send.isPending;
  const chatLocked = connections.isSuccess && !hasAnyConnection;
  const disconnected = chatLocked;
  const missingGmail = connections.isSuccess && !gmailConnected;
  const missingCalendar = connections.isSuccess && !calendarConnected;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary),transparent_84%),transparent_34rem),linear-gradient(180deg,color-mix(in_oklch,var(--muted),transparent_35%),transparent_18rem)]">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 px-3 py-3 backdrop-blur-xl sm:px-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-honey-ink shadow-sm sm:flex">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">
                Ask SlotNest
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {chatLocked
                  ? "Connect Gmail or Calendar to start chatting"
                  : conversationId
                    ? "Saved workspace chat"
                    : "New workspace chat"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-background/70 shadow-sm"
                  >
                    <History className="size-4" />
                    History
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Chat history</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {conversations.isLoading ? (
                    <DropdownMenuItem disabled>
                      <Loader2 className="size-4 animate-spin" />
                      Loading chats
                    </DropdownMenuItem>
                  ) : conversations.data && conversations.data.length > 0 ? (
                    conversations.data.map((conversation) => (
                      <DropdownMenuItem
                        key={conversation.id}
                        onClick={() => openConversation(conversation.id)}
                        className={cn(
                          "items-start gap-3 rounded-xl",
                          conversation.id === conversationId && "bg-accent",
                        )}
                      >
                        <MessageSquarePlus className="mt-0.5 size-4" />
                        <span className="min-w-0">
                          <span className="block truncate">
                            {conversation.title || "Untitled chat"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatHistoryDate(conversation.updatedAt)}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No saved chats</DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={newChat}
              disabled={chatLocked}
              className="shadow-sm"
            >
              <MessageSquarePlus className="size-4" />
              New
            </Button>
          </div>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-5"
      >
        {disconnected ? (
          <DisconnectedState />
        ) : isEmpty ? (
          <div className="mx-auto flex h-full max-w-5xl items-center justify-center py-8">
            <div className="grid w-full gap-4 rounded-3xl border border-border/70 bg-card/75 p-4 shadow-[0_24px_80px_color-mix(in_oklch,var(--foreground),transparent_92%)] backdrop-blur-xl sm:p-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="flex min-h-80 flex-col justify-between rounded-2xl border border-border/70 bg-background/70 p-6">
                <div className="space-y-4">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <Sparkles className="size-5" />
                  </span>
                  <div className="space-y-3">
                    <h2 className="max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">
                      Ask for mail, meetings, and follow-ups in one place.
                    </h2>
                    <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                      SlotNest reads your workspace, drafts the next step, and
                      waits for your approval before sending or booking.
                    </p>
                  </div>
                </div>
                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-muted/55 p-3">
                    <Mail className="mb-3 size-4 text-honey-ink" />
                    <p className="text-sm font-medium">Find mail</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Pull up the threads that need attention.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/55 p-3">
                    <Send className="mb-3 size-4 text-honey-ink" />
                    <p className="text-sm font-medium">Draft replies</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Review every message before it goes out.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/55 p-3">
                    <CalendarPlus className="mb-3 size-4 text-honey-ink" />
                    <p className="text-sm font-medium">Plan time</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Turn availability into clear invites.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-4 rounded-2xl bg-primary/10 p-4">
                <div>
                  <p className="text-sm font-medium">Try a starting point</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    These are safe prompts. The final action still needs review.
                  </p>
                </div>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:bg-background active:translate-y-px"
                    >
                      <span>{s}</span>
                      <PanelRightOpen className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-5 pb-4">
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                onApprove={approve}
                onPickEmail={(label) => setInput(label)}
              />
            ))}
            {send.isPending ? (
              <div className="flex items-center gap-3 pl-1 text-sm text-muted-foreground">
                <span className="flex size-9 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
                  <Loader2 className="size-4 animate-spin" />
                </span>
                Thinking...
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-background/90 px-3 py-3 backdrop-blur-xl sm:px-5">
        <div className="mx-auto max-w-4xl">
          {connections.isSuccess &&
          hasAnyConnection &&
          (!gmailConnected || !calendarConnected) ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Chat works best when connected
                </p>
                <p className="text-xs text-muted-foreground">
                  {missingGmail && missingCalendar
                    ? "Connect Gmail and Calendar to let SlotNest read, draft, and schedule."
                    : missingGmail
                      ? "Connect Gmail to let SlotNest read mail and draft replies."
                      : "Connect Calendar to let SlotNest find free slots and schedule meetings."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/settings?tab=connections"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
                >
                  <Plug className="size-4" />
                  Open connections
                </Link>
              </div>
            </div>
          ) : null}
          {connections.isSuccess && hasAnyConnection && aiBudgetExhausted ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium">AI budget exhausted</p>
                <p className="text-xs text-muted-foreground">
                  Chat history stays readable, but new prompts wait until the
                  shared budget resets.
                </p>
              </div>
              {canUpgrade ? (
                <BillingUpgradeButton
                  label="Upgrade to keep chatting"
                  size="sm"
                />
              ) : null}
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="mx-auto flex max-w-4xl items-end gap-2 rounded-3xl border border-border/80 bg-card p-2 shadow-[0_18px_60px_color-mix(in_oklch,var(--foreground),transparent_93%)]"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              placeholder={
                aiBudgetExhausted
                  ? "AI budget exhausted. Upgrade to keep chatting..."
                  : hasAnyConnection
                    ? "Ask SlotNest to find, draft, or schedule..."
                    : "Connect Gmail or Calendar to start chatting..."
              }
              disabled={
                !hasAnyConnection || send.isPending || aiBudgetExhausted
              }
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:text-muted-foreground/70 focus-visible:ring-0 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              variant="default"
              size="icon-lg"
              disabled={
                !input.trim() ||
                send.isPending ||
                !hasAnyConnection ||
                aiBudgetExhausted
              }
              aria-label="Send"
              className="rounded-2xl shadow-sm"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={inviteDraft}
      />
      <ReplyDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        draft={replyDraft}
        onSent={markActiveApprovalSent}
      />
    </div>
  );
}

function DisconnectedState() {
  return (
    <div className="mx-auto flex h-full max-w-5xl items-center justify-center py-8">
      <div className="grid w-full gap-4 rounded-3xl border border-border/70 bg-card/75 p-4 shadow-[0_24px_80px_color-mix(in_oklch,var(--foreground),transparent_92%)] backdrop-blur-xl sm:p-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="flex min-h-80 flex-col justify-between rounded-2xl border border-border/70 bg-background/70 p-6">
          <div className="space-y-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-5" />
            </span>
            <div className="space-y-3">
              <h2 className="max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">
                Connect Gmail or Calendar to start chatting.
              </h2>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                SlotNest only chats when it has something real to read. Once
                connected, it can find mail, draft replies, and propose meeting
                times with approval steps.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/55 p-3">
              <Mail className="mb-3 size-4 text-honey-ink" />
              <p className="text-sm font-medium">Gmail</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Read threads and draft replies.
              </p>
            </div>
            <div className="rounded-2xl bg-muted/55 p-3">
              <CalendarDays className="mb-3 size-4 text-honey-ink" />
              <p className="text-sm font-medium">Calendar</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Find open slots and propose invites.
              </p>
            </div>
            <div className="rounded-2xl bg-muted/55 p-3">
              <Plug className="mb-3 size-4 text-honey-ink" />
              <p className="text-sm font-medium">Connections</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Connect from Settings to unlock chat.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-primary/10 p-4">
          <div>
            <p className="text-sm font-medium">Connect first</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Chat is gated until SlotNest can read Gmail or Calendar.
            </p>
          </div>
          <div className="grid gap-2">
            <Link
              href="/settings?tab=connections"
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:bg-background active:translate-y-px"
            >
              <span>Go to Settings</span>
              <PanelRightOpen className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="px-1 text-xs text-muted-foreground">
              If you already connected one provider, you can still chat with the
              available surface.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onApprove,
  onPickEmail,
}: {
  message: ChatMessage;
  onApprove: (message: Extract<ChatMessage, { type: "approval" }>) => void;
  onPickEmail: (label: string) => void;
}) {
  if (message.type === "text") {
    const isUser = message.role === "user";
    return (
      <div
        className={cn(
          "flex items-start gap-3",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        {!isUser ? (
          <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-honey-ink shadow-sm">
            <Sparkles className="size-4" />
          </span>
        ) : null}
        <div
          className={cn(
            "max-w-[86%] whitespace-pre-wrap px-4 py-3 text-sm leading-6 shadow-sm",
            isUser
              ? "rounded-[1.35rem] rounded-tr-md bg-primary text-primary-foreground"
              : "rounded-[1.35rem] rounded-tl-md border border-border/70 bg-card text-foreground",
          )}
        >
          {message.content.text}
        </div>
        {isUser ? (
          <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-xs font-semibold text-honey-ink">
            You
          </span>
        ) : null}
      </div>
    );
  }

  if (message.type === "email_list") {
    return (
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-honey-ink shadow-sm">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Mail found</p>
              {message.content.intro ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {message.content.intro}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {message.content.emails.length} email
                {message.content.emails.length === 1 ? "" : "s"} ready for
                review
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border/70">
            {message.content.emails.map((email, index) => (
              <li key={email.id}>
                <button
                  type="button"
                  onClick={() =>
                    onPickEmail(
                      `Reply to the email from ${email.fromName || email.fromEmail} about "${email.subject}"`,
                    )
                  }
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/45"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {email.subject}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(email.date)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {email.fromName || email.fromEmail}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {email.snippet}
                    </span>
                  </span>
                  <PanelRightOpen className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // approval
  const proposal = message.content.proposal;
  const sent = message.content.status === "sent";
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
          sent
            ? "border-success/30 bg-success-subtle text-success"
            : "border-border/70 bg-card text-honey-ink",
        )}
      >
        {sent ? (
          <CheckCircle2 className="size-4" />
        ) : proposal.kind === "invite" ? (
          <CalendarPlus className="size-4" />
        ) : (
          <Send className="size-4" />
        )}
      </span>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-3xl border p-4 shadow-sm",
          sent
            ? "border-success/25 bg-success-subtle/45"
            : "border-border/70 bg-card",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {proposal.kind === "invite" ? (
                <CalendarPlus className="size-4 text-muted-foreground" />
              ) : (
                <Mail className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">
                {proposal.kind === "invite"
                  ? proposal.summary
                  : proposal.subject}
              </span>
            </div>
            {proposal.kind === "invite" ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {formatDateTime(proposal.start)} -{" "}
                  {formatDateTime(proposal.end)}
                </p>
                {proposal.attendees.length > 0 ? (
                  <p className="truncate">{proposal.attendees.join(", ")}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="truncate text-xs text-muted-foreground">
                  To {proposal.to}
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap leading-6 text-foreground/90">
                  {proposal.body}
                </p>
                {sent ? (
                  <p className="text-xs font-medium text-success">
                    Sent to Gmail.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant={sent ? "outline" : "secondary"}
            disabled={sent}
            onClick={() => onApprove(message)}
            className="shrink-0"
          >
            {sent ? (
              <CheckCircle2 className="size-4" />
            ) : proposal.kind === "invite" ? (
              <CalendarPlus className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {sent ? "Sent" : "Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
