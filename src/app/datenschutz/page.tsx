import { FrostedCard } from '@/components/ui/FrostedCard';

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-secondary-dark to-primary-dark">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-8 sm:mb-12">
            Datenschutzerklärung
          </h1>

          <FrostedCard className="p-6 sm:p-8 space-y-6 text-gray-300">
            <div className="prose prose-invert max-w-none">
              <p className="text-base sm:text-lg leading-relaxed mb-6">
                Der Schutz Ihrer personenbezogenen Daten ist uns ein wichtiges Anliegen.
                Diese Datenschutzerklärung informiert Sie darüber, welche personenbezogenen Daten bei der Nutzung dieser Website verarbeitet werden und zu welchem Zweck. Die Verarbeitung erfolgt im Einklang mit der Datenschutz-Grundverordnung (DSGVO) sowie den einschlägigen deutschen Datenschutzgesetzen.
              </p>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">1. Verantwortlicher</h2>
                <p className="mb-2">Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:</p>
                <div className="bg-secondary-dark/50 p-4 rounded-lg mb-4">
                  <p className="mb-1">[Name des gesetzlichen Vertreters]</p>
                  <p className="mb-1">als gesetzlicher Vertreter von</p>
                  <p className="mb-1">Mateo Mamaladze (minderjährig)</p>
                  <p className="mb-1">[Adresse]</p>
                  <p className="mb-1">Deutschland</p>
                  <p className="mt-3">E-Mail: mateo.mamaladze@gmail.com</p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">2. Gegenstand der Website</h2>
                <p className="mb-4">Diese Website betreibt eine technische Vermittlungsplattform zur Organisation und Koordination von Nachhilfe-Kontakten zwischen Tutoren und interessierten Eltern bzw. Schülern.</p>
                <p className="mb-2">
                  <strong>Über die Plattform werden keine Nachhilfeleistungen verkauft oder abgerechnet.</strong>
                </p>
                <p>Der Unterrichtsvertrag kommt ausschließlich zwischen Tutor und Kunde zustande.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">3. Verarbeitete Datenarten</h2>
                <p className="mb-4">Im Rahmen der Nutzung der Plattform können insbesondere folgende personenbezogene Daten verarbeitet werden:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Kontaktdaten (z. B. Name, E-Mail-Adresse)</li>
                  <li>Accountdaten (Login-Daten, Nutzerrolle)</li>
                  <li>Terminbezogene Daten (Buchungszeitpunkte, Verfügbarkeiten)</li>
                  <li>Kommunikationsinhalte (Chat-Nachrichten zwischen Tutor und Kunde)</li>
                  <li>Technische Daten (IP-Adresse, Zeitstempel, Geräte- und Browserinformationen)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">4. Zwecke und Rechtsgrundlagen der Verarbeitung</h2>
                <p className="mb-4">Die Verarbeitung personenbezogener Daten erfolgt zu folgenden Zwecken:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Bereitstellung der Plattformfunktionen</li>
                  <li>Vermittlung von Kontakten zwischen Tutoren und Nachhilfesuchenden</li>
                  <li>Organisation und Koordination von Terminen</li>
                  <li>Ermöglichung der direkten Kommunikation zwischen Tutor und Kunde</li>
                  <li>Sicherstellung des technischen Betriebs und der Systemsicherheit</li>
                </ul>
                <p className="mb-2 font-semibold text-white">Rechtsgrundlagen:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung auf Anfrage der betroffenen Person)</li>
                  <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb einer funktionsfähigen Vermittlungsplattform)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">5. Nutzerkonten und Authentifizierung (Supabase)</h2>
                <p className="mb-4">Zur Nutzung bestimmter Funktionen (z. B. Terminbuchung oder Chat) ist die Erstellung eines Nutzerkontos erforderlich. Die Authentifizierung erfolgt über Supabase (E-Mail/Passwort oder Magic-Link).</p>
                <p>Die dabei verarbeiteten Daten dienen ausschließlich der Identifikation des Nutzers und der Bereitstellung der Plattformfunktionen.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">6. Terminorganisation (Cal.com)</h2>
                <p className="mb-4">Zur Koordination von Terminen nutzen wir den Dienst Cal.com. Hierbei werden Termin- und Zeitdaten verarbeitet, einschließlich Zeitzoneninformationen (z. B. Europe/Berlin ↔ UTC).</p>
                <p>Die Terminorganisation stellt keine eigene Nachhilfeleistung dar, sondern dient ausschließlich der technischen Unterstützung der Vermittlung.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">7. Kommunikation (Sendbird)</h2>
                <p className="mb-4">Zur direkten Kommunikation zwischen Tutoren und Kunden wird ein Echtzeit-Chatdienst (Sendbird) eingesetzt.</p>
                <p className="mb-4">Die Inhalte der Nachrichten werden technisch gespeichert, um die Kommunikation zu ermöglichen. Der Plattformbetreiber nimmt keine inhaltliche Prüfung der Nachrichten vor und ist nicht Partei der Kommunikation.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">8. Hosting (Vercel)</h2>
                <p>Diese Website wird bei Vercel Inc. gehostet. Im Rahmen des Hostings werden technisch notwendige Daten (z. B. IP-Adresse, Server-Logfiles) verarbeitet, um die Website bereitzustellen und zu sichern.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">9. Weitergabe von Daten</h2>
                <p className="mb-4">Eine Weitergabe personenbezogener Daten erfolgt nur:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>an die jeweils beteiligten Tutoren oder Kunden, soweit dies zur Vermittlung erforderlich ist</li>
                  <li>an eingesetzte technische Dienstleister (Supabase, Cal.com, Sendbird, Vercel)</li>
                  <li>wenn eine gesetzliche Verpflichtung besteht</li>
                </ul>
                <p>Eine Weitergabe zu Werbezwecken findet nicht statt.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">10. Speicherdauer</h2>
                <p>Personenbezogene Daten werden nur so lange gespeichert, wie dies für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen. Nicht mehr benötigte Daten werden regelmäßig gelöscht.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">11. Rechte der betroffenen Personen</h2>
                <p className="mb-4">Sie haben das Recht auf:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Auskunft (Art. 15 DSGVO)</li>
                  <li>Berichtigung (Art. 16 DSGVO)</li>
                  <li>Löschung (Art. 17 DSGVO)</li>
                  <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
                  <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
                </ul>
                <p>Zur Ausübung Ihrer Rechte wenden Sie sich bitte an die oben genannte Kontaktadresse.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">12. Datensicherheit</h2>
                <p>Die Website nutzt eine SSL-Verschlüsselung. Es werden angemessene technische und organisatorische Maßnahmen getroffen, um Daten vor unbefugtem Zugriff zu schützen.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">13. Aktualität</h2>
                <p>Diese Datenschutzerklärung wird bei Bedarf angepasst, um rechtlichen oder technischen Änderungen Rechnung zu tragen.</p>
                <p className="mt-4 text-gray-400">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              </section>
            </div>
          </FrostedCard>
        </div>
      </div>
    </div>
  );
}
