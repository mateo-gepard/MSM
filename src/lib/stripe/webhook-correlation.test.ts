import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  correlateCheckoutEventFacts,
  financialEventIgnoreReason,
  type StripeOrderCorrelation,
} from './webhook-correlation';

const order: StripeOrderCorrelation = {
  id: '11111111-1111-4111-8111-111111111111',
  provider: 'stripe',
  livemode: false,
  stripe_checkout_session_id: 'cs_test_123',
};

const session = {
  id: 'cs_test_123',
  livemode: false,
  client_reference_id: order.id,
  metadata: { orderId: order.id },
} as unknown as Stripe.Checkout.Session;

describe('Stripe webhook correlation', () => {
  it('accepts a Checkout event only for its exact local order', () => {
    expect(correlateCheckoutEventFacts(session, false, order)).toEqual({ action: 'process' });
    expect(correlateCheckoutEventFacts(session, false, null)).toEqual({
      action: 'ignore',
      reason: 'UNRELATED_STRIPE_CHECKOUT',
    });
    expect(
      correlateCheckoutEventFacts(
        { ...session, metadata: { orderId: 'other' } } as Stripe.Checkout.Session,
        false,
        order,
      ),
    ).toEqual({ action: 'ignore', reason: 'CHECKOUT_ORDER_REFERENCE_MISMATCH' });
  });

  it('retries a genuine event while its local Session attachment is pending', () => {
    expect(
      correlateCheckoutEventFacts(session, false, {
        ...order,
        stripe_checkout_session_id: null,
      }),
    ).toEqual({ action: 'retry', reason: 'CHECKOUT_ORDER_ATTACHMENT_PENDING' });
  });

  it('rejects financial events outside the local Stripe mode', () => {
    expect(financialEventIgnoreReason(false, order)).toBeNull();
    expect(financialEventIgnoreReason(true, order)).toBe(
      'FINANCIAL_EVENT_MODE_OR_PROVIDER_MISMATCH',
    );
    expect(financialEventIgnoreReason(false, null)).toBe(
      'UNRELATED_STRIPE_FINANCIAL_EVENT',
    );
  });
});
