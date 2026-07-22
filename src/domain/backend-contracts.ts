import { z } from 'zod';

export const bookingLifecycleSchema = z.enum([
  'provider_pending',
  'pending_confirmation',
  'scheduled',
  'completed',
  'cancellation_pending',
  'reschedule_pending',
  'cancelled',
  'failed',
]);

const bookingCreditSchema = z.enum(['none', 'reserved', 'consumed', 'released', 'restored']);

export const paymentOrderRpcSchema = z.object({
  order_id: z.uuid(),
  offer_version_id: z.uuid(),
  stripe_price_id: z.string().min(1),
  amount_cents: z.number().int().positive(),
  currency: z.string().length(3),
  status: z.string().min(1),
  replayed: z.boolean(),
});

export const bookingReservationRpcSchema = z.object({
  booking_id: z.uuid(),
  operation_id: z.uuid(),
  operation_status: z.enum(['queued', 'processing', 'succeeded', 'failed', 'ambiguous']),
  lifecycle_status: bookingLifecycleSchema,
  credit_status: bookingCreditSchema,
  starts_at: z.iso.datetime({ offset: true }),
  replayed: z.boolean(),
});

export const bookingConfirmationRpcSchema = z.object({
  booking_id: z.uuid(),
  operation_id: z.uuid(),
  lifecycle_status: z.enum(['scheduled', 'pending_confirmation']),
  sync_status: z.literal('in_sync'),
  credit_status: bookingCreditSchema,
  replayed: z.boolean(),
});

export const bookingOperationRpcSchema = z.object({
  booking_id: z.uuid(),
  operation_id: z.uuid(),
  operation_type: z.enum(['cancel', 'reschedule']),
  operation_status: z.string().min(1),
  provider_booking_id: z.string().nullable(),
  booking_version: z.number().int().positive(),
  replayed: z.boolean(),
});

export const stripeFulfillmentRpcSchema = z.object({
  order_id: z.uuid(),
  package_purchase_id: z.uuid(),
  credit_grant_id: z.uuid(),
  status: z.literal('paid'),
  replayed: z.boolean(),
});

export type PaymentOrderRpcResult = z.infer<typeof paymentOrderRpcSchema>;
export type BookingReservationRpcResult = z.infer<typeof bookingReservationRpcSchema>;
export type BookingOperationRpcResult = z.infer<typeof bookingOperationRpcSchema>;
