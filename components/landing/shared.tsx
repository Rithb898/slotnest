import type { ReactNode } from "react";

export function Chip({
  variant,
  children,
}: {
  variant: "urgent" | "reply" | "fyi" | "scheduled";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    urgent: "bg-destructive/12 text-destructive",
    reply: "bg-primary/15 text-honey-ink",
    fyi: "bg-info/15 text-info",
    scheduled: "bg-success/15 text-success",
  };
  return (
    <span
      className={`shrink-0 rounded-md border border-transparent px-1.5 py-0.5 text-[0.68rem] font-medium transition-transform duration-200 ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-balance text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.025em] sm:text-[2.5rem]"
      style={{ textWrap: "balance" }}
    >
      {children}
    </h2>
  );
}
