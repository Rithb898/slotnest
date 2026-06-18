import Link from "next/link";
import { HeroNavbar } from "@/components/landing/hero-navbar";
import { SiteFooter } from "@/components/landing/site-footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white text-foreground">
      <HeroNavbar />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              SlotNest
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              This page explains how SlotNest handles account, connection, and
              usage data when you use the product.
            </p>
          </header>

          <section className="space-y-6 text-sm leading-7 text-foreground">
            <PolicySection title="What we collect">
              We collect the information you provide to create an account,
              connect Gmail or Google Calendar, and use SlotNest features. That
              may include your name, email address, connected account metadata,
              messages, calendar events, drafts, and interaction history needed
              to operate the product.
            </PolicySection>

            <PolicySection title="How we use it">
              We use this data to authenticate you, connect your accounts, show
              messages and events, generate drafts, surface scheduling options,
              and provide the approval workflow that SlotNest is built around.
            </PolicySection>

            <PolicySection title="How AI uses your data">
              SlotNest may send message content and calendar context to AI
              models to triage, summarize, or draft responses. The app is
              designed so outbound actions still require your approval before
              anything is sent or booked.
            </PolicySection>

            <PolicySection title="Sharing">
              We do not sell your personal data. We may share data with service
              providers that help us run SlotNest, such as authentication,
              database, email, AI, and infrastructure providers, only as needed
              to operate the product.
            </PolicySection>

            <PolicySection title="Your choices">
              You can disconnect Gmail or Google Calendar from Settings, edit or
              delete drafts before sending, and choose not to use AI-assisted
              workflows if you prefer manual control.
            </PolicySection>

            <PolicySection title="Contact">
              If you have questions about privacy or your data, contact the
              SlotNest team through the support email in the app footer.
            </PolicySection>
          </section>

          <footer className="flex items-center justify-between border-t border-border pt-6 text-sm text-muted-foreground">
            <span>Last updated: June 18, 2026</span>
            <Link href="/" className="underline-offset-4 hover:underline">
              Back to home
            </Link>
          </footer>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </section>
  );
}
