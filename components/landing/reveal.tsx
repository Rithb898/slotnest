"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  /** Render as an inline element instead of a block. */
  as?: "div" | "span" | "li";
  className?: string;
};

/**
 * Scroll-reveal wrapper. Content renders fully visible by default (SSR / no-JS /
 * reduced-motion / headless all see it), and only arms the hidden state once the
 * client confirms motion is wanted — so a reveal can never ship the section blank.
 */
export function Reveal({
  children,
  delay = 0,
  as = "div",
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "armed" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      setState("shown");
      return;
    }

    // Arm the hidden state, then observe entry into the viewport.
    setState("armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      data-reveal={state === "idle" ? undefined : state}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
