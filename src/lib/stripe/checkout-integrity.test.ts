import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  isDefinitiveOfferAttachmentRace,
  isReusableOpenCheckoutSession,
  type CheckoutOrderSnapshot,
} from './checkout-integrity';

const order: CheckoutOrderSnapshot = {
  orderId: '11111111-1111-4111-8111-111111111111',
  stripePriceId: 'price_fixed',
  amountCents: 12500,
  currency: 'EUR',
  livemode: false,
};

function session(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    status: 'open',
    payment_status: 'unpaid',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    mode: 'payment',
    livemode: false,
    client_reference_id: order.orderId,
    metadata: { orderId: order.orderId },
    currency: 'eur',
    amount_subtotal: order.amountCents,
    amount_total: order.amountCents,
    line_items: {
      object: 'list',
      data: [
        {
          id: 'li_123',
          object: 'item',
          amount_discount: 0,
          amount_subtotal: order.amountCents,
          amount_tax: 0,
          amount_total: order.amountCents,
          currency: 'eur',
          description: 'Paket',
          discounts: [],
          price: {
            id: order.stripePriceId,
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: 1,
            currency: 'eur',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: 'prod_123',
            recurring: null,
            tax_behavior: 'inclusive',
            tiers_mode: null,
            transform_quantity: null,
            type: 'one_time',
            unit_amount: order.amountCents,
            unit_amount_decimal: String(order.amountCents),
          },
          quantity: 1,
        },
      ],
      has_more: false,
      url: '/v1/checkout/sessions/cs_test_123/line_items',
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe('Checkout Session integrity', () => {
  it('accepts an exact open fixed EUR Session', () => {
    expect(isReusableOpenCheckoutSession(session(), order)).toBe(true);
  });

  it.each([
    ['wrong order metadata', { metadata: { orderId: '22222222-2222-4222-8222-222222222222' } }],
    ['wrong currency', { currency: 'usd' }],
    ['wrong amount', { amount_total: order.amountCents + 1 }],
    ['already completed', { status: 'complete' }],
  ])('rejects %s', (_name, overrides) => {
    expect(isReusableOpenCheckoutSession(session(overrides), order)).toBe(false);
  });

  it('distinguishes a definitive offer race from transient database failures', () => {
    expect(isDefinitiveOfferAttachmentRace({ message: 'OFFER_NOT_AVAILABLE' })).toBe(true);
    expect(isDefinitiveOfferAttachmentRace({ message: 'connection reset' })).toBe(false);
  });
});
