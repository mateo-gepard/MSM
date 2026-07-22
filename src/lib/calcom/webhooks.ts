import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Json } from '@/types/database';
import { assertServerOnly } from '@/lib/security/server-only';
import { requireCalcomWebhookSecret } from './config';

assertServerOnly('Cal.com webhook verification');

const supportedTriggerSchema = z.enum([
  'BOOKING_CREATED',
  'BOOKING_REQUESTED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
  'BOOKING_REJECTED',
  'MEETING_ENDED',
]);

const webhookSchema = z
  .object({
    triggerEvent: supportedTriggerSchema,
    createdAt: z.iso.datetime({ offset: true }).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    uid: z.string().min(1).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type CalcomWebhookTrigger = z.infer<typeof supportedTriggerSchema>;

export const CALCOM_WEBHOOK_MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;

export interface CalcomWebhookEvent {
  eventId: string;
  payloadSha256: string;
  trigger: CalcomWebhookTrigger;
  providerBookingUid: string;
  rescheduledFromUid: string | null;
  rescheduledToUid: string | null;
  internalBookingId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  providerStatus: string | null;
  meetingUrl: string | null;
  occurredAt: string;
  payload: Json;
}

function normalizedSignature(value: string): string {
  return value.trim().replace(/^sha256=/i, '').toLowerCase();
}

export function verifyCalcomWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret = requireCalcomWebhookSecret(),
): boolean {
  if (!signature) return false;

  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8');
  const provided = Buffer.from(normalizedSignature(signature), 'utf8');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonicalOccurredAt(candidate: string | null, receivedAt: Date): string {
  const receivedAtMs = receivedAt.getTime();
  if (!Number.isFinite(receivedAtMs)) throw new Error('Invalid webhook receipt time');
  if (!candidate) return receivedAt.toISOString();
  const candidateMs = Date.parse(candidate);
  if (
    Number.isNaN(candidateMs) ||
    candidateMs > receivedAtMs + CALCOM_WEBHOOK_MAX_FUTURE_SKEW_MS
  ) {
    return receivedAt.toISOString();
  }
  return new Date(candidateMs).toISOString();
}

export function parseCalcomWebhook(
  rawBody: string,
  receivedAt = new Date(),
): CalcomWebhookEvent {
  const parsedJson: unknown = JSON.parse(rawBody);
  const envelope = webhookSchema.parse(parsedJson);
  const payloadSha256 = createHash('sha256').update(rawBody).digest('hex');
  const bookingPayload = envelope.payload ?? envelope;
  const metadata = optionalRecord(bookingPayload.metadata ?? envelope.metadata);
  const providerBookingUid = optionalString(bookingPayload.uid ?? envelope.uid);

  if (!providerBookingUid) throw new Error('Cal.com webhook is missing a booking UID');

  const startsAt = optionalString(bookingPayload.startTime ?? envelope.startTime);
  const endsAt = optionalString(bookingPayload.endTime ?? envelope.endTime);
  const normalizedEndsAt =
    endsAt && !Number.isNaN(Date.parse(endsAt)) ? new Date(endsAt).toISOString() : null;
  // Cal.com's flat MEETING_ENDED payload uses `createdAt` for the original
  // booking creation time, not for the webhook occurrence. Using that value
  // makes the database correctly reject the completion as stale. The meeting
  // end is the provider lifecycle instant for this trigger; receipt time is a
  // fail-safe only when the provider omits or corrupts it.
  const providerOccurrence =
    envelope.triggerEvent === 'MEETING_ENDED'
      ? normalizedEndsAt
      : envelope.createdAt ?? null;
  // A malformed provider clock must not move the database watermark far into
  // the future and make every later webhook/reconciliation snapshot stale.
  const occurredAt = canonicalOccurredAt(providerOccurrence, receivedAt);

  return {
    eventId: createHash('sha256')
      .update(
        JSON.stringify([
          envelope.triggerEvent,
          envelope.createdAt ?? null,
          providerBookingUid,
          startsAt,
          endsAt,
          payloadSha256,
        ]),
      )
      .digest('hex'),
    payloadSha256,
    trigger: envelope.triggerEvent,
    providerBookingUid,
    rescheduledFromUid: optionalString(
      bookingPayload.rescheduleUid ?? bookingPayload.rescheduledFromUid,
    ),
    rescheduledToUid: optionalString(bookingPayload.rescheduledToUid),
    internalBookingId: optionalString(metadata.internalBookingId ?? metadata.bookingId),
    startsAt,
    endsAt,
    providerStatus: optionalString(bookingPayload.status),
    meetingUrl: optionalString(metadata.videoCallUrl ?? bookingPayload.meetingUrl),
    occurredAt,
    payload: parsedJson as Json,
  };
}
