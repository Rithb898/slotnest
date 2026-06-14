import { AtSign, Globe, Mail } from "lucide-react";

const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
  { label: "Sign in", href: "/sign-in" },
];

const SOCIAL = [
  { icon: AtSign, label: "Twitter", href: "#" },
  { icon: Globe, label: "Website", href: "#" },
  { icon: Mail, label: "Email", href: "#" },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#0e0e0e] text-white">
      {/* Top nav row */}
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-5 py-7 sm:flex-row sm:px-8">
        <a
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight"
        >
          <svg
            className="size-6 shrink-0 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <title>SlotNest Logo</title>
            <path
              d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 19.364L18.364 5.636"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          </svg>
          <span className="text-[1.05rem]">SlotNest</span>
        </a>

        <nav className="flex items-center gap-6">
          {NAV.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-[0.85rem] font-medium text-white/70 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              aria-label={s.label}
              className="grid size-9 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              <s.icon className="size-4" />
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto h-px w-full max-w-7xl bg-white/10" />

      {/* Giant cropped wordmark */}
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none mb-[-0.18em] select-none whitespace-nowrap text-center font-serif font-bold leading-none tracking-tighter text-white"
          style={{ fontSize: "clamp(5rem, 23vw, 22rem)" }}
        >
          SlotNest
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 pb-5 text-[0.78rem] text-white/45 sm:px-8">
        <span>© 2026 SlotNest</span>
        <span>Built for a quieter inbox.</span>
      </div>
    </footer>
  );
}
