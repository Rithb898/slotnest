import { cn } from "@/lib/utils";

type SlotNestLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

export function SlotNestMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      role="img"
      aria-label="SlotNest logo"
    >
      <title>SlotNest Logo</title>
      <rect
        x="8"
        y="8"
        width="48"
        height="48"
        rx="16"
        stroke="currentColor"
        strokeOpacity="0.14"
      />
      <path
        d="M22 20.5c0-2.5 2-4.5 4.5-4.5h11c4.9 0 8.5 3.6 8.5 8.1 0 4.2-2.9 6.8-6.8 7.8l-10.1 2.5C25.1 35.5 22 38.3 22 42.2c0 4.1 3.2 7.3 7.6 7.3h13.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="4.3" fill="currentColor" stroke="none" />
      <circle cx="32" cy="32" r="1.5" fill="#F9F3E8" stroke="none" />
    </svg>
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
