import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { checkoutSessionSchema, type CheckoutSessionResponse } from '@/domain/commerce-schemas';
import { paymentOrderRpcSchema } from '@/domain/backend-contracts';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import {
  requireCanonicalSiteOrigin,
  requirePaymentsEnabled,
  requireStripeSecretKey,
  requireStripeWebhookSecret,
} from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';
import {
  isDefinitiveOfferAttachmentRace,
  isReusableOpenCheckoutSession,
} from '@/lib/stripe/checkout-integrity';

export const runtime = 'nodejs';

function checkoutResponse(orderId: string, checkoutUrl: string, status: number) {
  const response: CheckoutSessionResponse = { data: { orderId, checkoutUrl } };
  return NextResponse.json(response, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function POST(request: Request) {
  try {
    requirePaymentsEnabled();
    requireStripeWebhookSecret();
    const input = checkoutSessionSchema.parse(await parseJsonRequest(request));
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    await enforceRateLimit({
      request,
      scope: 'checkout',
      limit: 10,
      windowSeconds: 900,
      subject: principal.user.id,
    });
    if (!principal.householdId || !principal.householdPermissions?.canManageBilling) {
      throw new ApiError(403, 'HOUSEHOLD_REQUIRED', 'A household is required before buying a package.');
    }
    if (!principal.user.email) {
      throw new ApiError(400, 'EMAIL_REQUIRED', 'A verified account email is required for checkout.');
    }

    const service = createSupabaseServiceClient();
    const { data: rawOrder, error: orderError } = await service.rpc('create_payment_order', {
      p_user_id: principal.user.id,
      p_household_id: principal.householdId,
      p_package_slug: input.packageId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (orderError) {
      throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The payment order could not be created.');
    }

    const order = paymentOrderRpcSchema.parse(rawOrder);
    const { data: currentOrder, error: currentOrderError } = await service
      .from('payment_orders')
      .select(
        'status,stripe_checkout_session_id,livemode,offer_version_id,amount_cents,currency',
      )
      .eq('id', order.order_id)
      .eq('user_id', principal.user.id)
      .single();
    if (currentOrderError) {
      throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The payment order could not be loaded.');
    }

    if (order.currency !== 'EUR' || currentOrder.currency !== 'EUR') {
      throw new ApiError(409, 'OFFER_NOT_AVAILABLE', 'This package is no longer available.');
    }

    const siteOrigin = requireCanonicalSiteOrigin();
    const runtimeLivemode = requireStripeSecretKey().startsWith('sk_live_');
    if (currentOrder.livemode !== runtimeLivemode) {
      throw new ApiError(
        503,
        'OFFER_MODE_MISMATCH',
        'This package is not configured for the active payment environment.',
      );
    }
    const stripe = getStripeClient();

    if (currentOrder.status === 'paid') {
      return checkoutResponse(order.order_id, `${siteOrigin}/dashboard`, 200);
    }
    if (currentOrder.status !== 'pending' && currentOrder.status !== 'checkout_created') {
      throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Create a new checkout request for this package.');
    }

    if (currentOrder.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        currentOrder.stripe_checkout_session_id,
        { expand: ['line_items.data.price'] },
      );
      if (
        isReusableOpenCheckoutSession(existing, {
          orderId: order.order_id,
          stripePriceId: order.stripe_price_id,
          amountCents: order.amount_cents,
          currency: 'EUR',
          livemode: currentOrder.livemode,
        })
      ) {
        return checkoutResponse(order.order_id, existing.url, 200);
      }
      throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Create a new checkout request for this package.');
    }

    if (!/^price_[A-Za-z0-9]+$/.test(order.stripe_price_id)) {
      throw new ApiError(503, 'OFFER_NOT_CONFIGURED', 'This package is not configured for checkout.');
    }

    const { data: offer, error: offerError } = await service
      .from('offer_versions')
      .select(
        'id,package_id,provider,amount_cents,currency,stripe_product_id,stripe_price_id,stripe_livemode,tax_behavior,effective_from,effective_until',
      )
      .eq('id', currentOrder.offer_version_id)
      .single();
    if (offerError || !offer) {
      throw new ApiError(503, 'OFFER_NOT_CONFIGURED', 'This package is not configured for checkout.');
    }

    const [{ data: activeOffer, error: activeOfferError }, { data: activePackage, error: packageError }] =
      await Promise.all([
        service
          .from('active_offers')
          .select('offer_version_id,checkout_enabled')
          .eq('package_id', offer.package_id)
          .maybeSingle(),
        service.from('packages').select('active').eq('id', offer.package_id).single(),
      ]);
    if (activeOfferError || packageError) {
      throw new ApiError(503, 'OFFER_UNAVAILABLE', 'This package is temporarily unavailable.');
    }

    const now = Date.now();
    const offerIsCurrent =
      Date.parse(offer.effective_from) <= now &&
      (!offer.effective_until || Date.parse(offer.effective_until) > now);
    const immutableFactsMatch =
      offer.id === order.offer_version_id &&
      offer.id === currentOrder.offer_version_id &&
      offer.provider === 'stripe' &&
      offer.tax_behavior === 'inclusive' &&
      offer.stripe_price_id === order.stripe_price_id &&
      offer.stripe_livemode === currentOrder.livemode &&
      offer.amount_cents === order.amount_cents &&
      offer.amount_cents === currentOrder.amount_cents &&
      offer.currency === 'EUR' &&
      offer.currency === order.currency &&
      offer.currency === currentOrder.currency;
    if (
      !activePackage?.active ||
      !activeOffer?.checkout_enabled ||
      activeOffer.offer_version_id !== offer.id ||
      !offerIsCurrent ||
      !immutableFactsMatch
    ) {
      throw new ApiError(409, 'OFFER_NOT_AVAILABLE', 'This package is no longer available.');
    }

    const providerPrice = await stripe.prices.retrieve(order.stripe_price_id, {
      expand: ['product'],
    });
    const providerProduct = providerPrice.product;
    const productIsCurrent =
      typeof providerProduct !== 'string' &&
      providerProduct.id === offer.stripe_product_id &&
      !('deleted' in providerProduct && providerProduct.deleted) &&
      'active' in providerProduct &&
      providerProduct.active;
    if (
      !providerPrice.active ||
      providerPrice.type !== 'one_time' ||
      providerPrice.recurring !== null ||
      providerPrice.billing_scheme !== 'per_unit' ||
      providerPrice.unit_amount !== order.amount_cents ||
      providerPrice.currency.toUpperCase() !== 'EUR' ||
      Object.keys(providerPrice.currency_options ?? {}).length > 0 ||
      providerPrice.custom_unit_amount != null ||
      providerPrice.transform_quantity != null ||
      providerPrice.tax_behavior !== 'inclusive' ||
      providerPrice.livemode !== currentOrder.livemode ||
      !productIsCurrent
    ) {
      throw new ApiError(
        503,
        'OFFER_PROVIDER_MISMATCH',
        'This package is not safely configured for checkout.',
      );
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        currency: 'eur',
        adaptive_pricing: { enabled: false },
        locale: 'de',
        line_items: [{ price: order.stripe_price_id, quantity: 1 }],
        customer_email: principal.user.email,
        customer_creation: 'always',
        billing_address_collection: 'required',
        invoice_creation: { enabled: true },
        automatic_tax: {
          enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED?.toLowerCase() === 'true',
        },
        client_reference_id: order.order_id,
        metadata: { orderId: order.order_id },
        payment_intent_data: { metadata: { orderId: order.order_id } },
        success_url: `${siteOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteOrigin}/#preise`,
        expand: ['line_items.data.price'],
      },
      { idempotencyKey: `checkout:${order.order_id}` },
    );

    if (
      !isReusableOpenCheckoutSession(session, {
        orderId: order.order_id,
        stripePriceId: order.stripe_price_id,
        amountCents: order.amount_cents,
        currency: 'EUR',
        livemode: currentOrder.livemode,
      })
    ) {
      throw new ApiError(502, 'CHECKOUT_UNAVAILABLE', 'Stripe returned an invalid checkout session.');
    }

    const { error: attachError } = await service.rpc('attach_stripe_checkout_session', {
      p_order_id: order.order_id,
      p_user_id: principal.user.id,
      p_checkout_session_id: session.id,
      p_stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    });
    if (attachError) {
      if (isDefinitiveOfferAttachmentRace(attachError)) {
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
        throw new ApiError(409, 'OFFER_NOT_AVAILABLE', 'This package is no longer available.');
      }
      throw new ApiError(503, 'ORDER_UNAVAILABLE', 'The checkout session could not be attached to the order.');
    }

    return checkoutResponse(order.order_id, session.url, 201);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return apiErrorResponse(
        new ApiError(502, 'CHECKOUT_UNAVAILABLE', 'The secure checkout is temporarily unavailable.'),
      );
    }
    return apiErrorResponse(error);
  }
}
