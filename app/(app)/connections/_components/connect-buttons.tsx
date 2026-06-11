"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { key: "gmail", label: "Gmail" },
  { key: "googlecalendar", label: "Google Calendar" },
] as const;

export function ConnectButtons({ connected }: { connected: string[] }) {
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const ok = searchParams.get("connected");
    const err = searchParams.get("error");
    if (ok) {
      toast.success(`Connected ${ok}`);
      handled.current = true;
    } else if (err) {
      toast.error("Connection failed. Please try again.");
      handled.current = true;
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((provider) => {
        const isConnected = connected.includes(provider.key);
        if (isConnected) {
          return (
            <div
              key={provider.key}
              className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-sm"
            >
              <span>{provider.label}</span>
              <span className="font-medium text-emerald-600">Connected ✓</span>
            </div>
          );
        }
        return (
          <Link
            key={provider.key}
            href={`/api/corsair/connect?plugin=${provider.key}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "justify-start",
            )}
          >
            Connect {provider.label}
          </Link>
        );
      })}
    </div>
  );
}
