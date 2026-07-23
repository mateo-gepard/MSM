import type Stripe from 'stripe';

export type CheckoutOrderSnapshot = {
  orderId: string;
  stripePriceId: string;
  amountCents: number;
  currency: 'EUR';
  livemode: boolean;
};

function expandedPrice(
  value: Stripe.Price | Stripe.DeletedPrice | null,
): Stripe.Price | null {
  if (!value || ('deleted' in value && value.deleted)) return null;
  return value;
}

/**
 * A Checkout URL is reusable only when the provider object still describes the
 * exact immutable order that owns it. This intentionally does not consult the
 * current sales pointer: a URL already handed to a customer is grandfathered,
 * but it cannot be rebound to different commercial facts.
 */
export function isReusableOpenCheckoutSession(
  session: Stripe.Checkout.Session,
  order: CheckoutOrderSnapshot,
): session is Stripe.Checkout.Session & { url: string } {
  const items = session.line_items?.data ?? [];
  const item = items[0];
  const price = item
    ? expandedPrice(item.price as Stripe.Price | Stripe.DeletedPrice | null)
    : null;

  return (
    session.status === 'open' &&
    session.payment_status === 'unpaid' &&
    typeof session.url === 'string' &&
    session.url.length > 0 &&
    session.mode === 'payment' &&
    session.livemode === order.livemode &&
    session.client_reference_id === order.orderId &&
    session.metadata?.orderId === order.orderId &&
    session.currency?.toUpperCase() === order.currency &&
    session.amount_subtotal === order.amountCents &&
    session.amount_total === order.amountCents &&
    items.length === 1 &&
    session.line_items?.has_more === false &&
    item?.quantity === 1 &&
    item.amount_subtotal === order.amountCents &&
    item.amount_total === order.amountCents &&
    price !== null &&
    price.id === order.stripePriceId &&
    price.livemode === order.livemode &&
    price.type === 'one_time' &&
    price.recurring === null &&
    price.billing_scheme === 'per_unit' &&
    price.unit_amount === order.amountCents &&
    price.currency.toUpperCase() === order.currency &&
    Object.keys(price.currency_options ?? {}).length === 0 &&
    price.custom_unit_amount === null &&
    price.transform_quantity === null &&
    price.tax_behavior === 'inclusive'
  );
}

export function isDefinitiveOfferAttachmentRace(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  return ['message', 'details', 'hint'].some((field) => {
    const value = Reflect.get(error, field);
    return typeof value === 'string' && value.includes('OFFER_NOT_AVAILABLE');
  });
}
