"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  /** Render as an inline element instead of a block. */
  as?: "div" | "span" | "li";
  className?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Scroll-reveal wrapper, powered by motion's `whileInView`. Fades and lifts its
 * content into place the first time it enters the viewport. Respects the user's
 * reduced-motion preference via the global <MotionConfig reducedMotion="user">.
 */
export function Reveal({
  children,
  delay = 0,
  as = "div",
  className,
}: RevealProps) {
  const motionProps = {
    className,
    initial: { opacity: 0, y: 16, scale: 0.99, filter: "blur(6px)" },
    whileInView: { opacity: 1, y: 0, scale: 1, filter: "none" },
    viewport: { once: true, amount: 0.2, margin: "0px 0px -8% 0px" },
    transition: { duration: 0.72, delay: delay / 1000, ease: EASE },
  } as const;

  if (as === "li") {
    return <motion.li {...motionProps}>{children}</motion.li>;
  }
  if (as === "span") {
    return (
      <motion.span
        {...motionProps}
        className={`inline-block ${className ?? ""}`}
      >
        {children}
      </motion.span>
    );
  }
  return <motion.div {...motionProps}>{children}</motion.div>;
}
