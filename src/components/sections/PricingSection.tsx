import { PricingCard } from '@/components/pricing/PricingCard';
import { getPublicPricingOffers } from '@/lib/commerce/public-offers';

export async function PricingSection() {
  const offers = await getPublicPricingOffers();
  const paidHourlyRates = offers
    .filter((offer) => offer.id !== 'trial')
    .map((offer) => offer.hourlyRateCents ?? offer.priceCents)
    .filter((price) => price > 0);
  const lowestHourlyRate = paidHourlyRates.length
    ? Math.min(...paidHourlyRates)
    : null;
  const formattedLowestRate = lowestHourlyRate === null
    ? null
    : new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(lowestHourlyRate / 100);

  return (
    <section id="preise" className="site-section scroll-mt-24 bg-[var(--canvas-soft)]" aria-labelledby="preise-title">
      <div className="site-container">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Preise</p>
            <h2 id="preise-title" className="section-heading mt-6 text-[var(--ink)]">
              Faire &amp; transparente Preise
            </h2>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-pretty text-base leading-7 text-[var(--ink-muted)]">
              Quality over Quantity. Limitierte Stunden pro Woche sorgen für maximale Aufmerksamkeit und nachhaltigen Lernerfolg.
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--purple-soft)]">
              Kostenlose Probestunde.
              {formattedLowestRate ? ` Danach ab ${formattedLowestRate} pro Stunde im Paket.` : ''}
            </p>
          </div>
        </div>

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {offers.map((offer) => (
            <PricingCard key={offer.id} offer={offer} />
          ))}
        </div>

        <p className="mt-6 text-xs leading-5 text-[var(--ink-subtle)]">
          Die kostenlose Probestunde gilt einmalig für Neukund:innen. Paketpreise werden als Gesamtpreis ausgewiesen.
        </p>
      </div>
    </section>
  );
}
