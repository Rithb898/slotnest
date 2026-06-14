"use client";

import { useEffect, useState } from "react";

/**
 * True on macOS/iOS. Defaults to `false` so SSR and the first client render
 * agree (no hydration mismatch); the real value lands after mount. ⌘K and
 * Ctrl K both work — see the keydown handler in command-bar.tsx.
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    const ua =
      // @ts-expect-error userAgentData is not yet in all lib.dom typings.
      navigator.userAgentData?.platform ??
      navigator.platform ??
      navigator.userAgent;
    setIsMac(/mac|iphone|ipad|ipod/i.test(ua));
  }, []);
  return isMac;
}
