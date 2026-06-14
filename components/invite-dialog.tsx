"use client";

import { CalendarPlus, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

/**
 * Draft-then-approve invite composer (plan 003 step 5).
 *
 * A single controlled dialog used by both /calendar and the /inbox "→ Invite"
 * action. It is a DRAFT until the user hits "Send invite" — only then does the
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

/** Format an ISO string into the value a <input type="datetime-local"> wants. */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
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

export function InviteDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: InviteDraft | null;
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
      toast.success("Invite sent", {
        description: res.htmlLink ? "Added to your calendar." : undefined,
        action: res.htmlLink
          ? {
              label: "Open",
              onClick: () => window.open(res.htmlLink ?? "", "_blank"),
            }
          : undefined,
      });
      void utils.calendar.events.invalidate();
      void utils.calendar.availability.invalidate();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Couldn't send invite", { description: err.message });
    },
  });

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const attendeeList = attendees
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
            Draft invite
          </DialogTitle>
          <DialogDescription>
            Review the details. Nothing is sent until you approve.
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-start">Start</Label>
              <Input
                id="invite-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-end">End</Label>
              <Input
                id="invite-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-attendees">Attendees</Label>
            <Input
              id="invite-attendees"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="name@example.com, other@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-description">Note</Label>
            <Textarea
              id="invite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional message to attendees"
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
              "Sending…"
            ) : (
              <>
                <ExternalLink className="size-4" />
                Send invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
