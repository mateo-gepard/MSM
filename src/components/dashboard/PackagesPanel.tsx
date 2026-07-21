import Link from 'next/link';
import { BadgeCheck, PackageCheck } from 'lucide-react';
import type { EntitlementDto } from './contracts';

const entitlementStatus: Record<EntitlementDto['status'], string> = {
  active: 'Aktiv',
  completed: 'Aufgebraucht',
  expired: 'Abgelaufen',
  cancelled: 'Beendet',
};

export function PackagesPanel({ entitlements }: { entitlements: EntitlementDto[] }) {
  const sortedEntitlements = [...entitlements].sort((left, right) => {
    if (left.status === 'active' && right.status !== 'active') return -1;
    if (right.status === 'active' && left.status !== 'active') return 1;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  return (
    <section aria-labelledby="packages-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b83ff]">Guthaben</p>
          <h2 id="packages-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
            Verifizierte Pakete
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b5b1bf]">
            Hier stehen ausschließlich bezahlte und serverseitig bestätigte Unterrichtsguthaben. Dies ist
            keine öffentliche Preisübersicht.
          </p>
        </div>
        <Link
          href="/booking"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--action)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--action-hover)]"
        >
          Stunde buchen
        </Link>
      </div>

      {sortedEntitlements.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {sortedEntitlements.map((entitlement) => {
            const usableTotal = Math.max(entitlement.totalSessions, 1);
            const remainingPercentage = Math.min(
              100,
              Math.max(0, (entitlement.remainingSessions / usableTotal) * 100),
            );

            return (
              <article key={entitlement.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                      <BadgeCheck aria-hidden="true" className="h-4 w-4" />
                      Zahlung verifiziert
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-white">{entitlement.package.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-[#b5b1bf]">
                    {entitlementStatus[entitlement.status]}
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <p className="text-sm text-[#b5b1bf]">Verbleibende Stunden</p>
                  <p className="text-3xl font-bold tabular-nums text-white">
                    {entitlement.remainingSessions}
                    <span className="text-base font-semibold text-[var(--ink-subtle)]"> / {entitlement.totalSessions}</span>
                  </p>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"
                  role="progressbar"
                  aria-label={`Verbleibendes Guthaben für ${entitlement.package.name}`}
                  aria-valuemin={0}
                  aria-valuemax={entitlement.totalSessions}
                  aria-valuenow={entitlement.remainingSessions}
                >
                  <div className="h-full rounded-full bg-[var(--action)]" style={{ width: `${remainingPercentage}%` }} />
                </div>
                <p className="mt-3 text-xs text-[var(--ink-subtle)]">
                  {entitlement.usedSessions} von {entitlement.totalSessions} Stunden verwendet
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
          <PackageCheck aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--purple-bright)]" />
          <h3 className="mt-4 font-bold text-white">Noch kein verifiziertes Guthaben</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#b5b1bf]">
            Sobald ein Paket bestätigt wurde, erscheinen hier die tatsächlich verfügbaren Stunden.
          </p>
          <Link
            href="/#preise"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/5"
          >
            Preise ansehen
          </Link>
        </div>
      )}

      <aside className="mt-6 rounded-xl border border-amber-200/15 bg-amber-200/[0.035] p-4 text-sm leading-6 text-[#c8c3cf]">
        Bei einer serverseitig bestätigten Stornierung wird die für diesen Termin verbrauchte Einheit
        einmalig wiederhergestellt. Welche Bedingungen gelten, steht in den{' '}
        <Link href="/agb" className="font-semibold text-white underline underline-offset-4">
          AGB
        </Link>
        .
      </aside>
    </section>
  );
}
