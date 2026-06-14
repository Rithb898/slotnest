"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * App-wide theme provider (light / dark / system).
 *
 * Dark mode is class-based (`.dark` — see globals.css `@custom-variant dark`),
 * so we use `attribute="class"`. `<Toaster>` already reads `useTheme()`; this
 * gives it (and the sidebar theme switcher) a real provider to read from.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
