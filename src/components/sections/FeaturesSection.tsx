import { CalendarCheck, Focus, MessageSquareText, Route, Search, UserRoundCheck } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Bedarf eingrenzen',
    description: 'Fach, Ziel, Lernpräferenzen und zeitlichen Bedarf im Matching angeben.',
  },
  {
    number: '02',
    icon: UserRoundCheck,
    title: 'Tutor auswählen',
    description: 'Passende Profile vergleichen und eine konkrete Präferenz festhalten.',
  },
  {
    number: '03',
    icon: CalendarCheck,
    title: 'Probestunde buchen',
    description: 'In 60 Minuten kennenlernen, Ausgangslage klären und nächste Schritte besprechen.',
  },
] as const;

const learningPrinciples = [
  {
    icon: MessageSquareText,
    title: 'Erklären statt vorsagen',
    description: 'Gedankengänge werden nachvollziehbar gemacht, bis der Lösungsweg eigenständig sitzt.',
  },
  {
    icon: Focus,
    title: 'Am echten Bedarf arbeiten',
    description: 'Aktueller Schulstoff, konkrete Aufgaben und persönliche Lücken bestimmen die Stunde.',
  },
  {
    icon: Route,
    title: 'Den nächsten Schritt kennen',
    description: 'Jede Einheit ordnet ein, was schon verstanden ist und woran als Nächstes gearbeitet wird.',
  },
] as const;

export function FeaturesSection() {
  return (
    <>
      <section id="ablauf" className="site-section scroll-mt-24 bg-[#0d0d13]" aria-labelledby="ablauf-title">
        <div className="site-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow">So funktioniert’s</p>
            <h2 id="ablauf-title" className="section-heading mt-6 text-white">
              Von der Frage zum passenden Start.
            </h2>
            <p className="text-pretty mt-6 max-w-md text-base leading-7 text-[#aaa6b2]">
              Das Matching schafft eine klare Grundlage. Ihr entscheidet anschließend selbst, welcher Tutor und welches Format passen.
            </p>
          </div>

          <ol className="border-t border-white/10">
            {steps.map((step) => (
              <li key={step.number} className="grid gap-4 border-b border-white/10 py-7 sm:grid-cols-[3rem_1fr_auto] sm:items-start sm:gap-6">
                <span className="font-mono text-xs font-bold tracking-[0.16em] text-[#9b83ff]">{step.number}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#aaa6b2]">{step.description}</p>
                </div>
                <step.icon aria-hidden="true" className="hidden h-5 w-5 text-[#77727f] sm:block" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-section section-rule" aria-labelledby="lernwert-title">
        <div className="site-container">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <p className="eyebrow">Lernwert</p>
              <h2 id="lernwert-title" className="section-heading mt-6 text-white">
                Eine Stunde, die weiterführt.
              </h2>
            </div>
            <p className="text-pretty max-w-xl text-base leading-7 text-[#aaa6b2] lg:justify-self-end">
              1:1 Unterricht schafft Raum für Rückfragen, eigenes Tempo und konzentrierte Übung – ohne eine starre Gruppenagenda.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
            {learningPrinciples.map((principle) => (
              <article key={principle.title} className="bg-[#111118] p-7 sm:p-8">
                <principle.icon aria-hidden="true" className="h-5 w-5 text-[#9b83ff]" />
                <h3 className="mt-8 text-lg font-bold text-white">{principle.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#aaa6b2]">{principle.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
