const questions = [
  {
    question: 'Welche Fächer deckt das aktuelle Team ab?',
    answer:
      'Mathematik, Physik, Informatik, Biologie und Spanisch. Im Matching werden nur Tutoren vorgeschlagen, deren Profil zum gewählten Fach passt.',
  },
  {
    question: 'Findet die Nachhilfe online oder vor Ort statt?',
    answer:
      'Unterricht online ist ortsunabhängig möglich. Termine vor Ort in München hängen vom gewählten Tutor und seiner aktuellen Verfügbarkeit ab.',
  },
  {
    question: 'Was passiert in der kostenlosen Probestunde?',
    answer:
      'Die 60 Minuten dienen dem Kennenlernen und einer ersten Bedarfsanalyse. Tutor und Schüler:in klären Ziele, aktuelle Themen und einen sinnvollen nächsten Schritt. Das Angebot gilt einmalig für Neukund:innen.',
  },
  {
    question: 'Muss ich direkt ein Paket buchen?',
    answer:
      'Nein. Neben der Probestunde gibt es eine einzelne Stunde mit 60 Minuten für 39 €. Bezahlte Einzelstunden und Pakete werden nach bestätigtem Zahlungseingang als Buchungsguthaben im Account freigeschaltet.',
  },
  {
    question: 'Wie finde ich den passenden Tutor?',
    answer:
      'Das Matching fragt Fach, Lernziel, Unterrichtssprache und gewünschten Unterrichtsort ab. Anschließend lassen sich fachlich passende Profile und Termine vergleichen.',
  },
] as const;

export function FaqSection() {
  return (
    <section className="site-section section-rule" aria-labelledby="faq-title">
      <div className="site-container grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div>
          <p className="eyebrow">Kurz geklärt</p>
          <h2 id="faq-title" className="section-heading mt-6 text-[var(--ink)]">
            Häufige Fragen vor dem Start.
          </h2>
        </div>

        <div className="border-t border-[var(--line)]">
          {questions.map((item) => (
            <details key={item.question} className="group border-b border-[var(--line)]">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-bold text-[var(--ink)] marker:hidden">
                <span>{item.question}</span>
                <span className="text-xl font-normal text-[var(--purple-bright)] transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-6 pr-10 text-sm leading-7 text-[var(--ink-muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
