"use client";

import { ReactLenis } from "lenis/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// const reducedMotion = process.env.NODE_ENV === "production" ? "user" : "never";

export function LenisProvider({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
      }}
    >
      <MotionConfig >{children}</MotionConfig>
    </ReactLenis>
  );
}
