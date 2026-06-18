"use client";

import { Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BillingUpgradeButton } from "@/components/billing-upgrade-button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/trpc/react";

export type ReplyDraft = {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  messageId?: string;
  inReplyTo?: string | null;
  references?: string | null;
};

export function ReplyDialog({
  open,
  onOpenChange,
  draft,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReplyDraft | null;
  onSent?: () => void;
}) {
  const utils = api.useUtils();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const connections = api.connections.list.useQuery();
  const billingEnabled =
    connections.isSuccess && (connections.data?.length ?? 0) > 0;
  const billing = api.billing.summary.useQuery(undefined, {
    enabled: billingEnabled,
  });
  const aiBudget = billing.data?.aiActionBudget ?? null;
  const aiBudgetExhausted = aiBudget?.exhausted ?? false;
  const canUpgrade = billing.data?.currentPlan.name !== "pro";

  useEffect(() => {
    if (!open || !draft) return;
    setTo(draft.to);
    setSubject(draft.subject);
    setBody(draft.body);
    setAiUnavailable(false);
  }, [open, draft]);

  const sendReply = api.gmail.sendReply.useMutation({
    onSuccess: () => {
      toast.success("Reply sent", {
        description: "Added to the Gmail thread.",
      });
      void utils.gmail.inbox.invalidate();
      void utils.gmail.message.invalidate();
      void utils.gmail.thread.invalidate();
      void utils.gmail.sent.invalidate();
      void utils.workspace.dailyBrief.invalidate();
      onSent?.();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Couldn't send reply", { description: err.message });
    },
  });

  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent", {
        description: "Added to Gmail Sent.",
      });
      void utils.gmail.inbox.invalidate();
      void utils.gmail.sent.invalidate();
      void utils.workspace.dailyBrief.invalidate();
      onSent?.();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Couldn't send email", { description: err.message });
    },
  });

  const draftReply = api.gmail.draftReply.useMutation({
    onSuccess: (result) => {
      if (!result.configured) {
        setAiUnavailable(true);
        toast.info("AI drafts are not configured", {
          description: "Set OPENAI_API_KEY to enable Draft with AI.",
        });
        return;
      }
      if (!result.text.trim()) {
        toast.error("Couldn't draft a reply", {
          description: "The model returned an empty draft.",
        });
        return;
      }
      setBody(result.text);
      toast.success("Draft ready");
    },
    onError: (err) => {
      toast.error("Couldn't draft a reply", { description: err.message });
    },
  });

  const valid = Boolean(subject.trim() && to.trim() && body.trim());
  const canDraftWithAi =
    Boolean(draft?.messageId) && !aiUnavailable && !aiBudgetExhausted;

  function send() {
    if (!draft || !valid) return;
    if (!draft.threadId) {
      sendEmail.mutate({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      return;
    }
    sendReply.mutate({
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      threadId: draft.threadId,
      messageId: draft.messageId,
      inReplyTo: draft.inReplyTo ?? undefined,
      references: draft.references ?? undefined,
    });
  }

  function draftWithAi() {
    if (!draft?.messageId || aiUnavailable || aiBudgetExhausted) return;
    draftReply.mutate({ messageId: draft.messageId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4 text-muted-foreground" />
            {draft?.threadId ? "Draft reply" : "Draft email"}
          </DialogTitle>
          <DialogDescription>
            Review the reply. Nothing is sent until you approve.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-to">To</Label>
            <Input
              id="reply-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-subject">Subject</Label>
            <Input
              id="reply-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              readOnly={Boolean(draft?.threadId)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="reply-body">Message</Label>
              {aiBudgetExhausted && canUpgrade ? (
                <BillingUpgradeButton
                  label="Upgrade to draft"
                  variant="secondary"
                  size="sm"
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={draftWithAi}
                      disabled={
                        !canDraftWithAi ||
                        draftReply.isPending ||
                        sendReply.isPending ||
                        sendEmail.isPending
                      }
                      className="h-8"
                    >
                      <Sparkles className="size-4" />
                      {draftReply.isPending ? "Drafting..." : "Draft with AI"}
                    </Button>
                  </TooltipTrigger>
                  {!canDraftWithAi ? (
                    <TooltipContent>
                      {aiBudgetExhausted
                        ? "AI action budget exhausted."
                        : "Set OPENAI_API_KEY"}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              )}
            </div>
            <Textarea
              id="reply-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write your reply, or draft with AI"
              className="min-h-44"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={
              sendReply.isPending || sendEmail.isPending || draftReply.isPending
            }
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={send}
            disabled={
              !valid ||
              sendReply.isPending ||
              sendEmail.isPending ||
              draftReply.isPending
            }
          >
            {sendReply.isPending || sendEmail.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="size-4" />
                {draft?.threadId ? "Send reply" : "Send email"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
