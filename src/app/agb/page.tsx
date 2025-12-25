import { FrostedCard } from '@/components/ui/FrostedCard';

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-primary-dark">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        <div className="bg-white rounded-sm shadow-sm p-8 sm:p-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
            Allgemeine Geschäftsbedingungen (AGB)
          </h1>

          <div className="space-y-6 text-gray-800 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">1. Geltungsbereich</h2>
              <p className="text-sm">Diese AGB gelten für die Nutzung der von Mateo Mamaladze (minderjährig) betriebenen Vermittlungsplattform, gesetzlich vertreten durch George Mamaladze.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">2. Rolle des Plattformbetreibers</h2>
              <p className="text-sm mb-2">Der Plattformbetreiber stellt ausschließlich eine technische Infrastruktur zur Verfügung, um:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm mb-3">
                <li>Kontakte zwischen Tutoren und Nachhilfesuchenden zu vermitteln</li>
                <li>Termine zu organisieren</li>
                <li>eine direkte Kommunikation zu ermöglichen</li>
              </ul>
              <p className="text-sm font-semibold">Der Plattformbetreiber erbringt selbst keine Nachhilfeleistungen.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">3. Vertragsschluss</h2>
              <p className="text-sm mb-2">Ein Vertrag über Nachhilfeleistungen kommt ausschließlich zwischen dem jeweiligen Tutor und dem Kunden zustande.</p>
              <p className="text-sm font-semibold">Der Plattformbetreiber ist nicht Vertragspartner, nicht Erfüllungsgehilfe und nicht Vertreter einer der Parteien.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">4. Terminorganisation und Kommunikation</h2>
              <p className="text-sm mb-2">Die Bereitstellung von Termin- und Kommunikationsfunktionen stellt keine eigene Leistungserbringung dar.</p>
              <p className="text-sm">Die Nutzung dieser Funktionen begründet kein Vertragsverhältnis über Nachhilfeleistungen mit dem Plattformbetreiber.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">5. Vergütung</h2>
              <p className="text-sm mb-2">Die Nutzung der Plattform ist kostenfrei.</p>
              <p className="text-sm mb-2">Vergütungen für Nachhilfeleistungen werden ausschließlich zwischen Tutor und Kunde vereinbart.</p>
              <p className="text-sm font-semibold">Der Plattformbetreiber erhält keine Provision.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">6. Haftungsausschluss</h2>
              <p className="text-sm mb-2">Der Plattformbetreiber übernimmt keine Haftung für:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm mb-3">
                <li>Inhalte oder Qualität der Nachhilfe</li>
                <li>Lernerfolg oder Notenentwicklung</li>
                <li>Terminabsagen oder Ausfälle</li>
                <li>Inhalte der Kommunikation zwischen Tutor und Kunde</li>
              </ul>
              <p className="text-sm font-semibold">Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">7. Eigenverantwortung der Tutoren</h2>
              <p className="text-sm mb-2">Tutoren handeln eigenverantwortlich und sind keine Mitarbeiter oder Erfüllungsgehilfen des Plattformbetreibers.</p>
              <p className="text-sm">Sie sind für die Richtigkeit ihrer Angaben selbst verantwortlich.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">8. Datenschutz</h2>
              <p className="text-sm">Es gilt die <a href="/datenschutz" className="text-blue-600 underline">Datenschutzerklärung</a> der Website.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">9. Schlussbestimmungen</h2>
              <p className="text-sm mb-2">Es gilt das Recht der Bundesrepublik Deutschland.</p>
              <p className="text-sm">Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.</p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-300">
              <p className="text-sm text-gray-600">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
