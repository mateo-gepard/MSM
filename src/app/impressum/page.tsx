export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-primary-dark">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        <div className="bg-white rounded-sm shadow-sm p-8 sm:p-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
            Impressum
          </h1>

          <div className="space-y-6 text-gray-800 leading-relaxed">
            <p className="text-sm text-gray-600 mb-6">
              Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)
            </p>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Anbieter der Plattform</h2>
              <p className="text-sm mb-1">Mateo Mamaladze (minderjährig)</p>
              <p className="text-sm text-gray-600 italic">– technische Vermittlungsplattform für Nachhilfe –</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">Gesetzlich vertreten durch</h2>
              <div className="bg-gray-50 border border-gray-200 p-4 text-sm">
                <p>George Mamaladze</p>
                <p>Welfenstraße 14</p>
                <p>81541 München</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">Kontakt</h2>
              <p className="text-sm">
                E-Mail: <a href="mailto:mateo.mamaladze@gmail.com" className="text-blue-600 underline">mateo.mamaladze@gmail.com</a>
              </p>
              <p className="text-sm mt-2">
                Telefon: <a href="tel:+4917652547548" className="text-blue-600 underline">+49 176 52547548</a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
              <div className="text-sm">
                <p>George Mamaladze</p>
                <p>Welfenstraße 14</p>
                <p>81541 München</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">Art des Angebots / Haftungshinweis</h2>
              <p className="text-sm mb-3">
                Diese Website betreibt eine technische Vermittlungsplattform zur Organisation von Kontakten, Terminen und Kommunikation zwischen selbstständig handelnden Nachhilfe-Tutoren und interessierten Eltern bzw. Schülern.
              </p>
              <p className="text-sm font-semibold mb-2">
                Der Plattformbetreiber erbringt selbst keine Nachhilfeleistungen.
              </p>
              <p className="text-sm">
                Ein Vertrag über Nachhilfeunterricht kommt ausschließlich zwischen Tutor und Kunde zustande.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6">Verbraucherstreitbeilegung</h2>
              <p className="text-sm">
                Der Plattformbetreiber ist nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
              </p>
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
