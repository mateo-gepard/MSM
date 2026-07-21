import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCtaSection() {
  return (
    <section className="pb-20 pt-4 sm:pb-28" aria-labelledby="final-cta-title">
      <div className="site-container">
        <div className="relative overflow-hidden border border-[#4b406f] bg-[#171522] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#6e56cf]/15 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">Der nächste Schritt</p>
              <h2
                id="final-cta-title"
                className="mt-6 max-w-[14ch] font-display text-4xl font-medium leading-none tracking-[-0.04em] text-white sm:text-6xl"
              >
                Herausfinden, wer fachlich und menschlich passt.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#bbb5c4] sm:text-base">
                Beantwortet einige kurze Fragen und startet anschließend mit einer kostenlosen 60-minütigen Probestunde.
              </p>
            </div>

            <Link
              href="/matching"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-white px-5 text-sm font-bold text-[#111118] transition-colors hover:bg-[#eeeaf4]"
            >
              Matching starten
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
