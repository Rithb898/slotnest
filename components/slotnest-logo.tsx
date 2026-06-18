import Image from "next/image";
import { cn } from "@/lib/utils";

type SlotNestLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

export function SlotNestMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="SlotNest logo"
      width={64}
      height={64}
      className={className}
      priority
    />
  );
}

export function SlotNestLogo({
  className,
  markClassName,
  wordmarkClassName,
}: SlotNestLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SlotNestMark className={cn("shrink-0 text-primary", markClassName)} />
      <span
        className={cn(
          "text-[1.05rem] font-semibold tracking-tight text-foreground",
          wordmarkClassName,
        )}
      >
        SlotNest
      </span>
    </span>
  );
}
