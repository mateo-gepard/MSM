import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { Package } from '@/domain/catalog';

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface PricingCardProps {
  package: Package;
}

export function PricingCard({ package: pkg }: PricingCardProps) {
  const isTrial = pkg.priceCents === 0;
  const rateCents = pkg.hourlyRateCents ?? pkg.priceCents;
  const visibleFeatures = pkg.features.filter((feature) => !feature.includes('Ersparnis')).slice(0, 4);
  const actionHref = isTrial
    ? `/booking?package=${pkg.id}`
    : `mailto:munichscholarmentors@gmail.com?subject=${encodeURIComponent(`${pkg.name} anfragen`)}`;

  return (
    <article
      className={`flex h-full min-w-0 flex-col border p-6 sm:p-7 ${
        pkg.popular
          ? 'border-[var(--purple)] bg-[var(--surface-accent)]'
          : 'border-[var(--line)] bg-[var(--surface)]'
      }`}
      aria-labelledby={`package-${pkg.id}`}
    >
      <div className="min-h-6">
        {pkg.popular ? (
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#b9aaff]">
            Niedrigster Paketpreis pro Stunde
          </span>
        ) : null}
      </div>

      <h3 id={`package-${pkg.id}`} className="mt-4 text-lg font-bold text-[var(--ink)]">
        {pkg.name}
      </h3>

      <div className="mt-5 border-b border-[var(--line)] pb-6">
        <div className="flex items-end gap-2">
          <span className="font-display text-5xl font-medium leading-none tracking-[-0.04em] text-[var(--ink)]">
            {euro.format(rateCents / 100)}
          </span>
          <span className="pb-1 text-xs text-[var(--ink-subtle)]">{isTrial ? 'einmalig' : '/ 60 Min.'}</span>
        </div>
        <p className="mt-3 min-h-5 text-xs text-[var(--ink-subtle)]">
          {pkg.sessions > 1 ? `${euro.format(pkg.priceCents / 100)} Gesamtpreis` : 'Eine Einheit à 60 Minuten'}
        </p>
        {pkg.savingsCents ? (
          <p className="mt-1 text-xs font-bold text-[#8fc7a6]">{euro.format(pkg.savingsCents / 100)} Ersparnis</p>
        ) : null}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {visibleFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-[var(--ink-muted)]">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#9b83ff]" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={actionHref}
        className={`mt-7 inline-flex min-h-11 items-center justify-between gap-3 rounded-lg px-4 text-sm font-bold transition-colors ${
          pkg.popular
            ? 'bg-[#6e56cf] text-white hover:bg-[#745bd1]'
            : 'border border-[var(--line-strong)] text-[var(--ink)] hover:bg-white/5'
        }`}
      >
        {isTrial ? 'Probestunde wählen' : 'Paket anfragen'}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </article>
  );
}
