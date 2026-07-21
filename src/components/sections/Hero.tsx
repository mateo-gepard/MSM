import Link from 'next/link';
import { ArrowRight, Check, MapPin, Monitor } from 'lucide-react';

const serviceFacts = [
  'Kostenlose Probestunde mit 60 Minuten für Neukunden',
  'Danach ab 29 € pro 60 Minuten im Paket mit zehn Stunden',
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--line)]" aria-labelledby="hero-title">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(115deg, transparent 0%, transparent 56%, rgba(128, 103, 232, 0.12) 56%, rgba(128, 103, 232, 0.02) 83%, transparent 83%)',
        }}
      />

      <div className="site-container relative grid min-h-[calc(100svh-4.75rem)] items-center gap-14 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-20">
        <div className="max-w-3xl">
          <p className="eyebrow">Munich Scholar Mentors</p>
          <h1
            id="hero-title"
            className="mt-7 max-w-[12ch] font-display text-[clamp(3.35rem,8.2vw,7.15rem)] font-medium leading-[0.9] tracking-[-0.055em] text-[var(--ink)]"
          >
            Erstklassiges Mentoring
          </h1>
          <p className="text-pretty mt-7 max-w-2xl text-base leading-8 text-[var(--ink-muted)] sm:text-lg">
            Hochqualifizierte Schüler und Studenten unterrichten dich individuell mit maßgeschneiderten Lernplänen. Online oder vor Ort und je nach Tutor auch bilingual.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/matching"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6e56cf] px-5 text-sm font-bold text-white transition-colors hover:bg-[#745bd1]"
            >
              Kostenloses Erstgespräch
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              href="#tutoren"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--line-strong)] px-5 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-white/5"
            >
              Tutoren entdecken
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 text-sm text-[var(--ink-muted)] sm:grid-cols-2" aria-label="Preisinformationen">
            {serviceFacts.map((fact) => (
              <li key={fact} className="flex items-start gap-2.5">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#9b83ff]" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="relative border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8" aria-label="Das Angebot von MSM im Überblick">
          <div className="absolute -right-px -top-px h-20 w-20 border-r border-t border-[#6e56cf]" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Direkt geklärt</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
            Lernen, wo es für dich passt.
          </h2>

          <dl className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            <div className="grid grid-cols-[2.25rem_1fr] gap-3 py-5">
              <Monitor aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#9b83ff]" />
              <div>
                <dt className="font-bold text-[var(--ink)]">Online</dt>
                <dd className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">Ortsunabhängig und direkt mit deinem gewählten Tutor.</dd>
              </div>
            </div>
            <div className="grid grid-cols-[2.25rem_1fr] gap-3 py-5">
              <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#9b83ff]" />
              <div>
                <dt className="font-bold text-[var(--ink)]">Vor Ort in München</dt>
                <dd className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">Je nach Tutor und Terminverfügbarkeit.</dd>
              </div>
            </div>
          </dl>

          <p className="mt-6 text-sm leading-6 text-[var(--ink-muted)]">
            Das Matching fragt Fach, Ziel und Lernpräferenzen ab. Danach wählst du Tutor und Termin.
          </p>
        </aside>
      </div>
    </section>
  );
}
