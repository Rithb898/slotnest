"use client";

import { CalendarPlus, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

/**
 * Draft-then-approve event composer (plan 003 step 5).
 *
 * A single controlled dialog used by both /calendar and the /inbox "→ Invite"
 * action. It is a DRAFT until the user approves — only then does the
 * `calendar.createEvent` write fire. Nothing books without this explicit human
 * action. The primary button uses the neutral `secondary` variant, not honey:
 * the One Light Rule reserves honey for the active nav rail on this screen.
 */

export type InviteDraft = {
  summary: string;
  /** ISO datetime; prefilled when launched from a free slot. */
  start?: string;
  /** ISO datetime. */
  end?: string;
  attendees?: string[];
  description?: string;
};

type CreatedEvent = {
  id: string | null;
  htmlLink: string | null;
  summary: string;
};

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${pad(hours)}:${pad(minutes)}`;
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format an ISO string into the value a <input type="datetime-local"> wants. */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** A datetime-local value is wall-clock local; turn it back into an ISO instant. */
function fromLocalInput(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function toDatePart(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDatePart(value: string): string {
  return value.split("T")[0] ?? "";
}

function getTimePart(value: string): string {
  return value.split("T")[1]?.slice(0, 5) ?? "";
}

function formatDate(value: string): string {
  if (!value) return "Pick date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pick date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const datePart = getDatePart(value);
  const timePart = getTimePart(value);
  const selected = value ? new Date(value) : undefined;
  const timeOptions = TIME_OPTIONS.includes(timePart)
    ? TIME_OPTIONS
    : [timePart, ...TIME_OPTIONS].filter(Boolean).sort();

  function setDate(date?: Date) {
    if (!date) return;
    onChange(`${toDatePart(date)}T${timePart || "09:00"}`);
  }

  function setTime(nextTime: string | null) {
    if (!nextTime) return;
    onChange(`${datePart || toDatePart(new Date())}T${nextTime}`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                id={id}
                variant="outline"
                className="h-8 w-full min-w-0 justify-start overflow-hidden rounded-lg bg-input/50 px-3 font-normal"
              />
            }
          >
            <span className="min-w-0 truncate">{formatDate(value)}</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={
                selected && !Number.isNaN(selected.getTime())
                  ? selected
                  : undefined
              }
              onSelect={setDate}
            />
          </PopoverContent>
        </Popover>

        <Select value={timePart} onValueChange={setTime}>
          <SelectTrigger
            aria-label={`${label} time`}
            className="h-8 w-full rounded-lg bg-input/50"
          >
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-64">
            {timeOptions.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function InviteDialog({
  open,
  onOpenChange,
  draft,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: InviteDraft | null;
  onSent?: (event: CreatedEvent) => void;
}) {
  const utils = api.useUtils();
  const [summary, setSummary] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [attendees, setAttendees] = useState("");
  const [description, setDescription] = useState("");

  // Re-seed the form whenever a new draft is opened.
  useEffect(() => {
    if (!open || !draft) return;
    const now = new Date();
    const defaultStart = new Date(
      Math.ceil(now.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
    );
    const defaultEnd = new Date(defaultStart.getTime() + 30 * 60 * 1000);
    setSummary(draft.summary ?? "");
    setStart(toLocalInput(draft.start ?? defaultStart.toISOString()));
    setEnd(toLocalInput(draft.end ?? defaultEnd.toISOString()));
    setAttendees((draft.attendees ?? []).join(", "));
    setDescription(draft.description ?? "");
  }, [open, draft]);

  const createEvent = api.calendar.createEvent.useMutation({
    onSuccess: (res) => {
      const hasAttendees = attendeeList.length > 0;
      toast.success(hasAttendees ? "Invite sent" : "Event created", {
        description: "Added to your calendar.",
        action: res.htmlLink
          ? {
              label: "Open",
              onClick: () => window.open(res.htmlLink ?? "", "_blank"),
            }
          : undefined,
      });
      void utils.calendar.events.invalidate();
      void utils.calendar.availability.invalidate();
      onSent?.(res);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Couldn't create event", { description: err.message });
    },
  });

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const attendeeList = attendees
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hasAttendees = attendeeList.length > 0;
  const showAttendees = Boolean(draft?.attendees?.length) || hasAttendees;

  const startIso = fromLocalInput(start);
  const endIso = fromLocalInput(end);
  const valid =
    summary.trim().length > 0 &&
    Boolean(startIso) &&
    Boolean(endIso) &&
    new Date(endIso) > new Date(startIso);

  function send() {
    if (!valid) return;
    createEvent.mutate({
      summary: summary.trim(),
      start: startIso,
      end: endIso,
      timeZone,
      attendees: attendeeList.length ? attendeeList : undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4 text-muted-foreground" />
            {hasAttendees ? "Review invite" : "Review event"}
          </DialogTitle>
          <DialogDescription>
            Nothing is added to your calendar until you approve.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-summary">Title</Label>
            <Input
              id="invite-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Meeting"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateTimeField
              id="invite-start"
              label="Start"
              value={start}
              onChange={setStart}
            />
            <DateTimeField
              id="invite-end"
              label="End"
              value={end}
              onChange={setEnd}
            />
          </div>

          {showAttendees ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-attendees">Attendees</Label>
              <Input
                id="invite-attendees"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="name@example.com, other@example.com"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-description">Note</Label>
            <Textarea
              id="invite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={
                hasAttendees
                  ? "Optional message to attendees"
                  : "Optional event note"
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createEvent.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={send}
            disabled={!valid || createEvent.isPending}
          >
            {createEvent.isPending ? (
              hasAttendees ? (
                "Sending..."
              ) : (
                "Creating..."
              )
            ) : (
              <>
                <ExternalLink className="size-4" />
                {hasAttendees ? "Send invite" : "Create event"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
