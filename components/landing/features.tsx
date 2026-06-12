import { CalendarClock, Check, Reply, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Chip } from "@/components/landing/shared";
import { Reveal } from "@/components/landing/reveal";

export function Features() {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl scroll-mt-20 px-5 py-12 sm:px-8"
    >
      <div className="flex flex-col gap-20 lg:gap-28">
        <FeatureFold
          icon={Sparkles}
          kicker="Triage"
          title={
            <>
              Know what matters{" "}
              <em className="font-serif font-normal italic text-honey-ink">
                at a glance.
              </em>
            </>
          }
          body="Every email is sorted on two axes — what you need to do, and how soon. Needs-reply rises to the top, FYI steps aside, and nothing urgent slips past."
          points={[
            "Action labels: Needs reply · FYI · Ignore",
            "Urgency: Urgent · Normal · Low",
            "A single sortable priority, not a wall of bold",
          ]}
          visual={<TriagePanel />}
        />

        <FeatureFold
          reverse
          icon={Reply}
          kicker="Draft replies"
          title={
            <>
              Replies, already{" "}
              <em className="font-serif font-normal italic text-honey-ink">
                written.
              </em>
            </>
          }
          body="For anything that needs a response, SlotNest prepares a draft in your tone. Read it, tweak a word, send — or rewrite from scratch. You're always the one who hits send."
          points={[
            "Matched to how you actually write",
            "Edit inline before anything sends",
            "Nothing leaves your account unprompted",
          ]}
          visual={<DraftPanel />}
        />

        <FeatureFold
          icon={CalendarClock}
          kicker="Scheduling"
          title={
            <>
              Find time without the{" "}
              <em className="font-serif font-normal italic text-honey-ink">
                back-and-forth.
              </em>
            </>
          }
          body={
            <>
              Say{" "}
              <span className="text-foreground">
                &ldquo;find 30 minutes with Marco this week&rdquo;
              </span>{" "}
              and SlotNest reads your real calendar, proposes open slots, and
              sends the invite — straight from an email if you want.
            </>
          }
          points={[
            "Real free slots, not guesses",
            "Turn an email into an invite in one step",
            "Time and title pulled from the thread",
          ]}
          visual={<SchedulePanel />}
        />
      </div>
    </section>
  );
}

function FeatureFold({
  icon: Icon,
  kicker,
  title,
  body,
  points,
  visual,
  reverse,
}: {
  icon: typeof Reply;
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  points: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={reverse ? "lg:order-2" : ""}>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[0.76rem] font-medium text-muted-foreground">
          <Icon className="size-3.5 text-honey-ink" />
          {kicker}
        </span>
        <h3 className="mt-5 text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.3rem]">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-pretty text-[1.02rem] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[0.95rem]">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-honey-ink">
                <Check className="size-3" strokeWidth={2.5} />
              </span>
              <span className="text-foreground/90">{p}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={100} className={reverse ? "lg:order-1" : ""}>
        <div className="relative">
          <div
            aria-hidden
            className="blob blob--a absolute -inset-6 -z-10 opacity-30"
            style={{ background: "oklch(0.85 0.1 78 / 0.4)" }}
          />
          {visual}
        </div>
      </Reveal>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.4)]">
      {children}
    </div>
  );
}

function TriagePanel() {
  return (
    <Panel>
      <div className="space-y-2">
        {[
          { s: "Priya Nair", c: "reply" as const, u: true },
          { s: "Marco Bianchi", c: "reply" as const, u: false },
          { s: "Figma", c: "fyi" as const, u: false },
          { s: "Stripe", c: "scheduled" as const, u: false },
        ].map((r) => (
          <div
            key={r.s}
            className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5"
          >
            <span className="grid size-7 place-items-center rounded-full bg-secondary text-[0.7rem] font-semibold text-muted-foreground">
              {r.s
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="flex-1 truncate text-[0.85rem] font-medium">
              {r.s}
            </span>
            {r.u && <Chip variant="urgent">Urgent</Chip>}
            {r.c === "reply" && <Chip variant="reply">Needs reply</Chip>}
            {r.c === "fyi" && <Chip variant="fyi">FYI</Chip>}
            {r.c === "scheduled" && <Chip variant="scheduled">Invite</Chip>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DraftPanel() {
  return (
    <Panel>
      <div className="flex items-center gap-2 border-b border-border pb-3 text-[0.8rem] text-muted-foreground">
        <Reply className="size-3.5 text-honey-ink" />
        Draft to <span className="font-medium text-foreground">Priya Nair</span>
        <span className="ml-auto rounded-md bg-primary/15 px-2 py-0.5 text-[0.7rem] font-medium text-honey-ink">
          in your voice
        </span>
      </div>
      <p className="mt-3 text-[0.9rem] leading-relaxed text-foreground/90">
        Hi Priya — Thursday works well on my end. I&apos;ve shifted the review
        to 2:00pm and updated the deck with your edits. Anything else you&apos;d
        like me to fold in before then?
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[0.8rem] font-semibold text-primary-foreground">
          Send <kbd className="font-mono text-[0.68rem] opacity-70">⌘↵</kbd>
        </span>
        <span className="rounded-lg border border-border px-3 py-1.5 text-[0.8rem] font-medium text-muted-foreground">
          Rewrite
        </span>
      </div>
    </Panel>
  );
}

function SchedulePanel() {
  const slots = [
    { d: "Wed", t: "2:00 pm", pick: false },
    { d: "Thu", t: "11:30 am", pick: true },
    { d: "Fri", t: "9:00 am", pick: false },
  ];
  return (
    <Panel>
      <div className="flex items-center gap-2 border-b border-border pb-3 text-[0.8rem] text-muted-foreground">
        <CalendarClock className="size-3.5 text-honey-ink" />
        Free slots with{" "}
        <span className="font-medium text-foreground">Marco</span>
        <span className="ml-auto font-mono text-[0.7rem]">30 min</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {slots.map((s) => (
          <div
            key={s.d}
            className={`rounded-xl border px-3 py-3 text-center ${
              s.pick
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/40"
            }`}
          >
            <div className="text-[0.72rem] uppercase tracking-wide text-muted-foreground">
              {s.d}
            </div>
            <div className="mt-1 text-[0.86rem] font-semibold">{s.t}</div>
            {s.pick && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] font-medium text-success">
                <Check className="size-3" /> picked
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-success-subtle/60 px-3 py-2 text-[0.8rem] text-success">
        <Check className="size-3.5" /> Invite sent for Thu 11:30 am
      </div>
    </Panel>
  );
}
