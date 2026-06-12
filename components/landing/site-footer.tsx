import { Command } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <Command className="size-3.5" strokeWidth={2.25} />
          </span>
          SlotNest
        </div>
        <p className="text-[0.82rem] text-muted-foreground">
          A keyboard-first command center for Gmail &amp; Google Calendar.
        </p>
        <p className="text-[0.82rem] text-muted-foreground">© 2026 SlotNest</p>
      </div>
    </footer>
  );
}
