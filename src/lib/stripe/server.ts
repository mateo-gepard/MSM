import Stripe from 'stripe';
import { assertServerOnly } from '@/lib/security/server-only';
import { requireStripeSecretKey } from './config';

assertServerOnly('Stripe server client');

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireStripeSecretKey(), {
      appInfo: { name: 'Munich Scholar Mentors' },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }

  return stripeClient;
}
