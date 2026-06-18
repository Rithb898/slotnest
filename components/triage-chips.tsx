import type { TriageAction, TriageUrgency } from "@/lib/triage";
import { cn } from "@/lib/utils";

/**
 * Triage chips — soft-filled semantic chips per DESIGN ("Chips" section).
 *
 * Colors are the semantic trio ONLY (urgent / scheduled / fyi). Honey is never
 * used here — triage urgency must stay distinct from the one-light accent
 * (DESIGN: The One Light Rule).
 */

const actionStyles: Record<TriageAction, string> = {
  // Needs reply — leans on the urgent hue family but muted (it's an action, not an alarm).
  "Needs reply": "bg-destructive/12 text-[var(--destructive)]",
  Schedule: "bg-secondary text-secondary-foreground",
  FYI: "bg-info-subtle text-[var(--info)]",
  Ignore: "bg-muted text-muted-foreground",
};

const urgencyStyles: Record<TriageUrgency, string> = {
  Urgent: "bg-destructive/12 text-[var(--destructive)]",
  Normal: "bg-info-subtle text-[var(--info)]",
  Low: "bg-muted text-muted-foreground",
};

const actionLabels: Record<TriageAction, string> = {
  "Needs reply": "Needs reply",
  Schedule: "Schedule",
  FYI: "Info only",
  Ignore: "Ignore",
};

function Chip({
  className,
  children,
}: {
  className: string;
  children: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ActionChip({ action }: { action: TriageAction }) {
  return <Chip className={actionStyles[action]}>{actionLabels[action]}</Chip>;
}

export function UrgencyChip({ urgency }: { urgency: TriageUrgency }) {
  // "Normal" is the unremarkable default — don't add visual noise for it.
  if (urgency === "Normal") return null;
  return <Chip className={urgencyStyles[urgency]}>{urgency}</Chip>;
}

export function TriageChips({
  action,
  urgency,
}: {
  action: TriageAction;
  urgency: TriageUrgency;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <ActionChip action={action} />
      <UrgencyChip urgency={urgency} />
    </span>
  );
}
