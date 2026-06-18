import Link from "next/link";
import { HeroNavbar } from "@/components/landing/hero-navbar";
import { SiteFooter } from "@/components/landing/site-footer";

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              These terms describe how you may use SlotNest and the limits
              around access to the service.
            </p>
          </header>

          <section className="space-y-6 text-sm leading-7 text-foreground">
            <PolicySection title="Use of the service">
              SlotNest is provided to help you manage Gmail and Google Calendar
              workflows. You agree to use the service only for lawful purposes
              and in a way that does not interfere with the operation of the
              product or the accounts you connect.
            </PolicySection>

            <PolicySection title="Your account">
              You are responsible for the accuracy of the information in your
              account and for the activity that occurs under it. Keep your
              credentials secure and disconnect integrations you no longer want
              SlotNest to access.
            </PolicySection>

            <PolicySection title="Approvals and actions">
              SlotNest is built around approval-first workflows. The app may
              prepare drafts or proposals, but you are responsible for reviewing
              them before any outbound action is sent or scheduled.
            </PolicySection>

            <PolicySection title="Service changes">
              We may change, suspend, or discontinue parts of SlotNest as the
              product evolves. When possible, we will provide reasonable notice
              for meaningful changes.
            </PolicySection>

            <PolicySection title="Limitation of warranty">
              SlotNest is provided on an “as is” basis. We do not guarantee that
              every draft, recommendation, or scheduling suggestion will be
              correct, complete, or suitable for your exact needs.
            </PolicySection>

            <PolicySection title="Contact">
              If you have questions about these terms, contact the SlotNest team
              through the support email in the app footer.
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
