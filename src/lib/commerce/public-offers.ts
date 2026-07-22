import type { Package } from '@/domain/catalog';
import { PACKAGE_CATALOG } from '@/domain/catalog';
import { assertServerOnly } from '@/lib/security/server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

assertServerOnly('Public commercial offer catalog');

export interface PublicPricingOffer extends Package {
  checkoutEnabled: boolean;
}

function fallbackOffers(): PublicPricingOffer[] {
  return PACKAGE_CATALOG.map((item) => ({ ...item, checkoutEnabled: false }));
}

function paymentRuntimeMatches(livemode: boolean | null): boolean {
  const paymentsEnabled =
    process.env.PAYMENTS_ENABLED?.trim().toLowerCase() === 'true' &&
    process.env.PAYMENTS_LEGAL_APPROVED?.trim().toLowerCase() === 'true';
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '';
  let hasValidSiteOrigin = false;
  try {
    const url = new URL(siteUrl);
    const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    hasValidSiteOrigin =
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && isLocal));
  } catch {
    hasValidSiteOrigin = false;
  }
  const modeMatches = livemode === true
    ? secretKey.startsWith('sk_live_')
    : livemode === false && secretKey.startsWith('sk_test_');
  return paymentsEnabled && modeMatches && webhookSecret.startsWith('whsec_') && hasValidSiteOrigin;
}

/**
 * Reads display prices and session quantities from the same immutable offer
 * versions used by Checkout. Static copy/features are only a fail-closed
 * presentation fallback and can never enable a purchase.
 */
export async function getPublicPricingOffers(): Promise<PublicPricingOffer[]> {
  try {
    const service = createSupabaseServiceClient();
    const { data: activeRows, error: activeError } = await service
      .from('active_offers')
      .select('package_id,offer_version_id,checkout_enabled');
    if (activeError || !activeRows?.length) return fallbackOffers();

    const { data: versions, error: versionsError } = await service
      .from('offer_versions')
      .select(
        'id,package_id,provider,name,sessions,amount_cents,currency,stripe_livemode,tax_behavior,effective_from,effective_until',
      )
      .in('id', activeRows.map((row) => row.offer_version_id));
    if (versionsError || !versions) return fallbackOffers();

    const activeByPackage = new Map(activeRows.map((row) => [row.package_id, row]));
    const versionById = new Map(versions.map((row) => [row.id, row]));
    const now = Date.now();
    const resolved = PACKAGE_CATALOG.map<PublicPricingOffer>((item) => {
      const active = activeByPackage.get(item.dbId);
      const version = active ? versionById.get(active.offer_version_id) : undefined;
      const isCurrent = Boolean(
        version &&
        version.package_id === item.dbId &&
        version.currency === 'EUR' &&
        Date.parse(version.effective_from) <= now &&
        (!version.effective_until || Date.parse(version.effective_until) > now),
      );
      if (!version || !isCurrent) return { ...item, checkoutEnabled: false };

      return {
        ...item,
        name: version.name,
        sessions: version.sessions,
        priceCents: version.amount_cents,
        hourlyRateCents: Math.round(version.amount_cents / version.sessions),
        checkoutEnabled: Boolean(
          item.id !== 'trial' &&
          active?.checkout_enabled &&
          version.provider === 'stripe' &&
          version.tax_behavior === 'inclusive' &&
          paymentRuntimeMatches(version.stripe_livemode),
        ),
      };
    });

    const singlePrice = resolved.find((item) => item.id === 'single')?.priceCents;
    return resolved.map((item) => ({
      ...item,
      savingsCents:
        singlePrice && item.sessions > 1
          ? Math.max(0, singlePrice * item.sessions - item.priceCents)
          : undefined,
    }));
  } catch {
    return fallbackOffers();
  }
}
