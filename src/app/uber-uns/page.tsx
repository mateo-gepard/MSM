import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TUTOR_CATALOG, getSubjectName } from '@/domain/catalog';

export const metadata: Metadata = {
  title: 'Über uns',
  description:
    'Erfahre, wie MSM Schüler:innen mit einem passenden 1:1 Tutor zusammenbringt und worauf es im Unterricht ankommt.',
};

const principles = [
  {
    number: '01',
    title: 'Konkrete Profile',
    description: 'Fächer, Sprachen, Verfügbarkeit und persönliche Stationen werden pro Tutor sichtbar gemacht.',
  },
  {
    number: '02',
    title: 'Individuelle Auswahl',
    description: 'Das Matching beginnt beim Bedarf des Schülers – nicht bei einem vorgegebenen Standardprogramm.',
  },
  {
    number: '03',
    title: 'Verständliche Konditionen',
    description: 'Probestunde, Einzelstunde und Pakete stehen mit Dauer und Preis offen nebeneinander.',
  },
] as const;

const process = [
  'Fach, Ziel und Lernpräferenzen im Matching festhalten',
  'Passende Tutorprofile vergleichen',
  'Kostenlose 60-minütige Probestunde buchen',
  'Einzelstunde oder Paket nur bei Bedarf wählen',
] as const;

const activeSubjectNames = Array.from(
  new Set(TUTOR_CATALOG.flatMap((tutor) => tutor.subjectIds.map(getSubjectName))),
);

export default function UberUnsPage() {
  return (
    <>
      <section className="site-section border-b border-white/10 bg-[#0d0d13]" aria-labelledby="about-title">
        <div className="site-container grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
          <div>
            <p className="eyebrow">Über MSM</p>
            <h1
              id="about-title"
              className="mt-7 max-w-[12ch] font-display text-[clamp(3.3rem,8vw,6.7rem)] font-medium leading-[0.92] tracking-[-0.055em] text-white"
            >
              Persönliche Nachhilfe beginnt mit der passenden Person.
            </h1>
            <p className="text-pretty mt-7 max-w-2xl text-base leading-8 text-[#bbb7c2] sm:text-lg">
              MSM bringt Schüler:innen mit fünf jungen Tutoren zusammen. Im Mittelpunkt stehen 1:1 Unterricht, ein klarer fachlicher Fit und ein Start ohne Paketbindung.
            </p>
          </div>

          <aside className="border border-white/10 bg-[#111118] p-5 sm:p-7" aria-label="Das aktuelle Tutorenteam">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <h2 className="text-sm font-bold text-white">Aktuelles Team</h2>
              <span className="text-xs text-[#8f8a97]">{TUTOR_CATALOG.length} Tutorprofile</span>
            </div>
            <ul className="mt-2 divide-y divide-white/10">
              {TUTOR_CATALOG.map((tutor) => (
                <li key={tutor.slug} className="flex items-center gap-3 py-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#1b1b24]">
                    <Image
                      src={tutor.image}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{tutor.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#8f8a97]">
                      {tutor.subjectIds.map(getSubjectName).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="site-section" aria-labelledby="idea-title">
        <div className="site-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div>
            <p className="eyebrow">Die Idee</p>
            <h2 id="idea-title" className="section-heading mt-6 text-white">
              Weniger Versprechen. Mehr relevante Information.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-8 text-[#aaa6b2]">
            <p>
              Vor einer Nachhilfestunde zählen vor allem praktische Fragen: Beherrscht der Tutor das Fach? Passt seine Art zu erklären? Ist ein Termin online oder in München möglich? Und was kostet die nächste Einheit?
            </p>
            <p>
              MSM ordnet den Weg genau um diese Fragen. Die fünf Tutorprofile zeigen konkrete Schwerpunkte und Verfügbarkeiten. Das Matching grenzt die Auswahl ein; die kostenlose Probestunde schafft Raum, den persönlichen Fit zu prüfen.
            </p>
            <div className="flex flex-wrap gap-2 pt-2" aria-label="Fächer des aktuellen Teams">
              {activeSubjectNames.map((subject) => (
                <span key={subject} className="rounded-md border border-white/10 bg-[#111118] px-3 py-1.5 text-xs font-bold text-[#d7ceff]">
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section border-y border-white/10 bg-[#0d0d13]" aria-labelledby="principles-title">
        <div className="site-container">
          <p className="eyebrow">Unsere Leitlinien</p>
          <h2 id="principles-title" className="section-heading mt-6 text-white">
            Klar vor der ersten Stunde.
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
            {principles.map((principle) => (
              <article key={principle.number} className="bg-[#111118] p-7 sm:p-8">
                <span className="font-mono text-xs font-bold tracking-[0.14em] text-[#9b83ff]">{principle.number}</span>
                <h3 className="mt-9 text-xl font-bold text-white">{principle.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#aaa6b2]">{principle.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section" aria-labelledby="about-process-title">
        <div className="site-container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-24">
          <div>
            <p className="eyebrow">Der Prozess</p>
            <h2 id="about-process-title" className="section-heading mt-6 text-white">
              Vier Schritte, eine klare Entscheidung.
            </h2>
          </div>

          <ol className="border-t border-white/10">
            {process.map((item, index) => (
              <li key={item} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-white/10 py-5 text-sm leading-6 text-[#c4c0ca]">
                <span className="font-mono text-xs font-bold text-[#9b83ff]">0{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-20 sm:pb-28" aria-labelledby="about-cta-title">
        <div className="site-container">
          <div className="border border-[#4b406f] bg-[#171522] p-7 sm:p-10 lg:flex lg:items-end lg:justify-between lg:gap-12">
            <div>
              <h2 id="about-cta-title" className="max-w-xl font-display text-4xl font-medium leading-none tracking-[-0.04em] text-white sm:text-5xl">
                Passt der Ansatz zu eurem Lernziel?
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#bbb5c4]">
                Startet mit dem Matching oder schaut euch zuerst alle fünf Tutorprofile an.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Link
                href="/#tutoren"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-5 text-sm font-bold text-white hover:bg-white/5"
              >
                Tutoren ansehen
              </Link>
              <Link
                href="/matching"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#6e56cf] px-5 text-sm font-bold text-white hover:bg-[#745bd1]"
              >
                Matching starten
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
