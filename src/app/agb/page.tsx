import { FrostedCard } from '@/components/ui/FrostedCard';

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-secondary-dark to-primary-dark">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-8 sm:mb-12">
            Allgemeine Geschäftsbedingungen (AGB)
          </h1>

          <FrostedCard className="p-6 sm:p-8 space-y-6 text-gray-300">
            <div className="prose prose-invert max-w-none">
              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">1. Geltungsbereich</h2>
                <p>Diese AGB gelten für die Nutzung der von Mateo Mamaladze (minderjährig) betriebenen Vermittlungsplattform, gesetzlich vertreten durch [Name des gesetzlichen Vertreters].</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">2. Rolle des Plattformbetreibers</h2>
                <p className="mb-4">Der Plattformbetreiber stellt ausschließlich eine technische Infrastruktur zur Verfügung, um:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Kontakte zwischen Tutoren und Nachhilfesuchenden zu vermitteln</li>
                  <li>Termine zu organisieren</li>
                  <li>eine direkte Kommunikation zu ermöglichen</li>
                </ul>
                <p className="font-semibold text-white">Der Plattformbetreiber erbringt selbst keine Nachhilfeleistungen.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">3. Vertragsschluss</h2>
                <p className="mb-4">Ein Vertrag über Nachhilfeleistungen kommt ausschließlich zwischen dem jeweiligen Tutor und dem Kunden zustande.</p>
                <p className="font-semibold text-white">Der Plattformbetreiber ist nicht Vertragspartner, nicht Erfüllungsgehilfe und nicht Vertreter einer der Parteien.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">4. Terminorganisation und Kommunikation</h2>
                <p className="mb-4">Die Bereitstellung von Termin- und Kommunikationsfunktionen stellt keine eigene Leistungserbringung dar.</p>
                <p>Die Nutzung dieser Funktionen begründet kein Vertragsverhältnis über Nachhilfeleistungen mit dem Plattformbetreiber.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">5. Vergütung</h2>
                <p className="mb-4">Die Nutzung der Plattform ist kostenfrei.</p>
                <p className="mb-4">Vergütungen für Nachhilfeleistungen werden ausschließlich zwischen Tutor und Kunde vereinbart.</p>
                <p className="font-semibold text-white">Der Plattformbetreiber erhält keine Provision.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">6. Haftungsausschluss</h2>
                <p className="mb-4">Der Plattformbetreiber übernimmt keine Haftung für:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Inhalte oder Qualität der Nachhilfe</li>
                  <li>Lernerfolg oder Notenentwicklung</li>
                  <li>Terminabsagen oder Ausfälle</li>
                  <li>Inhalte der Kommunikation zwischen Tutor und Kunde</li>
                </ul>
                <p className="font-semibold text-white">Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">7. Eigenverantwortung der Tutoren</h2>
                <p className="mb-4">Tutoren handeln eigenverantwortlich und sind keine Mitarbeiter oder Erfüllungsgehilfen des Plattformbetreibers.</p>
                <p>Sie sind für die Richtigkeit ihrer Angaben selbst verantwortlich.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">8. Datenschutz</h2>
                <p>Es gilt die <a href="/datenschutz" className="text-accent hover:underline">Datenschutzerklärung</a> der Website.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">9. Schlussbestimmungen</h2>
                <p className="mb-4">Es gilt das Recht der Bundesrepublik Deutschland.</p>
                <p>Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.</p>
              </section>

              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-gray-400">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              </div>
            </div>
          </FrostedCard>
        </div>
      </div>
    </div>
  );
}
