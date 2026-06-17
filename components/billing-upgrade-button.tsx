"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function BillingUpgradeButton({
  label = "Upgrade now",
  children,
  className,
  variant = "default",
  size = "default",
}: {
  label?: string;
  children?: ReactNode;
} & Partial<
  Pick<ComponentProps<typeof Button>, "className" | "variant" | "size">
>) {
  const router = useRouter();
  const utils = api.useUtils();
  const createLink = api.billing.createSubscriptionLink.useMutation({
    onError: () => toast.error("Could not start billing right now."),
  });

  async function handleUpgrade() {
    const popup = window.open("", "_blank", "noopener,noreferrer");

    try {
      const result = await createLink.mutateAsync();

      if (!result.shortUrl) {
        throw new Error("Missing Razorpay link");
      }

      if (popup) {
        popup.location.href = result.shortUrl;
        const poll = window.setInterval(() => {
          if (popup.closed) {
            window.clearInterval(poll);
            void utils.billing.summary.invalidate();
            router.refresh();
          }
        }, 500);
      } else {
        window.location.href = result.shortUrl;
      }
    } catch {
      popup?.close();
    }
  }

  const disabled = createLink.isPending;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleUpgrade}
      disabled={disabled}
    >
      {children ?? label}
      <Sparkles className="size-3.5" />
    </Button>
  );
}
