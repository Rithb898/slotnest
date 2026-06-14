"use client";

import {
  CalendarDays,
  Inbox,
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

/**
 * Global ⌘K command bar (DESIGN: "Command Bar (signature component)").
 *
 * For this version it handles DISCRETE commands + navigation only — fuzzy
 * search over Go-to-Today/Inbox/Calendar, Compose, etc. with mono shortcut
 * hints right-aligned and the honey selection rail on the active result
 * (cmdk applies `data-[selected]` styling via components/ui/command.tsx).
 *
 * NATURAL-LANGUAGE SEAM: the Agent (OpenAI Agents SDK + Corsair MCP) is NOT
 * wired here. When `query` is a free-form sentence rather than a command, the
 * intended behavior is to route it to the Agent. That integration is deferred;
 * the seam is marked below with `runAgent`.
 */

type CommandBarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
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

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const go = useCallback(
    (href: Route) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  // --- Agent seam (deferred) ---------------------------------------------
  // When natural-language routing lands, a free-form `query` would be handed
  // to the Agent here instead of matched against discrete commands. Left
  // intentionally unwired for this version.
  // function runAgent(sentence: string) { /* route to Agent (deferred) */ }

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
          <CommandEmpty>No matching command.</CommandEmpty>
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
            {/* Natural-language requests route to the Agent (deferred). */}
            <CommandItem disabled>
              <Sparkles />
              <span>Ask SlotNest… (coming soon)</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandBarContext.Provider>
  );
}
