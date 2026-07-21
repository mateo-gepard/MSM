import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutz | MSM Munich Scholar Mentors',
  description: 'Technische Datenschutzinformationen zu Konten, Buchungen und Chat bei MSM.',
};

const navigation = [
  { href: '#status', label: 'Status und Verantwortung' },
  { href: '#datenfluesse', label: 'Datenflüsse' },
  { href: '#dienste', label: 'Eingesetzte Dienste' },
  { href: '#cookies', label: 'Cookies und Tracking' },
  { href: '#rechte', label: 'Ihre Rechte' },
  { href: '#offen', label: 'Offene Pflichtangaben' },
] as const;

const processingGroups = [
  {
    title: 'Konto und Anmeldung',
    data: 'E-Mail-Adresse, Anmeldeinformationen, Sitzungskennungen, optionaler Anzeigename sowie die serverseitig zugewiesene Rolle.',
    purpose: 'Registrierung, Anmeldung, Sitzungsverwaltung und Zugriffsschutz.',
  },
  {
    title: 'Buchung und Terminverwaltung',
    data: 'Tutor, Fach, Paket, Startzeit, Zeitzone, Unterrichtsformat, Treffpunkt bei Vor-Ort-Terminen, Name, Konto-E-Mail, optionale Telefonnummer und optionale Nachricht.',
    purpose: 'Verfügbarkeitsabfrage, Terminbuchung, Umbuchung, Stornierung und Anzeige im rollenbasierten Dashboard.',
  },
  {
    title: 'Stundenguthaben',
    data: 'Paket, Anzahl und Verbrauch von Stunden, Status, außerhalb der Website bestätigter Zahlungsstatus, Referenz und erfasster Betrag.',
    purpose: 'Prüfung, ob eine kostenpflichtige Buchung durch ein verifiziertes Guthaben gedeckt ist.',
  },
  {
    title: 'Nachrichten',
    data: 'Pseudonymisierte technische Nutzerkennung, Anzeigename, Kanalzuordnung, Nachrichteninhalte und zugehörige Metadaten.',
    purpose: 'Direkter Chat zwischen einem Kunden und dem Tutor, der einer Buchung zugeordnet ist.',
  },
] as const;

