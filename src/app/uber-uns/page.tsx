import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { TUTOR_CATALOG, getSubjectName } from '@/domain/catalog';

export const metadata: Metadata = {
  title: 'Über uns',
  description:
    'Lerne MSM Munich Scholar Mentors, unsere Mission und unseren persönlichen Ansatz für individuelle Nachhilfe kennen.',
};

const journey = [
  {
    number: '01',
    title: 'Kennenlernen',
    description: 'Du wählst deinen Tutor basierend auf Fach, Ziel, Sprache und Unterrichtsort.',
  },
  {
    number: '02',
    title: 'Erste Session',
    description: 'Wir analysieren deine Stärken und Schwächen und definieren klare Ziele.',
  },
  {
    number: '03',
    title: 'Maßgeschneiderter Plan',
    description: 'Dein Tutor entwickelt einen individuellen Lernplan für maximalen Fortschritt.',
  },
  {
    number: '04',
    title: 'Kontinuierlicher Erfolg',
    description: 'Regelmäßige Sessions schaffen messbare Fortschritte und nachhaltige Verbesserung.',
  },
] as const;

const values = [
  {
    title: 'Exzellenz',
    description:
      'Unsere Tutoren bringen starke fachliche Leistungen und Erfahrungen aus Wettbewerben oder Frühstudium mit.',
  },
  {
    title: 'Leidenschaft',
    description:
      'Wir brennen für unsere Fächer und geben diese Begeisterung an unsere Schüler weiter. Lernen soll Spaß machen.',
  },
  {
    title: 'Individualität',
    description:
      'Jeder Schüler ist einzigartig. Wir passen unseren Unterricht an jeden Lerntyp, jedes Tempo und jedes Ziel an.',
  },
  {
    title: 'Messbare Erfolge',
    description:
      'Wir setzen auf konkrete Fortschritte: bessere Noten, tieferes Verständnis und mehr Selbstvertrauen in die eigenen Fähigkeiten.',
  },
] as const;

const missionPoints = [
  'Wettbewerbserfahrene Mentoren',
  'Mentoring auf Augenhöhe',
  'Individuelle Lernpläne',
  'Messbare Fortschritte',
] as const;

const activeSubjectNames = Array.from(
  new Set(TUTOR_CATALOG.flatMap((tutor) => tutor.subjectIds.map(getSubjectName))),
);

export default function UberUnsPage() {
  return (
    <>
      <section
        className="site-section border-b border-[var(--line)] bg-[var(--canvas-soft)]"
        aria-labelledby="about-title"
      >
        <div className="site-container grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
          <div>
            <p className="eyebrow">Munich Scholar Mentors</p>
            <h1
              id="about-title"
              className="mt-7 max-w-[12ch] font-display text-[clamp(3.3rem,8vw,6.7rem)] font-medium leading-[0.92] tracking-[-0.055em] text-[var(--ink)]"
            >
              Über MSM
            </h1>
            <p className="text-pretty mt-7 max-w-2xl text-base leading-8 text-[var(--ink-muted)] sm:text-lg">
              Persönliches Mentoring durch außergewöhnliche junge Talente.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/matching"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-5 text-sm font-bold text-white hover:bg-[var(--action-hover)]"
              >
                Jetzt starten
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/#tutoren"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--line-strong)] px-5 text-sm font-bold text-[var(--ink)] hover:bg-white/5"
              >
                Tutoren kennenlernen
              </Link>
            </div>
          </div>

          <aside
            className="border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"
            aria-label="Das aktuelle Tutorenteam"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
              <h2 className="text-sm font-bold text-[var(--ink)]">Aktuelles Team</h2>
              <span className="text-xs text-[var(--ink-subtle)]">
                {TUTOR_CATALOG.length} Tutorprofile
              </span>
            </div>
            <ul className="mt-2 divide-y divide-[var(--line)]">
              {TUTOR_CATALOG.map((tutor) => (
                <li key={tutor.slug} className="flex items-center gap-3 py-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <Image src={tutor.image} alt="" fill sizes="44px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--ink)]">{tutor.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--ink-subtle)]">
                      {tutor.subjectIds.map(getSubjectName).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="site-section" aria-labelledby="journey-title">
        <div className="site-container">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
            <div>
              <p className="eyebrow">Deine Reise</p>
              <h2 id="journey-title" className="section-heading mt-6 text-[var(--ink)]">
                Deine Reise zu Spitzenleistungen
              </h2>
            </div>
            <p className="text-base leading-7 text-[var(--ink-muted)] lg:justify-self-end">
              In vier Schritten zum nachhaltigen Lernerfolg.
            </p>
          </div>

          <ol className="mt-12 grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
            {journey.map((item) => (
              <li key={item.number} className="bg-[var(--surface)] p-7 sm:p-8">
                <span className="font-mono text-xs font-bold tracking-[0.14em] text-[var(--purple-bright)]">
                  {item.number}
                </span>
                <h3 className="mt-8 text-xl font-bold text-[var(--ink)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="site-section border-y border-[var(--line)] bg-[var(--canvas-soft)]"
        aria-labelledby="mission-title"
      >
        <div className="site-container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div>
            <p className="eyebrow">Warum MSM?</p>
            <h2 id="mission-title" className="section-heading mt-6 text-[var(--ink)]">
              Unsere Mission
            </h2>
          </div>
          <div>
            <p className="text-pretty text-base leading-8 text-[var(--ink-muted)]">
              MSM wurde gegründet, um außergewöhnlichen Schülern eine Plattform zu bieten, ihr Wissen und ihre Begeisterung weiterzugeben. Wir glauben daran, dass die besten Lehrer nicht nur fachlich exzellent sind, sondern auch die Sprache der Schüler sprechen.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {missionPoints.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-[var(--purple-bright)]" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-2" aria-label="Fächer des aktuellen Teams">
              {activeSubjectNames.map((subject) => (
                <span
                  key={subject}
                  className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--purple-soft)]"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section" aria-labelledby="values-title">
        <div className="site-container">
          <p className="eyebrow">Unsere Werte</p>
          <h2 id="values-title" className="section-heading mt-6 text-[var(--ink)]">
            Was uns antreibt
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
            {values.map((value) => (
              <article key={value.title} className="bg-[var(--surface)] p-7 sm:p-8">
                <h3 className="text-xl font-bold text-[var(--ink)]">{value.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{value.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 sm:pb-28" aria-labelledby="about-cta-title">
        <div className="site-container">
          <div className="border border-[var(--line-strong)] bg-[var(--surface-accent)] p-7 sm:p-10 lg:flex lg:items-end lg:justify-between lg:gap-12">
            <div>
              <h2
                id="about-cta-title"
                className="max-w-xl font-display text-4xl font-medium leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-5xl"
              >
                Bereit durchzustarten?
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-muted)]">
                Finde deinen passenden Tutor und erlebe, wie Lernen mit engagierten Mentoren Spaß macht und echte Fortschritte bringt.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <Link
                href="/#preise"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--line-strong)] px-5 text-sm font-bold text-[var(--ink)] hover:bg-white/5"
              >
                Preise ansehen
              </Link>
              <Link
                href="/matching"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--action)] px-5 text-sm font-bold text-white hover:bg-[var(--action-hover)]"
              >
                Jetzt Tutor finden
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
