export default function AGBPage() {
  return (
    <div className="min-h-screen bg-primary-dark">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-12">
          Allgemeine Geschäftsbedingungen (AGB)
        </h1>

        <div className="space-y-8 text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">1. Geltungsbereich</h2>
              <p className="text-base">Diese AGB gelten für die Nutzung der von Mateo Mamaladze (minderjährig) betriebenen Vermittlungsplattform, gesetzlich vertreten durch George Mamaladze.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">2. Rolle des Plattformbetreibers</h2>
              <p className="text-base mb-2">Der Plattformbetreiber stellt ausschließlich eine technische Infrastruktur zur Verfügung, um:</p>
              <ul className="list-disc pl-6 space-y-2 text-base mb-3">
                <li>Kontakte zwischen Tutoren und Nachhilfesuchenden zu vermitteln</li>
                <li>Termine zu organisieren</li>
                <li>eine direkte Kommunikation zu ermöglichen</li>
              </ul>
              <p className="text-base font-semibold text-white">Der Plattformbetreiber erbringt selbst keine Nachhilfeleistungen.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">3. Vertragsschluss</h2>
              <p className="text-base mb-2">Ein Vertrag über Nachhilfeleistungen kommt ausschließlich zwischen dem jeweiligen Tutor und dem Kunden zustande.</p>
              <p className="text-base font-semibold text-white">Der Plattformbetreiber ist nicht Vertragspartner, nicht Erfüllungsgehilfe und nicht Vertreter einer der Parteien.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">4. Terminorganisation und Kommunikation</h2>
              <p className="text-base mb-2">Die Bereitstellung von Termin- und Kommunikationsfunktionen stellt keine eigene Leistungserbringung dar.</p>
              <p className="text-base">Die Nutzung dieser Funktionen begründet kein Vertragsverhältnis über Nachhilfeleistungen mit dem Plattformbetreiber.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">5. Vergütung</h2>
              <p className="text-base mb-2">Die Nutzung der Plattform ist kostenfrei.</p>
              <p className="text-base mb-2">Vergütungen für Nachhilfeleistungen werden ausschließlich zwischen Tutor und Kunde vereinbart.</p>
              <p className="text-base font-semibold text-white">Der Plattformbetreiber erhält keine Provision.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">6. Haftungsausschluss</h2>
              <p className="text-base mb-2">Der Plattformbetreiber übernimmt keine Haftung für:</p>
              <ul className="list-disc pl-6 space-y-2 text-base mb-3">
                <li>Inhalte oder Qualität der Nachhilfe</li>
                <li>Lernerfolg oder Notenentwicklung</li>
                <li>Terminabsagen oder Ausfälle</li>
                <li>Inhalte der Kommunikation zwischen Tutor und Kunde</li>
              </ul>
              <p className="text-base font-semibold text-white">Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">7. Eigenverantwortung der Tutoren</h2>
              <p className="text-base mb-2">Tutoren handeln eigenverantwortlich und sind keine Mitarbeiter oder Erfüllungsgehilfen des Plattformbetreibers.</p>
              <p className="text-base">Sie sind für die Richtigkeit ihrer Angaben selbst verantwortlich.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">8. Datenschutz</h2>
              <p className="text-base">Es gilt die <a href="/datenschutz" className="text-blue-600 underline">Datenschutzerklärung</a> der Website.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-8">9. Schlussbestimmungen</h2>
              <p className="text-base mb-2">Es gilt das Recht der Bundesrepublik Deutschland.</p>
              <p className="text-base">Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.</p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-300">
              <p className="text-base text-gray-600">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
