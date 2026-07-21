import { z } from 'zod';
import type { CreateBookingInput, SlotsQuery } from '@/domain/booking-schemas';
import { assertServerOnly } from '@/lib/security/server-only';
import { resolveTutorEventTypeId, requireCalcomApiKey } from './config';

assertServerOnly('Cal.com server client');

const CALCOM_API_BASE = 'https://api.cal.com/v2';
const BOOKINGS_API_VERSION = '2026-02-25';
const SLOTS_API_VERSION = '2024-09-04';

const calcomBookingSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    uid: z.string().min(1),
    start: z.string().optional(),
    status: z.string().optional(),
  }),
});

const calcomSlotsSchema = z.object({
  status: z.literal('success'),
  data: z.record(z.string(), z.array(z.object({ start: z.string().min(1) }))),
});

export class CalcomApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: 'create' | 'cancel' | 'reschedule' | 'slots',
  ) {
    super(`Cal.com ${operation} request failed`);
    this.name = 'CalcomApiError';
  }
}

async function calcomRequest(
  path: string,
  apiVersion: string,
  operation: CalcomApiError['operation'],
  init: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${CALCOM_API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${requireCalcomApiKey()}`,
      'cal-api-version': apiVersion,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new CalcomApiError(response.status, operation);
  return payload;
}

export async function createCalcomBooking(input: CreateBookingInput) {
  const eventTypeId = resolveTutorEventTypeId(input.tutorSlug);
  const payload = await calcomRequest('/bookings', BOOKINGS_API_VERSION, 'create', {
    method: 'POST',
    body: JSON.stringify({
      start: new Date(input.startsAt).toISOString(),
      eventTypeId,
      attendee: {
        name: input.contact.name,
        email: input.contact.email,
        phoneNumber: input.contact.phone || undefined,
        timeZone: input.timeZone,
        language: 'de',
      },
      metadata: {
        tutorSlug: input.tutorSlug,
        subjectId: input.subjectId,
        packageId: input.packageId,
        location: input.location,
      },
    }),
  });

  const parsed = calcomBookingSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, 'create');
  return { uid: parsed.data.data.uid, eventTypeId, startsAt: parsed.data.data.start ?? input.startsAt };
}

export async function cancelCalcomBooking(bookingUid: string, reason?: string) {
  const payload = await calcomRequest(
    `/bookings/${encodeURIComponent(bookingUid)}/cancel`,
    BOOKINGS_API_VERSION,
    'cancel',
    {
      method: 'POST',
      body: JSON.stringify({ cancellationReason: reason ?? 'User requested cancellation' }),
    },
  );

  const parsed = calcomBookingSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, 'cancel');
  return { uid: parsed.data.data.uid };
}

export async function rescheduleCalcomBooking(
  bookingUid: string,
  startsAt: string,
  reason?: string,
) {
  const payload = await calcomRequest(
    `/bookings/${encodeURIComponent(bookingUid)}/reschedule`,
    BOOKINGS_API_VERSION,
    'reschedule',
    {
      method: 'POST',
      body: JSON.stringify({
        start: new Date(startsAt).toISOString(),
        reschedulingReason: reason ?? 'User requested reschedule',
      }),
    },
  );

  const parsed = calcomBookingSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, 'reschedule');
  return { uid: parsed.data.data.uid, startsAt: parsed.data.data.start ?? startsAt };
}

export async function getCalcomSlots(query: SlotsQuery): Promise<Array<{ start: string }>> {
  const eventTypeId = resolveTutorEventTypeId(query.tutorSlug);
  const search = new URLSearchParams({
    eventTypeId: String(eventTypeId),
    start: query.start,
    end: query.end,
    timeZone: query.timeZone,
  });
  const payload = await calcomRequest(`/slots?${search}`, SLOTS_API_VERSION, 'slots', { method: 'GET' });
  const parsed = calcomSlotsSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, 'slots');

  return Object.values(parsed.data.data)
    .flat()
    .sort((left, right) => left.start.localeCompare(right.start));
}
