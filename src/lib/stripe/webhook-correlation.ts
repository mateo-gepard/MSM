import type Stripe from 'stripe';

export type StripeOrderCorrelation = {
  id: string;
  provider: string;
  livemode: boolean | null;
  stripe_checkout_session_id: string | null;
};

export type CheckoutEventCorrelation =
  | { action: 'process' }
  | { action: 'retry'; reason: string }
  | { action: 'ignore'; reason: string };

export function correlateCheckoutEventFacts(
  session: Stripe.Checkout.Session,
  eventLivemode: boolean,
  order: StripeOrderCorrelation | null,
): CheckoutEventCorrelation {
  if (!order) return { action: 'ignore', reason: 'UNRELATED_STRIPE_CHECKOUT' };
  if (
    order.provider !== 'stripe' ||
    order.livemode !== eventLivemode ||
    session.livemode !== eventLivemode
  ) {
    return { action: 'ignore', reason: 'CHECKOUT_MODE_OR_PROVIDER_MISMATCH' };
  }
  if (
    session.client_reference_id !== order.id ||
    session.metadata?.orderId !== order.id
  ) {
    return { action: 'ignore', reason: 'CHECKOUT_ORDER_REFERENCE_MISMATCH' };
  }
  if (order.stripe_checkout_session_id === null) {
    return { action: 'retry', reason: 'CHECKOUT_ORDER_ATTACHMENT_PENDING' };
  }
  if (order.stripe_checkout_session_id !== session.id) {
    return { action: 'ignore', reason: 'CHECKOUT_SESSION_BINDING_MISMATCH' };
  }
  return { action: 'process' };
}

export function financialEventIgnoreReason(
  eventLivemode: boolean,
  order: StripeOrderCorrelation | null,
): string | null {
  if (!order) return 'UNRELATED_STRIPE_FINANCIAL_EVENT';
  if (order.provider !== 'stripe' || order.livemode !== eventLivemode) {
    return 'FINANCIAL_EVENT_MODE_OR_PROVIDER_MISMATCH';
  }
  return null;
}
