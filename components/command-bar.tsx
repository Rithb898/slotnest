"use client";

import {
  CalendarDays,
  Inbox,
  Loader2,
  PenLine,
  Plug,
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

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
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

/** `g`-prefixed jump targets — mirrors the hints shown in the bar + sidebar. */
const GOTO: Record<string, Route> = {
  t: "/today",
  i: "/inbox",
  c: "/calendar",
};

const CommandBarContext = createContext<CommandBarContextValue | null>(null);

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

  const ask = api.agent.ask.useMutation({
    onSuccess: (res) => setAnswer(res.text),
    onError: (err) => setAnswer(`Couldn't reach the assistant: ${err.message}`),
  });

  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Global shortcuts: ⌘K opens the bar; `g` then t/i/c jumps to a surface
  // (the chord the command bar advertises). Discoverable, never required —
  // and skipped while typing in any field.
  useEffect(() => {
    let gPressedAt = 0;
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

      const key = e.key.toLowerCase();
      if (key === "g") {
        gPressedAt = Date.now();
        return;
      }
      if (gPressedAt && Date.now() - gPressedAt < 1200 && key in GOTO) {
        e.preventDefault();
        gPressedAt = 0;
        setOpen(false);
        router.push(GOTO[key]);
        return;
      }
      gPressedAt = 0;
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle, router]);

  // Reset transient state whenever the bar closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setAnswer(null);
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

  const runAgent = useCallback(() => {
    if (!trimmed) return;
    setAnswer(null);
    ask.mutate({ prompt: trimmed });
  }, [trimmed, ask]);

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
              <button
                type="button"
                onClick={runAgent}
                className="mx-auto flex items-center gap-2 text-sm"
              >
                <Sparkles className="size-4" />
                Ask SlotNest: &ldquo;{trimmed}&rdquo;
              </button>
            ) : (
              "No matching command."
            )}
          </CommandEmpty>

          {looksLikeSentence ? (
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
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {answer ? (
            <div className="border-t border-border px-3 py-3 text-sm whitespace-pre-wrap text-foreground">
              {answer}
            </div>
          ) : null}

          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => go("/today")}>
              <Sun />
              <span>Today</span>
              <CommandShortcut>g t</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/inbox")}>
              <Inbox />
              <span>Inbox</span>
              <CommandShortcut>g i</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/calendar")}>
              <CalendarDays />
              <span>Calendar</span>
              <CommandShortcut>g c</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/connections")}>
              <Plug />
              <span>Connections</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/inbox")}>
              <PenLine />
              <span>Compose</span>
              <CommandShortcut>c</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandBarContext.Provider>
  );
}
