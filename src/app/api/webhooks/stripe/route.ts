import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { requireStripeWebhookSecret } from '@/lib/stripe/config';
import { fulfillStripeCheckout } from '@/lib/stripe/fulfillment';
import { getStripeClient } from '@/lib/stripe/server';
import {
  correlateCheckoutEventFacts,
  financialEventIgnoreReason,
  type StripeOrderCorrelation,
} from '@/lib/stripe/webhook-correlation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function objectId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;
type FinancialOrderCorrelation = StripeOrderCorrelation & {
  stripe_checkout_session_id: string | null;
};

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

async function ignoreStripeEvent(service: ServiceClient, eventId: string, reason: string) {
  const { error } = await service.rpc('ignore_stripe_event', {
    p_event_id: eventId,
    p_reason: reason,
  });
  if (error) {
    throw new ApiError(503, 'EVENT_INBOX_UNAVAILABLE', 'The event could not be finalized.');
  }
}

async function correlateCheckoutEvent(
  service: ServiceClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  const { data: attachedOrder, error: attachedOrderError } = await service
    .from('payment_orders')
    .select('id,provider,livemode,stripe_checkout_session_id')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (attachedOrderError) {
    throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The payment order could not be correlated.');
  }

  let order = attachedOrder;
  const referencedOrderId = session.metadata?.orderId;
  if (
    !order &&
    isUuid(referencedOrderId) &&
    session.client_reference_id === referencedOrderId
  ) {
    const { data: fallbackOrder, error: fallbackOrderError } = await service
      .from('payment_orders')
      .select('id,provider,livemode,stripe_checkout_session_id')
      .eq('id', referencedOrderId)
      .maybeSingle();
    if (fallbackOrderError) {
      throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The payment order could not be correlated.');
    }
    order = fallbackOrder;
  }

  const correlation = correlateCheckoutEventFacts(session, event.livemode, order);
  if (correlation.action === 'process') return true;
  if (correlation.action === 'retry') {
    throw new ApiError(503, correlation.reason, 'The payment order attachment is not ready.');
  }
  await ignoreStripeEvent(service, event.id, correlation.reason);
  return false;
}

async function findFinancialOrder(
  service: ServiceClient,
  paymentIntentId: string,
): Promise<FinancialOrderCorrelation | null> {
  const { data: attachedOrder, error: attachedOrderError } = await service
    .from('payment_orders')
    .select('id,provider,livemode,stripe_checkout_session_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (attachedOrderError) {
    throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The payment order could not be correlated.');
  }
  if (attachedOrder) return attachedOrder;

  // Refund and dispute delivery can race Checkout fulfillment. Recover only
  // through the immutable PaymentIntent metadata and the exact attached
  // Checkout Session, then let the transactional RPC retry until fulfillment
  // has stored the PaymentIntent on the order.
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const orderId = paymentIntent.metadata.orderId;
  if (!isUuid(orderId)) return null;

  const { data: metadataOrder, error: metadataOrderError } = await service
    .from('payment_orders')
    .select('id,provider,livemode,stripe_checkout_session_id')
    .eq('id', orderId)
    .maybeSingle();
  if (metadataOrderError) {
    throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The payment order could not be correlated.');
  }
  if (!metadataOrder) return null;
  if (!metadataOrder.stripe_checkout_session_id) {
    throw new ApiError(
      503,
      'CHECKOUT_ORDER_ATTACHMENT_PENDING',
      'The payment order attachment is not ready.',
    );
  }

  const session = await stripe.checkout.sessions.retrieve(metadataOrder.stripe_checkout_session_id);
  if (
    objectId(session.payment_intent) !== paymentIntentId ||
    session.client_reference_id !== metadataOrder.id ||
    session.metadata?.orderId !== metadataOrder.id ||
    session.livemode !== paymentIntent.livemode
  ) {
    return null;
  }
  return metadataOrder;
}

