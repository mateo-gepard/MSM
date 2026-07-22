import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Angaben zum Anbieter und Kontakt von MSM Munich Scholar Mentors.',
};

export default function LegalNoticePage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="site-container py-16 sm:py-24">
          <p className="eyebrow">Anbieterangaben</p>
          <h1 className="mt-6 max-w-4xl break-words font-display text-[clamp(3rem,8vw,6.5rem)] font-medium leading-[0.92] tracking-[-0.055em]">
            Impressum
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--ink-muted)] sm:text-lg">
            Informationen zum Kontakt und Anbieter der technischen Plattform für Vermittlung und
            Buchung von MSM Munich Scholar Mentors.
          </p>
        </div>
      </header>

      <div className="site-container py-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20">
          <article className="min-w-0 max-w-3xl">
            <LegalSection number="01" title="Anbieter der Plattform">
              <address className="not-italic">
                <p className="font-bold text-[var(--ink)]">Mateo Mamaladze (minderjährig)</p>
                <p className="mt-1">gesetzlich vertreten durch George Mamaladze</p>
                <p className="mt-5">
                  Welfenstraße 14<br />
                  81541 München<br />
                  Deutschland
                </p>
              </address>
            </LegalSection>

            <LegalSection number="02" title="Direkter Kontakt">
              <address className="grid gap-3 not-italic">
                <ContactRow label="E Mail des Anbieters" href="mailto:mateo.mamaladze@gmail.com">
                  mateo.mamaladze@gmail.com
                </ContactRow>
                <ContactRow label="Kontakt zu MSM" href="mailto:munichscholarmentors@gmail.com">
                  munichscholarmentors@gmail.com
                </ContactRow>
                <ContactRow label="Telefon" href="tel:+4917652547548">
                  +49 176 52547548
                </ContactRow>
              </address>
            </LegalSection>

            <LegalSection number="03" title="Art des Angebots">
              <p>
                Die Website bietet technische Funktionen zur Auswahl von Tutoren, zur Terminbuchung
                und zur Kommunikation zwischen einem Kunden und einem zugeordneten Tutor. Sie zeigt
                außerdem Preise für Einzelstunden und Stundenpakete.
              </p>
              <p>
                Stripe Checkout ist technisch vorbereitet, neue Zahlungen sind aber bis zur
                ausdrücklichen rechtlichen und betrieblichen Freigabe gesperrt. Wer bei einer
                kostenpflichtigen Nachhilfeleistung Vertragspartner ist und in wessen Namen Zahlungen
                entgegengenommen werden, muss vor dieser Freigabe verbindlich festgelegt werden. Die
                aktuelle <Link className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white" href="/agb">AGB Arbeitsfassung</Link> weist diese
                offene Frage ausdrücklich aus.
              </p>
            </LegalSection>

            <LegalSection number="04" title="Redaktionell Verantwortlicher">
              <p>
                Soweit für Inhalte dieses Angebots § 18 Abs. 2 Medienstaatsvertrag anwendbar ist, ist
                als redaktionell Verantwortlicher angegeben:
              </p>
              <address className="mt-4 not-italic">
                <p className="font-bold text-[var(--ink)]">George Mamaladze</p>
                <p>
                  Welfenstraße 14<br />
                  81541 München<br />
                  Deutschland
                </p>
              </address>
            </LegalSection>

            <LegalSection number="05" title="Vor Veröffentlichung zu bestätigen">
              <p>
                Aus dem Projekt lässt sich nicht sicher feststellen, ob weitere anbieterbezogene
                Pflichtangaben einschlägig sind. Vor dem Produktivstart ist deshalb zu prüfen und zu
                dokumentieren:
              </p>
              <ul className="mt-5 space-y-3">
                <ReviewItem>
                  die genaue rechtliche Konstellation von Betreiber und Vertretung, insbesondere im
                  Hinblick auf den minderjährigen Anbieter;
                </ReviewItem>
                <ReviewItem>
                  eine gegebenenfalls vorhandene Rechtsform, Registereintragung, Registernummer oder
                  Wirtschaftsidentifikationsnummer sowie eine gegebenenfalls zuständige
                  Aufsichtsbehörde;
                </ReviewItem>
                <ReviewItem>
                  eine Umsatzsteueridentifikationsnummer, aber nur sofern tatsächlich eine solche
                  Nummer erteilt wurde;
                </ReviewItem>
                <ReviewItem>
                  ob die Voraussetzungen für Angaben nach dem Verbraucherstreitbeilegungsgesetz
                  vorliegen und welche Erklärung der Betreiber hierzu abgeben will;
                </ReviewItem>
                <ReviewItem>
                  ob das Angebot journalistisch und redaktionell gestaltet ist und die oben genannte
                  Verantwortlichenangabe deshalb erforderlich ist.
                </ReviewItem>
              </ul>
            </LegalSection>

            <footer className="mt-14 border-t border-[var(--line)] pt-6 text-sm text-[var(--ink-subtle)]">
              Technischer Arbeitsstand: 22. Juli 2026 · Rechtliche Prüfung ausstehend
            </footer>
          </article>

          <aside className="lg:sticky lg:top-28 lg:self-start" aria-labelledby="legal-review-heading">
            <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200">Prüfstatus</p>
              <h2 id="legal-review-heading" className="mt-3 text-lg font-bold text-amber-50">
                Betreiberangaben noch nicht rechtlich freigegeben
              </h2>
              <p className="mt-3 text-sm leading-6 text-amber-50/75">
                Name, Vertretung, Anschrift, E Mail und Telefon wurden aus der bestehenden Seite
                übernommen. Fehlende Angaben zu Register, Steuern oder Aufsicht wurden nicht erfunden.
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
              <h2 className="text-sm font-bold text-[var(--ink)]">Offizielle Grundlagen</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--ink-muted)]">
                <li>
                  <a
                    className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white"
                    href="https://www.gesetze-im-internet.de/ddg/__5.html"
                    rel="noreferrer"
                    target="_blank"
                  >
                    § 5 DDG: Allgemeine Informationspflichten
                    <span className="sr-only"> (öffnet in einem neuen Tab)</span>
                  </a>
                </li>
                <li>
                  <a
                    className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white"
                    href="https://www.gesetze-bayern.de/Content/Document/MStV-18"
                    rel="noreferrer"
                    target="_blank"
                  >
                    § 18 MStV: Informationspflichten
                    <span className="sr-only"> (öffnet in einem neuen Tab)</span>
                  </a>
                </li>
                <li>
                  <a
                    className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white"
                    href="https://www.gesetze-im-internet.de/vsbg/__36.html"
                    rel="noreferrer"
                    target="_blank"
                  >
                    § 36 VSBG: Verbraucherstreitbeilegung
                    <span className="sr-only"> (öffnet in einem neuen Tab)</span>
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function LegalSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--line)] py-9 first:border-t-0 first:pt-0">
      <div className="grid gap-4 sm:grid-cols-[2.75rem_minmax(0,1fr)]">
        <span aria-hidden="true" className="pt-1 font-mono text-xs font-bold text-[var(--purple-bright)]">
          {number}
        </span>
        <div>
          <h2 className="font-display text-3xl font-medium tracking-[-0.035em] sm:text-4xl">{title}</h2>
          <div className="mt-5 space-y-4 text-[0.98rem] leading-7 text-[var(--ink-muted)]">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <span className="text-sm font-semibold text-[var(--ink-subtle)]">{label}</span>
      <a className="w-fit break-all text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white" href={href}>{children}</a>
    </div>
  );
}

function ReviewItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--purple-bright)]" />
      <span>{children}</span>
    </li>
  );
}
