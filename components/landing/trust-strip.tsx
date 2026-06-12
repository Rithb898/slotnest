import { Check } from "lucide-react";

export function TrustStrip() {
  const items = [
    "Connects securely with Google OAuth",
    "AI triage by action & urgency",
    "Replies drafted in your voice",
    "Real free-slot scheduling",
    "Instant local search",
    "Keyboard-first, mouse-optional",
  ];
  const doubled = ["a", "b"].flatMap((copy) =>
    items.map((t) => ({ key: `${copy}-${t}`, t })),
  );
  return (
    <section
      aria-label="What SlotNest does"
      className="border-y border-border bg-secondary/60 py-4"
    >
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <ul className="marquee-track gap-8" aria-hidden>
          {doubled.map(({ key, t }) => (
            <li
              key={key}
              className="flex shrink-0 items-center gap-2 text-[0.85rem] font-medium text-muted-foreground"
            >
              <Check className="size-3.5 text-honey-ink" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
