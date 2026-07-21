import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCtaSection() {
  return (
    <section className="pb-20 pt-4 sm:pb-28" aria-labelledby="final-cta-title">
      <div className="site-container">
        <div className="relative overflow-hidden border border-[var(--line-strong)] bg-[var(--surface-accent)] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#6e56cf]/15 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">Dein nächster Schritt</p>
              <h2
                id="final-cta-title"
                className="mt-6 max-w-[14ch] font-display text-4xl font-medium leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-6xl"
              >
                Bereit durchzustarten?
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--ink-muted)] sm:text-base">
                Finde deinen passenden Tutor und erlebe, wie Lernen mit engagierten Mentoren Spaß macht und echte Fortschritte bringt.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/matching"
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-white px-5 text-sm font-bold text-[var(--canvas)] transition-colors hover:bg-[#eeeaf4]"
              >
                Jetzt Tutor finden
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/#preise"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--line-strong)] px-5 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-white/5"
              >
                Preise ansehen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
