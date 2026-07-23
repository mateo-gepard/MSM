import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { stripeFulfillmentRpcSchema } from '@/domain/backend-contracts';
import { ApiError } from '@/lib/api/errors';
import { assertServerOnly } from '@/lib/security/server-only';
import type { Database } from '@/types/database';
import { getStripeClient } from './server';

assertServerOnly('Stripe fulfillment');

function stripeObjectId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export async function fulfillStripeCheckout(
  service: SupabaseClient<Database>,
  eventId: string,
  checkoutSessionId: string,
) {
  const session = await getStripeClient().checkout.sessions.retrieve(checkoutSessionId, {
    expand: ['line_items.data.price'],
  });

  const items = session.line_items?.data ?? [];
  if (items.length !== 1 || session.line_items?.has_more) {
    throw new ApiError(422, 'INVALID_CHECKOUT', 'Checkout must contain exactly one package.');
  }

  const item = items[0];
  const price = item.price as Stripe.Price | Stripe.DeletedPrice | null;
  const priceId = stripeObjectId(price);
  const paymentIntentId = stripeObjectId(session.payment_intent);
  const customerId = stripeObjectId(session.customer);
  if (
    session.payment_status !== 'paid' ||
    !priceId ||
    !price ||
    price.deleted === true ||
    price.unit_amount === null ||
    !paymentIntentId ||
    !session.currency ||
    session.amount_subtotal === null ||
    session.amount_total === null ||
    session.total_details === null ||
    item.quantity !== 1
  ) {
    throw new ApiError(422, 'PAYMENT_NOT_FULFILLABLE', 'The checkout payment is not fulfillable.');
  }

  const { data, error } = await service.rpc('fulfill_stripe_checkout', {
    p_event_id: eventId,
    p_checkout_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_amount_subtotal: session.amount_subtotal,
    p_amount_total: session.amount_total,
    p_tax_amount: session.total_details.amount_tax,
    p_currency: session.currency,
    p_payment_status: session.payment_status,
    p_stripe_price_id: priceId,
    p_price_unit_amount: price.unit_amount,
    p_quantity: item.quantity,
    p_stripe_customer_id: customerId,
  });
  if (error) {
    throw new ApiError(503, 'FULFILLMENT_FAILED', 'The payment could not be reconciled.');
  }

  return stripeFulfillmentRpcSchema.parse(data);
}
