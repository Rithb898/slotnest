"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

const FAQS = [
  {
    q: "What exactly is SlotNest?",
    a: "A keyboard-first command center for Gmail and Google Calendar. It triages your inbox, drafts replies in your voice, and finds real free slots on your calendar — all from one ⌘K command bar that understands plain language.",
  },
  {
    q: "Do I need to learn keyboard shortcuts?",
    a: 'No. Every action has an obvious button, and the command bar takes plain English ("reply to Priya", "find time with Marco"). Shortcuts are there when you want to go faster — never required.',
  },
  {
    q: "Is my email and calendar data secure?",
    a: "SlotNest connects through Google's official OAuth — you grant access, and you can revoke it any time. We never see your password, and your data is scoped to your account alone.",
  },
  {
    q: "Which accounts does it work with?",
    a: "Gmail and Google Calendar today. You connect each once, and SlotNest keeps a fast local copy so search and triage feel instant.",
  },
  {
    q: "Will it send email on my behalf?",
    a: "Only when you say so. Replies and invites are drafted for you to review — nothing leaves your account until you press send.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <ul className="divide-y divide-border border-y border-border">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const btnId = `${baseId}-btn-${i}`;
        return (
          <li key={item.q}>
            <h3>
              <button
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="text-[1.05rem] font-medium text-foreground">
                  {item.q}
                </span>
                <Plus
                  className={`size-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
                    isOpen ? "rotate-45" : ""
                  }`}
                />
              </button>
            </h3>
            <section
              id={panelId}
              aria-labelledby={btnId}
              aria-hidden={!isOpen}
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="max-w-[65ch] pb-6 pr-10 text-[0.975rem] leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </div>
            </section>
          </li>
        );
      })}
    </ul>
  );
}
