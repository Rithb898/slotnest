"use client";

import { CalendarPlus, Loader2, Mail, Send, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";

/**
 * Chat (plan 011) — the conversational front door to the Agent.
 *
 * The agent is read-only server-side (ADR 0001): it shows its work as typed
 * messages (text · email_list · approval) and ends outbound actions in an
 * approval card. The actual send/book runs through the existing deterministic
 * dialogs (ReplyDialog / InviteDialog) on a human keypress — never the agent.
 */

type ChatMessage = RouterOutputs["chat"]["send"]["messages"][number];
type Proposal = Extract<
  ChatMessage,
  { type: "approval" }
>["content"]["proposal"];

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const history = api.chat.messages.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: Boolean(conversationId) },
  );

  // Seed the thread from server history (initial load / reload). Skipped once a
  // turn is in flight so the optimistic bubbles aren't clobbered.
  const send = api.chat.send.useMutation();
  useEffect(() => {
    if (history.data && !send.isPending) setMessages(history.data.messages);
  }, [history.data, send.isPending]);

  // Keep pinned to the newest message.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on count + pending
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, send.isPending]);

  function submit(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || send.isPending) return;
    setInput("");
    // Optimistic user bubble; the canonical row arrives with the response.
    setMessages((prev) => [
      ...prev,
      {
        id: `optimistic-${Date.now()}`,
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
            router.replace(`/chat?c=${res.conversationId}`);
          }
          setMessages((prev) => [
            ...prev,
            ...res.messages.filter((m) => m.role === "assistant"),
          ]);
        },
      },
    );
  }

  function approve(proposal: Proposal) {
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
    if (!proposal.threadId) return;
    setReplyDraft({
      to: proposal.to,
      subject: proposal.subject,
      body: proposal.body,
      threadId: proposal.threadId,
      messageId: proposal.messageId,
      inReplyTo: proposal.inReplyTo,
      references: proposal.references,
    });
    setReplyOpen(true);
  }

  const isEmpty = messages.length === 0 && !send.isPending;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-honey-ink">
                <Sparkles className="size-5" />
              </span>
              <h1 className="text-lg font-semibold">Ask SlotNest</h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                Find emails, draft replies in your voice, and set up meetings —
                in plain English. Nothing sends until you approve.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                onApprove={approve}
                onPickEmail={(label) => setInput(label)}
              />
            ))}
            {send.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking…
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2"
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
            placeholder="Ask SlotNest to find, draft, or schedule…"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            disabled={!input.trim() || send.isPending}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </form>
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
      />
    </div>
  );
}

function MessageRow({
  message,
  onApprove,
  onPickEmail,
}: {
  message: ChatMessage;
  onApprove: (proposal: Proposal) => void;
  onPickEmail: (label: string) => void;
}) {
  if (message.type === "text") {
    const isUser = message.role === "user";
    return (
      <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary/15 text-foreground"
              : "bg-muted/60 text-foreground",
          )}
        >
          {message.content.text}
        </div>
      </div>
    );
  }

  if (message.type === "email_list") {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          <Mail className="size-3.5" />
          {message.content.emails.length} email
          {message.content.emails.length === 1 ? "" : "s"}
        </div>
        <ul className="divide-y divide-border">
          {message.content.emails.map((email, index) => (
            <li key={email.id}>
              <button
                type="button"
                onClick={() =>
                  onPickEmail(
                    `Reply to the email from ${email.fromName || email.fromEmail} about "${email.subject}"`,
                  )
                }
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="mt-0.5 w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {email.subject}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(email.date)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {email.fromName || email.fromEmail} — {email.snippet}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // approval
  const proposal = message.content.proposal;
  const canApprove = proposal.kind === "invite" || Boolean(proposal.threadId);
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {proposal.kind === "invite" ? (
              <CalendarPlus className="size-4 text-muted-foreground" />
            ) : (
              <Mail className="size-4 text-muted-foreground" />
            )}
            <span className="truncate">
              {proposal.kind === "invite" ? proposal.summary : proposal.subject}
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
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="truncate">To {proposal.to}</p>
              <p className="line-clamp-3 whitespace-pre-wrap">
                {proposal.body}
              </p>
              {!proposal.threadId ? (
                <p>Open a Gmail thread before sending.</p>
              ) : null}
            </div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!canApprove}
          onClick={() => onApprove(proposal)}
        >
          {proposal.kind === "invite" ? (
            <CalendarPlus className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          Review
        </Button>
      </div>
    </div>
  );
}