const unresolvedItems = [
  'Rechtsgrundlage und, falls Art. 6 Abs. 1 lit. f DSGVO genutzt wird, das konkrete berechtigte Interesse für jeden einzelnen Verarbeitungsvorgang.',
  'Produktiver Hostinganbieter, Serverstandort, Umfang der Zugriffsprotokolle und deren Aufbewahrungsdauer.',
  'Vertragliche Rollen, Auftragsverarbeitungsvereinbarungen, gewählte Datenregionen und mögliche Drittlandübermittlungen bei Supabase, Cal.com, Sendbird und dem Hostinganbieter.',
  'Ein verbindliches Lösch- und Aufbewahrungskonzept für Konten, Buchungen, Zahlungsreferenzen, Kalenderdaten, Protokolle und Chatnachrichten.',
  'Der organisatorische Prozess für Auskunft, Berichtigung, Löschung, Export, Kontoschließung und Datenschutzvorfälle.',
  'Ob und wie Minderjährige die Plattform selbst nutzen dürfen, einschließlich Altersprüfung und Einbindung gesetzlicher Vertreter.',
  'Ob ein Datenschutzbeauftragter bestellt ist oder bestellt werden muss; aus dem Projekt ist keine entsprechende Stelle ersichtlich.',
] as const;

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="site-container py-16 sm:py-24">
          <p className="eyebrow">Datentransparenz</p>
          <h1 className="mt-6 max-w-4xl font-display text-[clamp(3rem,8vw,6.5rem)] font-medium leading-[0.92] tracking-[-0.055em]">
            Datenschutzerklärung
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--ink-muted)] sm:text-lg">
            Diese Fassung dokumentiert die im aktuellen Anwendungscode erkennbaren Datenflüsse. Wo
            Betreiberentscheidungen oder produktive Dienstkonfigurationen fehlen, kennzeichnen wir das
            offen, statt nicht belegte Zusagen zu machen.
          </p>

          <div
            className="mt-10 max-w-3xl rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6"
            role="note"
            aria-labelledby="privacy-review-title"
          >
            <p id="privacy-review-title" className="text-sm font-bold text-amber-100">
              Technische Bestandsaufnahme – rechtliche Freigabe ausstehend
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-50/75">
              Rechtsgrundlagen, Aufbewahrungsfristen, Hosting und internationale Datenübermittlungen
              müssen anhand der tatsächlich gewählten Anbieter-Konten und Verträge vervollständigt
              werden, bevor die Plattform produktiv personenbezogene Daten verarbeitet.
            </p>
          </div>
        </div>
      </header>

      <div className="site-container grid gap-12 py-12 sm:py-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="Inhalt der Datenschutzerklärung" className="lg:sticky lg:top-28 lg:self-start">
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
          <LegalSection id="status" number="01" title="Verantwortung und Kontakt">
            <p>Als verantwortliche Kontaktstelle ist in den bestehenden Betreiberangaben genannt:</p>
            <address className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 not-italic text-[var(--ink)] sm:p-6">
              <p className="font-bold">George Mamaladze</p>
              <p className="mt-1 text-[var(--ink-muted)]">als gesetzlicher Vertreter von Mateo Mamaladze (minderjährig)</p>
              <p className="mt-4 text-[var(--ink-muted)]">
                Welfenstraße 14<br />
                81541 München<br />
                Deutschland
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                <a className="w-fit break-all text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white" href="mailto:mateo.mamaladze@gmail.com">
                  mateo.mamaladze@gmail.com
                </a>
                <a className="w-fit break-all text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white" href="mailto:munichscholarmentors@gmail.com">
                  munichscholarmentors@gmail.com
                </a>
              </div>
            </address>
            <p>
              Welche Person oder Organisation rechtlich als Verantwortlicher auftritt, muss mit dem
              tatsächlichen Betreiber- und Vertragsmodell abgeglichen werden. Diese technische
              Überarbeitung nimmt diese rechtliche Einordnung nicht vor.
            </p>
          </LegalSection>

          <LegalSection id="datenfluesse" number="02" title="Welche Daten die Anwendung verarbeitet">
            <div className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {processingGroups.map((group) => (
                <section key={group.title} className="p-5 sm:p-6" aria-labelledby={`processing-${slug(group.title)}`}>
                  <h3 id={`processing-${slug(group.title)}`} className="font-bold text-[var(--ink)]">
                    {group.title}
                  </h3>
                  <dl className="mt-4 grid gap-4 text-sm leading-6 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <dt className="font-semibold text-[var(--ink-subtle)]">Daten</dt>
                    <dd>{group.data}</dd>
                    <dt className="font-semibold text-[var(--ink-subtle)]">Zweck</dt>
                    <dd>{group.purpose}</dd>
                  </dl>
                </section>
              ))}
            </div>
            <p>
              Beim Abruf einer Website übermittelt der Browser außerdem technisch notwendige
              Verbindungsdaten wie IP-Adresse, Zeitpunkt, angeforderte Ressource und Browserangaben an
              den ausliefernden Server. Ob und wie lange der spätere Hostinganbieter diese Daten
              protokolliert, ist noch zu dokumentieren.
            </p>
          </LegalSection>

          <LegalSection id="dienste" number="03" title="Externe Dienste und konkrete Datenflüsse">
            <Service title="Supabase · Konto und Datenbank">
              Supabase erhält Daten für Registrierung und Anmeldung und speichert Profile, Rollen,
              Buchungen sowie verifizierte Stundenguthaben. Die Sitzung wird über sichere
              Authentifizierungs-Cookies mit dem Browser verbunden. Administrative Zugangsschlüssel
              sind im Anwendungskonzept ausschließlich serverseitig vorgesehen.
            </Service>
            <Service title="Cal.com · Verfügbarkeit und Termin">
              Für eine Verfügbarkeitsabfrage werden Tutor-Zuordnung, Zeitraum und Zeitzone übermittelt.
              Bei einer Buchung gehen Startzeit, Name, E-Mail-Adresse, optionale Telefonnummer,
              Zeitzone sowie technische Angaben zu Tutor, Fach, Paket und Unterrichtsformat an
              Cal.com. Bei Umbuchung oder Stornierung kann zusätzlich ein angegebener Grund
              übermittelt werden.
            </Service>
            <Service title="Sendbird · Chat">
              Für autorisierte Chats werden aus der Konto-ID abgeleitete Nutzerkennungen,
              Anzeigenamen, Kanalmitgliedschaften, Tutor-Zuordnung und Nachrichteninhalte an Sendbird
              übermittelt. Der Zugriff erfolgt über zeitlich begrenzte, serverseitig ausgestellte
              Sitzungstoken.
            </Service>
            <Service title="Zahlung · derzeit kein Online-Anbieter">
              Im aktuellen Code ist kein Zahlungsdienst eingebunden. Die Website erhebt keine Karten-
              oder Bankdaten. Sie kann lediglich einen außerhalb der Anwendung geprüften
              Zahlungsstatus, eine Referenz, einen Betrag und daraus resultierendes Stundenguthaben in
              Supabase speichern.
            </Service>
            <p>
              Anschriften, Datenschutzkontakte, Datenregionen und mögliche Unterauftragnehmer dieser
              Dienste hängen von den produktiv verwendeten Konten und Verträgen ab. Sie sind vor dem
              Start anhand der Anbieterunterlagen zu ergänzen.
            </p>
          </LegalSection>

          <LegalSection id="cookies" number="04" title="Cookies, lokaler Speicher und Tracking">
            <p>
              Die aktuelle Kernanwendung nutzt Cookies für die Anmeldung und Erneuerung einer
              Supabase-Sitzung. Die Authentifizierungsdaten werden dabei nicht als führender
              Buchungszustand im lokalen Browser-Speicher abgelegt.
            </p>
            <p>
              Buchungen und Stundenguthaben werden serverseitig gespeichert; der Browser-Speicher ist
              nicht das führende Buchungssystem. Im geprüften Anwendungscode sind keine Analyse- oder
              Werbetracker eingebunden. Diese Aussage muss erneut geprüft werden, falls beim Hosting
              weitere Analyse-, Consent- oder Monitoringdienste aktiviert werden.
            </p>
          </LegalSection>

          <LegalSection id="rechte" number="05" title="Ihre Datenschutzrechte">
            <p>
              Nach Maßgabe der jeweiligen gesetzlichen Voraussetzungen können betroffene Personen
              insbesondere Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Widerspruch sowie Datenübertragbarkeit verlangen. Beruht eine Verarbeitung auf einer
              Einwilligung, kann diese für die Zukunft widerrufen werden.
            </p>
            <p>
              Anfragen können an die oben genannten E-Mail-Adressen gerichtet werden. Zur Vermeidung
              einer unbefugten Herausgabe kann vor der Bearbeitung eine angemessene Bestätigung der
              Identität erforderlich sein.
            </p>
            <p>
              Zudem besteht das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für
              nichtöffentliche Stellen in Bayern ist regelmäßig das{' '}
              <a
                className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white"
                href="https://www.lda.bayern.de/de/beschwerde.html"
                rel="noreferrer"
                target="_blank"
              >
                Bayerische Landesamt für Datenschutzaufsicht
                <span className="sr-only"> (öffnet in einem neuen Tab)</span>
              </a>{' '}
              zuständig.
            </p>
          </LegalSection>

          <LegalSection id="offen" number="06" title="Vor dem Produktivstart zu vervollständigen">
            <p>
              Art. 13 DSGVO verlangt unter anderem klare Informationen zu Zwecken,
              Rechtsgrundlagen, Empfängern, Drittlandübermittlungen und Speicherdauer. Folgende Punkte
              sind im Projekt noch nicht belastbar belegt:
            </p>
            <ul className="mt-5 space-y-3">
              {unresolvedItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--purple-bright)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6">
              Die offiziellen Betroffenenrechte und Informationspflichten sind in der{' '}
              <a
                className="text-[var(--purple-soft)] underline decoration-[var(--purple-bright)]/50 underline-offset-4 hover:text-white"
                href="https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32016R0679"
                rel="noreferrer"
                target="_blank"
              >
                Datenschutz-Grundverordnung
                <span className="sr-only"> (öffnet in einem neuen Tab)</span>
              </a>{' '}
              geregelt.
            </p>
          </LegalSection>

          <footer className="mt-14 border-t border-[var(--line)] pt-6 text-sm text-[var(--ink-subtle)]">
            Technischer Arbeitsstand: 21. Juli 2026 · Rechtliche Prüfung ausstehend
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

function Service({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <h3 className="font-bold text-[var(--ink)]">{title}</h3>
      <p className="mt-3 text-sm leading-7">{children}</p>
    </section>
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
