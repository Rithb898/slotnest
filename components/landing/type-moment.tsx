import { Reveal } from "@/components/landing/reveal";

export function TypeMoment() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-secondary/40 py-24 sm:py-32">
      <div
        aria-hidden
        className="blob blob--b absolute left-1/2 top-1/2 size-112 -translate-x-1/2 -translate-y-1/2 opacity-30"
        style={{ background: "oklch(0.82 0.12 78 / 0.5)" }}
      />
      <Reveal className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
        <p
          className="text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.4rem] lg:text-[4rem]"
          style={{ textWrap: "balance" }}
        >
          Email that gets{" "}
          <em className="font-serif font-normal italic text-honey-ink">
            out of your way
          </em>{" "}
          — so the rest of your day doesn&apos;t have to wait on it.
        </p>
      </Reveal>
    </section>
  );
}
