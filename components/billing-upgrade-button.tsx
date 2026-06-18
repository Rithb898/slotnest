"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import posthog from "posthog-js";

const RAZORPAY_CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: RazorpayCheckoutResponse) => void;
};

type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions,
) => {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpayScriptLoad: Promise<void> | undefined;

function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout requires a browser."));
  }

  if (window.Razorpay) return Promise.resolve();

  razorpayScriptLoad ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load Razorpay checkout.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(script);
  }).catch((error) => {
    razorpayScriptLoad = undefined;
    throw error;
  });

  return razorpayScriptLoad;
}

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
  const createCheckout = api.billing.createCheckoutSubscription.useMutation();
  const verifyCheckout = api.billing.verifySubscriptionCheckout.useMutation();

  async function handleUpgrade() {
    try {
      const result = await createCheckout.mutateAsync();
      await loadRazorpayCheckout();

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout did not initialize.");
      }

      posthog.capture("billing_upgrade_initiated", { plan: result.planLabel });

      const checkout = new window.Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "SlotNest",
        description: `${result.planLabel} subscription`,
        prefill: {
          name: result.user.name,
          email: result.user.email,
        },
        theme: {
          color: "#18181b",
        },
        modal: {
          ondismiss: () => toast("Checkout closed."),
        },
        handler: (response) => {
          void verifyCheckout
            .mutateAsync(response)
            .then(async () => {
              posthog.capture("billing_upgrade_completed", { plan: result.planLabel });
              toast.success("Subscription verified.");
              await utils.billing.summary.invalidate();
              router.refresh();
            })
            .catch(() => {
              toast.error("Could not verify the Razorpay payment.");
            });
        },
      });

      checkout.open();
    } catch {
      toast.error("Could not open Razorpay checkout.");
    }
  }

  const disabled = createCheckout.isPending || verifyCheckout.isPending;

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