async function correlateFinancialEvent(
  service: ServiceClient,
  event: Stripe.Event,
  paymentIntentId: string | null,
): Promise<boolean> {
  if (!paymentIntentId) {
    await ignoreStripeEvent(service, event.id, 'FINANCIAL_EVENT_WITHOUT_PAYMENT_INTENT');
    return false;
  }

  const order = await findFinancialOrder(service, paymentIntentId);
  const reason = financialEventIgnoreReason(event.livemode, order);
  if (!reason) return true;
  await ignoreStripeEvent(service, event.id, reason);
  return false;
}

async function recordStripeEvent(event: Stripe.Event, rawBody: string) {
  const service = createSupabaseServiceClient();
  const { error } = await service.rpc('ingest_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_api_version: event.api_version ?? null,
    p_object_created_at: new Date(event.created * 1_000).toISOString(),
    p_payload: JSON.parse(rawBody),
    p_payload_sha256: createHash('sha256').update(rawBody).digest('hex'),
  });
  if (error) throw new ApiError(503, 'EVENT_INBOX_UNAVAILABLE', 'The event could not be recorded.');
  return service;
}

export async function POST(request: Request) {
  let recordedEventId: string | null = null;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new ApiError(400, 'INVALID_SIGNATURE', 'Missing Stripe signature.');

    const event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      requireStripeWebhookSecret(),
    );
    const service = await recordStripeEvent(event, rawBody);
    recordedEventId = event.id;

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (!(await correlateCheckoutEvent(service, event, session))) break;
        if (session.payment_status !== 'paid') {
          await ignoreStripeEvent(service, event.id, 'CHECKOUT_AWAITING_OR_MISSING_PAYMENT');
          break;
        }
        await fulfillStripeCheckout(service, event.id, session.id);
        break;
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (!(await correlateCheckoutEvent(service, event, session))) break;
        const { error } = await service.rpc('fail_stripe_payment_order', {
          p_event_id: event.id,
          p_checkout_session_id: session.id,
          p_status: event.type === 'checkout.session.expired' ? 'expired' : 'failed',
          p_failure_code: event.type,
          p_failure_detail: null,
        });
        if (error) throw new ApiError(503, 'PAYMENT_RECONCILIATION_FAILED', 'Payment status could not be updated.');
        break;
      }
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        const refund = event.data.object;
        const paymentIntentId = objectId(refund.payment_intent);
        const correlated = await correlateFinancialEvent(service, event, paymentIntentId);
        if (!correlated || !paymentIntentId) break;
        const { error } = await service.rpc('apply_stripe_refund', {
          p_event_id: event.id,
          p_stripe_refund_id: refund.id,
          p_payment_intent_id: paymentIntentId,
          p_amount_cents: refund.amount,
          p_currency: refund.currency,
          p_refund_status: refund.status ?? 'unknown',
          p_reason: refund.reason ?? null,
          p_provider_created_at: new Date(refund.created * 1_000).toISOString(),
        });
        if (error) throw new ApiError(503, 'REFUND_RECONCILIATION_FAILED', 'Refund status could not be updated.');
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const dispute = event.data.object;
        const paymentIntentId = objectId(dispute.payment_intent);
        const correlated = await correlateFinancialEvent(service, event, paymentIntentId);
        if (!correlated || !paymentIntentId) break;
        const { error } = await service.rpc('apply_stripe_dispute', {
          p_event_id: event.id,
          p_stripe_dispute_id: dispute.id,
          p_payment_intent_id: paymentIntentId,
          p_amount_cents: dispute.amount,
          p_currency: dispute.currency,
          p_dispute_status: dispute.status,
        });
        if (error) throw new ApiError(503, 'DISPUTE_RECONCILIATION_FAILED', 'Dispute status could not be updated.');
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (recordedEventId) {
      try {
        await createSupabaseServiceClient().rpc('mark_stripe_event_failed', {
          p_event_id: recordedEventId,
          p_error: error instanceof ApiError ? error.code : 'WEBHOOK_HANDLER_ERROR',
        });
      } catch {
        // Stripe receives the non-2xx response below and retries the event.
      }
    }
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return apiErrorResponse(new ApiError(400, 'INVALID_SIGNATURE', 'Invalid Stripe signature.'));
    }
    return apiErrorResponse(error);
  }
}
