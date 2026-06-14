import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Spectral } from "next/font/google";
import "./globals.css";
import { LenisProvider } from "@/components/lenis-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "SlotNest — A quieter inbox and calendar",
  description:
    "SlotNest is a keyboard-first command center for Gmail and Google Calendar. Triage, reply, and schedule in seconds — without leaving the keyboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        sans.variable,
        mono.variable,
        spectral.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LenisProvider>
            <TRPCReactProvider>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
            </TRPCReactProvider>
          </LenisProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
