import {
  Brain,
  CalendarCheck,
  GraduationCap,
  MessageSquareText,
  Target,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'Personalisierte Lernpläne',
    description:
      'Jeder Schüler erhält einen individuellen Lernplan, abgestimmt auf seine Ziele und Bedürfnisse.',
  },
  {
    icon: GraduationCap,
    title: 'Mentoring auf Augenhöhe',
    description:
      'Unsere Tutoren sind selbst Schüler oder Studenten und verstehen deine Herausforderungen aus eigener Erfahrung.',
  },
  {
    icon: Users,
    title: 'Individuelle Betreuung',
    description:
      'Intensive Einzelbetreuung für maximalen Lernerfolg. Kein Gruppenunterricht.',
  },
  {
    icon: Brain,
    title: 'Tiefgehendes Verständnis',
    description:
      'Wir legen Wert darauf, dass Konzepte wirklich verstanden und nicht nur auswendig gelernt werden.',
  },
  {
    icon: CalendarCheck,
    title: 'Flexible Buchung',
    description:
      'Onlinebuchung mit Verfügbarkeit in Echtzeit und einfacher Terminverwaltung.',
  },
  {
    icon: MessageSquareText,
    title: 'Direkte Kommunikation',
    description:
      'Ein integriertes Nachrichtensystem ermöglicht den schnellen Austausch mit deinem Tutor.',
  },
] as const;

export function FeaturesSection() {
  return (
    <section
      id="ablauf"
      className="site-section scroll-mt-24 border-y border-[var(--line)] bg-[var(--canvas-soft)]"
      aria-labelledby="features-title"
    >
      <div className="site-container">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
          <div>
            <p className="eyebrow">Warum MSM?</p>
            <h2 id="features-title" className="section-heading mt-6 text-[var(--ink)]">
              Mehr als nur Nachhilfe
            </h2>
          </div>
          <p className="text-pretty max-w-xl text-base leading-7 text-[var(--ink-muted)] lg:justify-self-end">
            Ein ganzheitliches Lernkonzept mit persönlicher Betreuung, klaren Zielen und direktem Austausch.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="bg-[var(--surface)] p-7 sm:p-8">
              <feature.icon aria-hidden="true" className="h-6 w-6 text-[var(--purple-bright)]" />
              <h3 className="mt-8 text-lg font-bold text-[var(--ink)]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
