import { PACKAGE_CATALOG } from '@/domain/catalog';
import { PricingCard } from '@/components/pricing/PricingCard';

export function PricingSection() {
  return (
    <section id="preise" className="site-section scroll-mt-24 bg-[#0d0d13]" aria-labelledby="preise-title">
      <div className="site-container">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Preise</p>
            <h2 id="preise-title" className="section-heading mt-6 text-white">
              Vor der ersten Stunde wissen, was es kostet.
            </h2>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-pretty text-base leading-7 text-[#aaa6b2]">
              Kostenlos kennenlernen, danach flexibel als Einzelstunde oder im Paket weiterlernen. Jede Einheit dauert 60 Minuten.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#d7ceff]">Einstieg: 0 € · regulär ab 29 € pro Stunde im Paket</p>
          </div>
        </div>

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PACKAGE_CATALOG.map((pkg) => (
            <PricingCard key={pkg.id} package={pkg} />
          ))}
        </div>

        <p className="mt-6 text-xs leading-5 text-[#8f8a97]">
          Die kostenlose Probestunde gilt einmalig für Neukund:innen. Paketpreise werden als Gesamtpreis ausgewiesen.
        </p>
      </div>
    </section>
  );
}
