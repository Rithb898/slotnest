import { Command, Link2, Sparkles, Zap } from "lucide-react";
import { SectionHeading } from "@/components/landing/shared";
import { Reveal } from "@/components/landing/reveal";

const STEPS = [
  {
    icon: Link2,
    title: "Connect your accounts",
    body: "Link Gmail and Google Calendar once with secure Google OAuth. Revoke any time.",
  },
  {
    icon: Sparkles,
    title: "SlotNest triages your inbox",
    body: "Mail is sorted by action and urgency, and replies are drafted in your voice.",
  },
  {
    icon: Command,
    title: "Act from the command bar",
    body: "Hit ⌘K and type plainly — reply, archive, search, schedule. It just runs.",
  },
  {
    icon: Zap,
    title: "Schedule into real free time",
    body: "Find open slots and send invites without ever opening the calendar grid.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal className="max-w-2xl">
        <SectionHeading>
          From cluttered to clear in{" "}
          <em className="font-serif font-normal italic text-honey-ink">
            four steps.
          </em>
        </SectionHeading>
      </Reveal>

      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 80}>
            <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-honey-ink">
                  <s.icon className="size-5" />
                </span>
                <span className="font-serif text-[1.6rem] italic text-border">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-[1.05rem] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
