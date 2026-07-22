import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen',
  description: 'Arbeitsstand der Bedingungen für Nutzung und Buchung bei MSM Munich Scholar Mentors.',
};

const navigation = [
  { href: '#status', label: 'Status dieser Fassung' },
  { href: '#funktionen', label: 'Funktionen der Plattform' },
  { href: '#konto', label: 'Nutzerkonto' },
  { href: '#buchung', label: 'Buchung und Termine' },
  { href: '#pakete', label: 'Pakete und Zahlung' },
  { href: '#kommunikation', label: 'Kommunikation' },
  { href: '#offen', label: 'Offene Vertragsfragen' },
] as const;

const openQuestions = [
  'Wer bei kostenpflichtigem Unterricht Vertragspartner des Kunden ist und in wessen Namen Preise ausgewiesen sowie Zahlungen entgegengenommen werden.',
  'Wie Verträge zustande kommen, welche Leistungsbeschreibung gilt und welche Regeln für Minderjährige sowie die Zustimmung gesetzlicher Vertreter vorgesehen sind.',
  'Ob angezeigte Preise Umsatzsteuer enthalten und welche Regeln für Rechnungen, Zahlungen, Erstattungen und den Ablauf von Paketen gelten.',
  'Welche Fristen, Folgen oder Gebühren bei Stornierungen, Umbuchungen, Nichterscheinen oder technischen Ausfällen gelten.',
  'Welche Verbraucherinformationen, Widerrufsbelehrung, Haftungsregeln und Streitbeilegungsangaben für das konkrete Geschäftsmodell erforderlich sind.',
] as const;

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="site-container py-16 sm:py-24">
          <p className="eyebrow">Rechtliches</p>
          <h1 className="mt-6 max-w-4xl break-words font-display text-[clamp(3rem,8vw,6.5rem)] font-medium leading-[0.92] tracking-[-0.055em]">
            Allgemeine Geschäftsbedingungen
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--ink-muted)] sm:text-lg">
            Diese Seite bildet den derzeit implementierten Funktionsumfang der Plattform ab. Sie ist
            bewusst als prüfpflichtige Arbeitsfassung gekennzeichnet, solange zentrale Vertragsfragen
            nicht verbindlich entschieden sind.
          </p>

          <div
            className="mt-10 max-w-3xl rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6"
            role="note"
            aria-labelledby="terms-review-title"
          >
            <p id="terms-review-title" className="text-sm font-bold text-amber-100">
              Nicht für den ungeprüften Verkauf kostenpflichtiger Leistungen freigegeben
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-50/75">
              Vor dem Produktivbetrieb müssen insbesondere Vertragspartner, Zahlungsweg,
              Verbraucherrechte und die Einbindung minderjähriger Beteiligter rechtlich geprüft und
              ergänzt werden.
            </p>
          </div>
        </div>
      </header>

      <div className="site-container grid gap-12 py-12 sm:py-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="Inhalt der AGB" className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-subtle)]">
            Auf dieser Seite
          </p>
          <ol className="mt-5 space-y-1 border-l border-[var(--line)]">
            {navigation.map((item, index) => (
              <li key={item.href}>
                <a
                  className="block py-2 pl-4 text-sm leading-6 text-[var(--ink-muted)] transition-colors hover:text-white"
                  href={item.href}
                >
                  <span className="mr-2 font-mono text-[var(--ink-subtle)]">0{index + 1}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-3xl">
          <LegalSection id="status" number="01" title="Status dieser Fassung">
            <p>
              Diese Arbeitsfassung beschreibt die technisch verfügbaren Funktionen für Konten,
              Buchungen und Chats. Sie legt noch nicht abschließend fest, wer eine Nachhilfeleistung
              schuldet, wer Zahlungen entgegennimmt oder welche Verbraucherbedingungen gelten.
            </p>
            <p>
              Sie ersetzt daher weder eine individuell geprüfte Vertragsgestaltung noch die vor einem
              kostenpflichtigen Vertragsschluss erforderlichen Verbraucherinformationen.
            </p>
          </LegalSection>

          <LegalSection id="funktionen" number="02" title="Funktionen der Plattform">
            <p>
              MSM Munich Scholar Mentors stellt eine Webanwendung bereit, in der Interessierte Fächer
              und Tutoren vergleichen, verfügbare Zeiten abrufen und Termine anfragen beziehungsweise
              buchen können. Nach einer autorisierten Buchung kann ein direkter Chat zwischen dem
              zugeordneten Tutor und dem Kunden freigeschaltet werden.
            </p>
            <p>
              Die Plattform nutzt Supabase für Konten und gespeicherte Anwendungsdaten, Stripe für
              die technisch vorbereitete Zahlungsabwicklung, Cal.com für Verfügbarkeiten und Termine
              sowie Sendbird für den Chat. Weitere Einzelheiten stehen in
              der <Link className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white" href="/datenschutz">Datenschutzerklärung</Link>.
            </p>
          </LegalSection>

          <LegalSection id="konto" number="03" title="Nutzerkonto und Zugriffsrollen">
            <p>
              Für eine Buchung ist ein authentifiziertes Konto erforderlich. Konten werden zunächst
              als Konto für Eltern oder Kunden angelegt. Tutorzugänge werden serverseitig einem konkreten
              Tutorprofil zugeordnet; die Auswahl eines Namens im Browser verleiht keine Tutorrolle.
            </p>
            <p>
              Nutzer sollten ihre Kontaktdaten aktuell halten und Zugangsdaten nicht weitergeben. Wie
              Konten gekündigt und zugehörige Daten gelöscht werden, muss vor dem Produktivstart als
              verbindlicher Prozess dokumentiert werden.
            </p>
          </LegalSection>

          <LegalSection id="buchung" number="04" title="Buchung, Umbuchung und Stornierung">
            <p>
              Verfügbare Zeiten werden live über Cal.com abgerufen. Vor dem Absenden zeigt die
              Anwendung Tutor, Fach, Paket, Termin, Unterrichtsformat und Kontaktdaten zur Kontrolle
              an. Eine Buchung wird erst dann als erfolgreich angezeigt, wenn der Termin beim
              Kalenderdienst angelegt und anschließend in der Datenbank von MSM gespeichert wurde.
            </p>
            <p>
              Angemeldete Nutzer können eigene, noch zukünftige und geplante Termine über ihr
              Dashboard stornieren oder umbuchen. Bei einer erfolgreich verarbeiteten Stornierung wird
              eine zuvor verbrauchte, bezahlte Unterrichtseinheit genau einmal dem zugehörigen
              Guthaben gutgeschrieben; für eine kostenlose Probestunde gibt es kein Guthaben. Konkrete
              Fristen, mögliche Kostenfolgen und Regeln bei Nichterscheinen sind in dieser Fassung noch
              nicht vereinbart und müssen vor kostenpflichtigen Buchungen ergänzt werden.
            </p>
            <p>
              Die kostenlose Probestunde ist technisch auf Haushalte ohne vorherige Buchung und ohne
              bereits bestätigten Paketkauf beschränkt. Ob daneben weitere Teilnahmebedingungen
              gelten, muss separat festgelegt werden.
            </p>
          </LegalSection>

          <LegalSection id="pakete" number="05" title="Pakete, Guthaben und Zahlung">
            <p>
              Die Website zeigt eine kostenlose Probestunde sowie kostenpflichtige Pakete für eine
              oder mehrere Stunden. Stripe Checkout ist technisch eingebunden. Neue Zahlungen bleiben
              jedoch gesperrt, solange die rechtliche und betriebliche Freigabe oder das konkret
              geprüfte Angebot nicht aktiviert ist. Bei einer Freigabe erfolgt die Eingabe von
              Zahlungsdaten ausschließlich auf der von Stripe bereitgestellten Zahlungsseite; MSM
              erhält weder vollständige Kartendaten noch vollständige Bankdaten.
            </p>
            <p>
              Eine kostenpflichtige Stunde kann technisch nur mit einem serverseitig als bezahlt
              bestätigten Stundenguthaben gebucht werden. Die Anwendung erzeugt ein solches Guthaben
              weder aufgrund einer Eingabe im Browser noch aufgrund der Rückkehr von der
              Zahlungsseite. Erst ein signiertes und vollständig geprüftes Stripe Ereignis kann die
              Bestellung bestätigen und das zugehörige Guthaben genau einmal freigeben. Die
              rechtlichen Regeln für Vertragsschluss, Rechnung, Ablauf und Erstattung sind in dieser
              Arbeitsfassung weiterhin nicht festgelegt.
            </p>
          </LegalSection>

          <LegalSection id="kommunikation" number="06" title="Kommunikation">
            <p>
              Der Chat ist nur für authentifizierte Nutzer und einen durch eine Buchung autorisierten
              Kontakt zwischen Tutor und Kunde vorgesehen. Nutzer dürfen keine Zugangsdaten, rechtswidrigen Inhalte
              oder unnötig sensiblen Informationen über den Chat versenden.
            </p>
            <p>
              Prozesse für Moderation, Meldung, Sperrung und Löschung von Nachrichten sind vor einem breiten
              Produktivbetrieb organisatorisch festzulegen. Die aktuelle Fassung verspricht keine
              inhaltliche Vorabkontrolle von Nachrichten.
            </p>
          </LegalSection>

          <LegalSection id="offen" number="07" title="Vor dem Produktivstart zu klären">
            <p>
              Die folgenden Punkte lassen sich aus dem Quellcode nicht rechtssicher ableiten und dürfen
              deshalb nicht durch pauschale Klauseln ersetzt werden:
            </p>
            <ul className="mt-5 space-y-3">
              {openQuestions.map((question) => (
                <li key={question} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--purple-bright)]" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6">
              Angaben zum Betreiber und Kontakt sind im <Link className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white" href="/impressum">Impressum</Link> aufgeführt.
            </p>
          </LegalSection>

          <footer className="mt-14 border-t border-[var(--line)] pt-6 text-sm text-[var(--ink-subtle)]">
            Technischer Arbeitsstand: 22. Juli 2026 · Rechtliche Prüfung ausstehend
          </footer>
        </article>
      </div>
    </div>
  );
}

function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-[var(--line)] py-9 first:border-t-0 first:pt-0">
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
