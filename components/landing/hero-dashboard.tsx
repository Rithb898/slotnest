import { ChevronDown, TrendingDown, TrendingUp, X } from "lucide-react";
import { useId } from "react";
import { Gauge } from "@/components/landing/gauge";

function CardHeader({ title, period }: { title: string; period: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="font-medium text-primary">{title}</span>
      <span className="text-muted-foreground">{period}</span>
    </div>
  );
}

function TogglePill({
  active,
  inactive,
}: {
  active: string;
  inactive: string;
}) {
  return (
    <div className="flex rounded-full bg-muted p-1 text-[12px] font-medium">
      <button
        type="button"
        className="flex-1 rounded-full bg-background px-3 py-1.5 text-foreground shadow"
      >
        {active}
      </button>
      <button
        type="button"
        className="flex-1 rounded-full px-3 py-1.5 text-muted-foreground"
      >
        {inactive}
      </button>
    </div>
  );
}

function Dropdown({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-[12px] text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-[13px] text-foreground"
      >
        {value}
        <ChevronDown
          className="h-4 w-4 text-muted-foreground"
          strokeWidth={2}
        />
      </button>
    </div>
  );
}

function TargetInput({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue: string;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[12px] text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 focus-within:border-muted-foreground">
        <span className="text-[13px] text-muted-foreground">#</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          defaultValue={defaultValue}
          className="w-full bg-transparent text-[13px] text-foreground outline-none"
        />
      </div>
    </div>
  );
}

function TriagedCard() {
  return (
    <div className="flex flex-col rounded-2xl bg-background p-5">
      <CardHeader title="Triaged" period="This week" />
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[28px] font-semibold leading-none">248</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <TrendingUp className="h-3 w-3" strokeWidth={2} />
          +62 (33%)
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Compared to last week
      </p>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">
        Inbox-zero progress
      </p>
      <div className="mt-1">
        <Gauge value={92} showLabels min="0" max="270" />
      </div>
      <div className="mt-auto pt-4">
        <TogglePill active="Emails" inactive="Threads" />
      </div>
    </div>
  );
}

function TriageSettingsCard() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-background p-5">
      <Dropdown label="Show inbox for" value="This week" />
      <Dropdown label="Group by" value="Action needed" />
      <TargetInput label="Daily target (emails)" defaultValue="20" />
      <TargetInput label="Weekly target (emails)" defaultValue="120" />
      <div className="mt-auto flex items-center gap-4 pt-1">
        <button
          type="button"
          className="rounded-lg bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Save
        </button>
        <button
          type="button"
          className="text-[13px] text-muted-foreground underline underline-offset-2"
        >
          Cancel
        </button>
        <button
          type="button"
          className="ml-auto p-1 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function FreeSlotsCard() {
  return (
    <div className="flex flex-col rounded-2xl bg-background p-5">
      <CardHeader title="Free slots" period="today" />
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[28px] font-semibold leading-none">4</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <TrendingDown className="h-3 w-3" strokeWidth={2} />
          -1
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Bookable today</p>
      <div className="mt-5">
        <Gauge value={68} color="var(--color-honey-ink)" />
      </div>
      <div className="mt-auto pt-4">
        <TogglePill active="Focus time" inactive="Meetings" />
      </div>
    </div>
  );
}

export function HeroDashboard() {
  return (
    <div className="px-3 sm:px-4">
      <div className="mx-auto w-full max-w-[880px] rounded-3xl bg-muted p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <TriagedCard />
          <TriageSettingsCard />
          <FreeSlotsCard />
        </div>
      </div>
    </div>
  );
}
