import { CtaBand } from "@/components/landing/cta-band";
import { FaqSection } from "@/components/landing/faq-section";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Showcase } from "@/components/landing/showcase";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { TrustStrip } from "@/components/landing/trust-strip";
import { TypeMoment } from "@/components/landing/type-moment";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Showcase />
        <Features />
        <TypeMoment />
        <HowItWorks />
        <FaqSection />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
