import { Faq } from "@/components/landing/faq";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/shared";

export function FaqSection() {
  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-24"
    >
      <Reveal className="mb-10 text-center">
        <SectionHeading>
          Frequently asked{" "}
          <em className="font-serif font-normal italic text-primary">
            questions.
          </em>
        </SectionHeading>
      </Reveal>
      <Reveal delay={60}>
        <Faq />
      </Reveal>
    </section>
  );
}
