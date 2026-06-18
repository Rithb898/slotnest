"use client";

import {
  CalendarDays,
  CalendarPlus,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  PenLine,
  Plug,
  Search,
  Send,
  Sparkles,
  Sun,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
import { InviteDialog, type InviteDraft } from "@/components/invite-dialog";
import { ReplyDialog, type ReplyDraft } from "@/components/reply-dialog";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { RouterOutputs } from "@/trpc/react";
import { api } from "@/trpc/react";

/**
 * Global ⌘K command bar (DESIGN: "Command Bar (signature component)").
 *
 * Two paths:
 *  1. DISCRETE commands — fuzzy nav (Today/Inbox/Calendar) + Compose.
 *  2. NATURAL LANGUAGE — when the query is a free-form sentence, "Ask SlotNest"
 *     hands it to the agent (`api.agent.ask`, OpenAI Agents SDK + Corsair MCP,
 *     plan 003 step 6). The agent is tenant-scoped server-side and read-only by
 *     instruction; its answer renders inline. If OPENAI_API_KEY is unset it
 *     degrades to "Agent not configured" rather than failing.
 *
 * The agent NEVER books or sends on its own — scheduling actions stay behind
 * the approve-first UI (/calendar, /inbox "→ Invite").
 */

type CommandBarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandBarContext = createContext<CommandBarContextValue | null>(null);

type AgentProposal = RouterOutputs["agent"]["ask"]["proposals"][number];

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

function formatSearchDate(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Imperative handle so other surfaces (e.g. /today "Ask SlotNest") can open ⌘K. */
export function useCommandBar() {
  const ctx = useContext(CommandBarContext);
  if (!ctx) {
    throw new Error("useCommandBar must be used within <CommandBar>");
  }
  return ctx;
}

export function CommandBar({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [mailSearchQuery, setMailSearchQuery] = useState("");
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const connections = api.connections.list.useQuery();
  const billingEnabled =
    connections.isSuccess && (connections.data?.length ?? 0) > 0;
  const billing = api.billing.summary.useQuery(undefined, {
    enabled: billingEnabled,
  });
  const aiBudget = billing.data?.aiActionBudget ?? null;
  const aiBudgetExhausted = aiBudget?.exhausted ?? false;
  const canUpgrade = billing.data?.currentPlan.name !== "pro";

  const ask = api.agent.ask.useMutation({
    onSuccess: (res) => {
      setAnswer(res.text);
      setProposals(res.proposals);
    },
    onError: (err) => {
      setAnswer(`Couldn't reach the assistant: ${err.message}`);
      setProposals([]);
    },
  });

  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Global shortcut: ⌘K opens the bar, and it stays inactive while typing in
  // editable fields.
  useEffect(() => {
    function isEditable(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Reset transient state whenever the bar closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setAnswer(null);
      setProposals([]);
      ask.reset();
    }
  }, [open, ask.reset]);

  const go = useCallback(
    (href: Route) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Natural-language path: hand the sentence to the agent (server tenant-scopes
  // + keeps it read-only). A "sentence" is anything with whitespace or > ~3 words.
  const trimmed = query.trim();
  const looksLikeSentence = trimmed.length > 0 && /\s/.test(trimmed);
  const shouldSearchMail = trimmed.length >= 2;

  useEffect(() => {
    if (!(open && shouldSearchMail)) {
      setMailSearchQuery("");
      return;
    }

    const timer = window.setTimeout(() => setMailSearchQuery(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [open, shouldSearchMail, trimmed]);

  const mailSearch = api.gmail.search.useQuery(
    { q: mailSearchQuery || " ", limit: 6 },
    {
      enabled: open && mailSearchQuery.length >= 2,
      staleTime: 30_000,
    },
  );

  const runAgent = useCallback(() => {
    if (!trimmed) return;
    if (aiBudgetExhausted) {
      setAnswer("AI action budget exhausted. Upgrade to keep asking SlotNest.");
      setProposals([]);
      return;
    }
    setAnswer(null);
    setProposals([]);
    ask.mutate({ prompt: trimmed });
  }, [trimmed, ask, aiBudgetExhausted]);

  const approveProposal = useCallback((proposal: AgentProposal) => {
    setOpen(false);
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
  }, []);

  return (
    <CommandBarContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      >
        <CommandInput
          placeholder="Type a command, or ask SlotNest…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {trimmed ? (
              aiBudgetExhausted ? (
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-2 text-center">
                  <p className="text-sm font-medium">AI budget exhausted</p>
                  <p className="text-xs text-muted-foreground">
                    Upgrade to keep asking SlotNest.
                  </p>
                  {canUpgrade ? (
                    <BillingUpgradeButton
                      label="Upgrade now"
                      size="sm"
                      className="mt-1"
                    />
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={runAgent}
                  className="mx-auto flex items-center gap-2 text-sm"
                >
                  <Sparkles className="size-4" />
                  Ask SlotNest: &ldquo;{trimmed}&rdquo;
                </button>
              )
            ) : (
              "No matching command."
            )}
          </CommandEmpty>

          {looksLikeSentence && !aiBudgetExhausted ? (
            <CommandGroup heading="Ask SlotNest">
              <CommandItem
                // Force-match so cmdk keeps it visible for any sentence.
                value={`ask ${trimmed}`}
                onSelect={runAgent}
                disabled={ask.isPending}
              >
                {ask.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                <span className="truncate">
                  {ask.isPending ? "Thinking…" : `Ask: "${trimmed}"`}
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {looksLikeSentence && aiBudgetExhausted ? (
            <div className="border-t border-border px-3 py-3">
              <div className="rounded-2xl border border-border bg-muted/30 px-3 py-3 text-sm">
                <div className="font-medium">AI budget exhausted</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Upgrade to keep asking SlotNest.
                </div>
                {canUpgrade ? (
                  <BillingUpgradeButton
                    label="Upgrade now"
                    size="sm"
                    className="mt-3"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {answer ? (
            <div className="border-t border-border px-3 py-3 text-sm whitespace-pre-wrap text-foreground">
              {answer}
            </div>
          ) : null}

          {proposals.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
              {proposals.map((proposal, index) => {
                const key = `${proposal.kind}-${index}`;
                return (
                  <div
                    key={key}
                    className="rounded-md border border-border bg-muted/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
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
                              <p className="truncate">
                                {proposal.attendees.join(", ")}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p className="truncate">To {proposal.to}</p>
                            <p className="line-clamp-2 whitespace-pre-wrap">
                              {proposal.body}
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => approveProposal(proposal)}
                      >
                        {proposal.kind === "invite" ? (
                          <CalendarPlus className="size-4" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Approve
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {shouldSearchMail ? (
            <CommandGroup heading="Mail">
              {mailSearch.isPending ? (
                <CommandItem value={`search-loading ${trimmed}`} disabled>
                  <Loader2 className="animate-spin" />
                  <span>Searching mail…</span>
                </CommandItem>
              ) : null}
              {mailSearch.data?.results.map((result) => (
                <CommandItem
                  key={result.id}
                  value={`mail ${result.id} ${result.subject} ${result.fromEmail}`}
                  onSelect={() => go("/inbox")}
                  className="border-l-2 border-l-transparent data-[selected=true]:border-l-amber-500"
                >
                  <Search />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {result.subject}
                      </span>
                      {result.matchedBy.includes("semantic") ? (
                        <Sparkles className="size-3 shrink-0 text-amber-600" />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {result.fromName || result.fromEmail}
                      </span>
                      <span className="shrink-0">
                        {formatSearchDate(result.date)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => go("/today")}>
              <Sun />
              <span>Today</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/chat")}>
              <MessageSquare />
              <span>Chat</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/inbox")}>
              <Inbox />
              <span>Inbox</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/calendar")}>
              <CalendarDays />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/drafts")}>
              <PenLine />
              <span>Drafts</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/waiting")}>
              <Send />
              <span>Waiting</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Plug />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            {looksLikeSentence ? (
              <CommandItem
                value={`proposal ${trimmed}`}
                onSelect={runAgent}
                disabled={ask.isPending}
              >
                <Sparkles />
                <span className="truncate">Prepare approval proposal</span>
              </CommandItem>
            ) : null}
            <CommandItem onSelect={() => go("/inbox")}>
              <PenLine />
              <span>Compose</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
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
    </CommandBarContext.Provider>
  );
}
