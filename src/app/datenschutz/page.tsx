import { FrostedCard } from '@/components/ui/FrostedCard';

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-primary-dark">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        <div className="bg-white rounded-sm shadow-sm p-8 sm:p-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
            Datenschutzerklärung
          </h1>

          <div className="space-y-6 text-gray-800 leading-relaxed">
            <p className="text-sm">
              Der Schutz Ihrer personenbezogenen Daten ist uns ein wichtiges Anliegen.
              Diese Datenschutzerklärung informiert Sie darüber, welche personenbezogenen Daten bei der Nutzung dieser Website verarbeitet werden und zu welchem Zweck. Die Verarbeitung erfolgt im Einklang mit der Datenschutz-Grundverordnung (DSGVO) sowie den einschlägigen deutschen Datenschutzgesetzen.
            </p>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">1. Verantwortlicher</h2>
              <p className="text-sm mb-2">Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:</p>
              <div className="bg-gray-50 border border-gray-200 p-4 text-sm my-3">
                <p>George Mamaladze</p>
                <p>als gesetzlicher Vertreter von</p>
                <p>Mateo Mamaladze (minderjährig)</p>
                <p>Welfenstraße 14</p>
                <p>81541 München</p>
                <p>Deutschland</p>
                <p className="mt-2">E-Mail: mateo.mamaladze@gmail.com</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">2. Gegenstand der Website</h2>
              <p className="text-sm mb-2">Diese Website betreibt eine technische Vermittlungsplattform zur Organisation und Koordination von Nachhilfe-Kontakten zwischen Tutoren und interessierten Eltern bzw. Schülern.</p>
              <p className="text-sm font-semibold mb-2">
                Über die Plattform werden keine Nachhilfeleistungen verkauft oder abgerechnet.
              </p>
              <p className="text-sm">Der Unterrichtsvertrag kommt ausschließlich zwischen Tutor und Kunde zustande.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">3. Verarbeitete Datenarten</h2>
              <p className="text-sm mb-2">Im Rahmen der Nutzung der Plattform können insbesondere folgende personenbezogene Daten verarbeitet werden:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Kontaktdaten (z. B. Name, E-Mail-Adresse)</li>
                <li>Accountdaten (Login-Daten, Nutzerrolle)</li>
                <li>Terminbezogene Daten (Buchungszeitpunkte, Verfügbarkeiten)</li>
                <li>Kommunikationsinhalte (Chat-Nachrichten zwischen Tutor und Kunde)</li>
                <li>Technische Daten (IP-Adresse, Zeitstempel, Geräte- und Browserinformationen)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">4. Zwecke und Rechtsgrundlagen der Verarbeitung</h2>
              <p className="text-sm mb-2">Die Verarbeitung personenbezogener Daten erfolgt zu folgenden Zwecken:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm mb-3">
                <li>Bereitstellung der Plattformfunktionen</li>
                <li>Vermittlung von Kontakten zwischen Tutoren und Nachhilfesuchenden</li>
                <li>Organisation und Koordination von Terminen</li>
                <li>Ermöglichung der direkten Kommunikation zwischen Tutor und Kunde</li>
                <li>Sicherstellung des technischen Betriebs und der Systemsicherheit</li>
              </ul>
              <p className="text-sm font-semibold mb-2">Rechtsgrundlagen:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung auf Anfrage der betroffenen Person)</li>
                <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb einer funktionsfähigen Vermittlungsplattform)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">5. Nutzerkonten und Authentifizierung (Supabase)</h2>
              <p className="text-sm mb-2">Zur Nutzung bestimmter Funktionen (z. B. Terminbuchung oder Chat) ist die Erstellung eines Nutzerkontos erforderlich. Die Authentifizierung erfolgt über Supabase (E-Mail/Passwort oder Magic-Link).</p>
              <p className="text-sm">Die dabei verarbeiteten Daten dienen ausschließlich der Identifikation des Nutzers und der Bereitstellung der Plattformfunktionen.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">6. Terminorganisation (Cal.com)</h2>
              <p className="text-sm mb-2">Zur Koordination von Terminen nutzen wir den Dienst Cal.com. Hierbei werden Termin- und Zeitdaten verarbeitet, einschließlich Zeitzoneninformationen (z. B. Europe/Berlin ↔ UTC).</p>
              <p className="text-sm">Die Terminorganisation stellt keine eigene Nachhilfeleistung dar, sondern dient ausschließlich der technischen Unterstützung der Vermittlung.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">7. Kommunikation (Sendbird)</h2>
              <p className="text-sm mb-2">Zur direkten Kommunikation zwischen Tutoren und Kunden wird ein Echtzeit-Chatdienst (Sendbird) eingesetzt.</p>
              <p className="text-sm">Die Inhalte der Nachrichten werden technisch gespeichert, um die Kommunikation zu ermöglichen. Der Plattformbetreiber nimmt keine inhaltliche Prüfung der Nachrichten vor und ist nicht Partei der Kommunikation.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">8. Hosting (Vercel)</h2>
              <p className="text-sm">Diese Website wird bei Vercel Inc. gehostet. Im Rahmen des Hostings werden technisch notwendige Daten (z. B. IP-Adresse, Server-Logfiles) verarbeitet, um die Website bereitzustellen und zu sichern.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">9. Weitergabe von Daten</h2>
              <p className="text-sm mb-2">Eine Weitergabe personenbezogener Daten erfolgt nur:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm mb-2">
                <li>an die jeweils beteiligten Tutoren oder Kunden, soweit dies zur Vermittlung erforderlich ist</li>
                <li>an eingesetzte technische Dienstleister (Supabase, Cal.com, Sendbird, Vercel)</li>
                <li>wenn eine gesetzliche Verpflichtung besteht</li>
              </ul>
              <p className="text-sm">Eine Weitergabe zu Werbezwecken findet nicht statt.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">10. Speicherdauer</h2>
              <p className="text-sm">Personenbezogene Daten werden nur so lange gespeichert, wie dies für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen. Nicht mehr benötigte Daten werden regelmäßig gelöscht.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">11. Rechte der betroffenen Personen</h2>
              <p className="text-sm mb-2">Sie haben das Recht auf:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm mb-2">
                <li>Auskunft (Art. 15 DSGVO)</li>
                <li>Berichtigung (Art. 16 DSGVO)</li>
                <li>Löschung (Art. 17 DSGVO)</li>
                <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
                <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
              </ul>
              <p className="text-sm">Zur Ausübung Ihrer Rechte wenden Sie sich bitte an die oben genannte Kontaktadresse.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">12. Datensicherheit</h2>
              <p className="text-sm">Die Website nutzt eine SSL-Verschlüsselung. Es werden angemessene technische und organisatorische Maßnahmen getroffen, um Daten vor unbefugtem Zugriff zu schützen.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">13. Aktualität</h2>
              <p className="text-sm mb-2">Diese Datenschutzerklärung wird bei Bedarf angepasst, um rechtlichen oder technischen Änderungen Rechnung zu tragen.</p>
              <p className="text-sm text-gray-600 mt-4">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
