import { BentoGrid } from "@/components/landing/bento-grid";
import { CtaBand } from "@/components/landing/cta-band";
import { FaqSection } from "@/components/landing/faq-section";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Showcase } from "@/components/landing/showcase";
import { SiteFooter } from "@/components/landing/site-footer";
import { StatBand } from "@/components/landing/stat-band";
import { TrustStrip } from "@/components/landing/trust-strip";
import { TypeMoment } from "@/components/landing/type-moment";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground">
      <Hero />
      {/* <StatBand /> */}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-16 px-5 py-16 sm:gap-24 sm:px-8 sm:py-24">
        <TrustStrip />
        <Showcase />
        <BentoGrid />
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
