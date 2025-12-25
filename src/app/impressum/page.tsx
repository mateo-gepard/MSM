export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-primary-dark">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-12">
          Impressum
        </h1>

        <div className="space-y-8 text-gray-300 leading-relaxed">
            <p className="text-base text-gray-400 mb-6">
              Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)
            </p>

            <section>
              <h2 className="text-xl font-bold text-white mb-4">Anbieter der Plattform</h2>
              <p className="text-base mb-1">Mateo Mamaladze (minderjährig)</p>
              <p className="text-base text-gray-400 italic">– technische Vermittlungsplattform für Nachhilfe –</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-6">Gesetzlich vertreten durch</h2>
              <div className="bg-secondary-dark/50 border border-gray-700 p-4 text-base">
                <p>George Mamaladze</p>
                <p>Welfenstraße 14</p>
                <p>81541 München</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-6">Kontakt</h2>
              <p className="text-base">
                E-Mail: <a href="mailto:mateo.mamaladze@gmail.com" className="text-accent hover:text-accent/80 underline">mateo.mamaladze@gmail.com</a>
              </p>
              <p className="text-base mt-2">
                Telefon: <a href="tel:+4917652547548" className="text-accent hover:text-accent/80 underline">+49 176 52547548</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-6">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
              <div className="text-base">
                <p>George Mamaladze</p>
                <p>Welfenstraße 14</p>
                <p>81541 München</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-6">Art des Angebots / Haftungshinweis</h2>
              <p className="text-base mb-3">
                Diese Website betreibt eine technische Vermittlungsplattform zur Organisation von Kontakten, Terminen und Kommunikation zwischen selbstständig handelnden Nachhilfe-Tutoren und interessierten Eltern bzw. Schülern.
              </p>
              <p className="text-base font-semibold mb-2">
                Der Plattformbetreiber erbringt selbst keine Nachhilfeleistungen.
              </p>
              <p className="text-base">
                Ein Vertrag über Nachhilfeunterricht kommt ausschließlich zwischen Tutor und Kunde zustande.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4 mt-6">Verbraucherstreitbeilegung</h2>
              <p className="text-base">
                Der Plattformbetreiber ist nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-300">
              <p className="text-base text-gray-600">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
