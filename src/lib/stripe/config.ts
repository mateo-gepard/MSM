import { assertServerOnly } from '@/lib/security/server-only';
import { ServiceConfigurationError } from '@/lib/supabase/config';

assertServerOnly('Stripe configuration');

export function requireStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
    throw new ServiceConfigurationError('Stripe');
  }
  return secretKey;
}

export function requireStripeWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !webhookSecret.startsWith('whsec_')) {
    throw new ServiceConfigurationError('Stripe webhook');
  }
  return webhookSecret;
}

export function requirePaymentsEnabled(): void {
  if (
    process.env.PAYMENTS_ENABLED?.trim().toLowerCase() !== 'true' ||
    process.env.PAYMENTS_LEGAL_APPROVED?.trim().toLowerCase() !== 'true'
  ) {
    throw new ServiceConfigurationError('Payments');
  }
}

export function requireCanonicalSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) throw new ServiceConfigurationError('Canonical site URL');

  try {
    const url = new URL(raw);
    const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) || url.username || url.password) {
      throw new Error('invalid origin');
    }
    return url.origin;
  } catch {
    throw new ServiceConfigurationError('Canonical site URL');
  }
}
