import Link from 'next/link';
import { ArrowRight, Check, MapPin, Monitor } from 'lucide-react';

const serviceFacts = [
  'Kostenlose 60-minütige Probestunde für Neukund:innen',
  'Danach ab 29 € pro 60 Minuten im 10er-Paket',
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10" aria-labelledby="hero-title">
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
          <p className="eyebrow">1:1 Nachhilfe · online &amp; in München</p>
          <h1
            id="hero-title"
            className="mt-7 max-w-[12ch] font-display text-[clamp(3.35rem,8.2vw,7.15rem)] font-medium leading-[0.9] tracking-[-0.055em] text-white"
          >
            Nicht mehr Stoff. Mehr Verständnis.
          </h1>
          <p className="text-pretty mt-7 max-w-2xl text-base leading-8 text-[#c1bdc8] sm:text-lg">
            Persönliche Nachhilfe für Schüler:innen in Mathematik, Physik, Informatik, Biologie und Spanisch. Ein passender junger Tutor arbeitet gezielt an Lücken, Aufgaben und Lernzielen.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/matching"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6e56cf] px-5 text-sm font-bold text-white transition-colors hover:bg-[#745bd1]"
            >
              Passenden Tutor finden
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              href="#tutoren"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-5 text-sm font-bold text-white transition-colors hover:border-white/35 hover:bg-white/5"
            >
              Tutoren ansehen
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 text-sm text-[#d5d1dc] sm:grid-cols-2" aria-label="Preisinformationen">
            {serviceFacts.map((fact) => (
              <li key={fact} className="flex items-start gap-2.5">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#9b83ff]" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="relative border border-white/10 bg-[#111118] p-6 sm:p-8" aria-label="Das MSM Angebot im Überblick">
          <div className="absolute -right-px -top-px h-20 w-20 border-r border-t border-[#6e56cf]" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Direkt geklärt</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] text-white sm:text-4xl">
            Lernen, wo es für euch passt.
          </h2>

          <dl className="mt-8 divide-y divide-white/10 border-y border-white/10">
            <div className="grid grid-cols-[2.25rem_1fr] gap-3 py-5">
              <Monitor aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#9b83ff]" />
              <div>
                <dt className="font-bold text-white">Online</dt>
                <dd className="mt-1 text-sm leading-6 text-[#aaa6b2]">Ortsunabhängig und direkt mit dem gewählten Tutor.</dd>
              </div>
            </div>
            <div className="grid grid-cols-[2.25rem_1fr] gap-3 py-5">
              <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#9b83ff]" />
              <div>
                <dt className="font-bold text-white">Vor Ort in München</dt>
                <dd className="mt-1 text-sm leading-6 text-[#aaa6b2]">Je nach Tutor und Terminverfügbarkeit.</dd>
              </div>
            </div>
          </dl>

          <p className="mt-6 text-sm leading-6 text-[#aaa6b2]">
            Das Matching fragt Fach, Ziel und Lernpräferenzen ab. Danach geht es zur Tutor- und Terminauswahl.
          </p>
        </aside>
      </div>
    </section>
  );
}
