import { z } from 'zod';
import type { CreateBookingInput, SlotsQuery } from '@/domain/booking-schemas';
import { assertServerOnly } from '@/lib/security/server-only';
import { resolveTutorEventTypeId, requireCalcomApiKey } from './config';

assertServerOnly('Cal.com server client');

const CALCOM_API_BASE = 'https://api.cal.com/v2';
const BOOKINGS_API_VERSION = '2026-02-25';
const BOOKINGS_LIST_API_VERSION = '2026-05-01';
const SLOTS_API_VERSION = '2024-09-04';

const calcomBookingDataSchema = z
  .object({
    uid: z.string().min(1),
    start: z.string().optional(),
    end: z.string().optional(),
    duration: z.number().int().positive().optional(),
    eventTypeId: z.number().int().positive().optional(),
    meetingUrl: z.string().optional(),
    location: z.string().optional(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    rescheduledFromUid: z.string().optional(),
    rescheduledToUid: z.string().optional(),
  })
  .passthrough();

const calcomBookingSchema = z.object({
  status: z.literal('success'),
  data: calcomBookingDataSchema,
});

const calcomTimedBookingDataSchema = calcomBookingDataSchema.extend({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  duration: z.number().int().positive(),
}).refine(
  (booking) => Date.parse(booking.end) - Date.parse(booking.start) === booking.duration * 60_000,
  'Provider booking interval and duration must agree',
);

const calcomTimedBookingSchema = z.object({
  status: z.literal('success'),
  data: calcomTimedBookingDataSchema,
});

const calcomBookingsListSchema = z.object({
  status: z.literal('success'),
  data: z.array(calcomTimedBookingDataSchema),
  pagination: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

const calcomSlotsSchema = z.object({
  status: z.literal('success'),
  data: z.record(z.string(), z.array(z.object({ start: z.string().min(1) }))),
});

function safeMeetingUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.toString().length <= 2_000
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function parseTimedBooking(
  payload: unknown,
  operation: 'create' | 'reschedule',
): z.infer<typeof calcomTimedBookingSchema> {
  const parsed = calcomTimedBookingSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, operation);
  return parsed.data;
}

export class CalcomApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: 'create' | 'cancel' | 'reschedule' | 'slots' | 'get' | 'list',
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

export async function createCalcomBooking(input: CreateBookingInput, internalBookingId: string) {
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
        internalBookingId,
        tutorSlug: input.tutorSlug,
        subjectId: input.subjectId,
        packageId: input.packageId,
        location: input.location,
      },
      ...(input.location === 'in-person'
        ? { location: { type: 'address', address: input.locationVenue } }
        : {}),
    }),
  });

  const parsed = parseTimedBooking(payload, 'create');
  return {
    uid: parsed.data.uid,
    eventTypeId: parsed.data.eventTypeId ?? eventTypeId,
    startsAt: parsed.data.start,
    endsAt: parsed.data.end,
    durationMinutes: parsed.data.duration,
    providerStatus: parsed.data.status ?? null,
    meetingUrl: safeMeetingUrl(parsed.data.meetingUrl ?? parsed.data.location),
  };
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
  return {
    uid: parsed.data.data.uid,
    status: parsed.data.data.status ?? null,
    rescheduledFromUid: parsed.data.data.rescheduledFromUid ?? null,
    rescheduledToUid: parsed.data.data.rescheduledToUid ?? null,
  };
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

  const parsed = parseTimedBooking(payload, 'reschedule');
  return {
    uid: parsed.data.uid,
    startsAt: parsed.data.start,
    endsAt: parsed.data.end,
    providerStatus: parsed.data.status ?? null,
    meetingUrl: safeMeetingUrl(parsed.data.meetingUrl ?? parsed.data.location),
  };
}

export async function getCalcomSlots(
  query: SlotsQuery,
  bookingUidToReschedule?: string,
): Promise<Array<{ start: string }>> {
  const eventTypeId = resolveTutorEventTypeId(query.tutorSlug);
  const search = new URLSearchParams({
    eventTypeId: String(eventTypeId),
    start: query.start,
    end: query.end,
    timeZone: query.timeZone,
  });
  if (bookingUidToReschedule) search.set('bookingUidToReschedule', bookingUidToReschedule);
  const payload = await calcomRequest(`/slots?${search}`, SLOTS_API_VERSION, 'slots', { method: 'GET' });
  const parsed = calcomSlotsSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, 'slots');

  return Object.values(parsed.data.data)
    .flat()
    .sort((left, right) => left.start.localeCompare(right.start));
}

export async function getCalcomBooking(bookingUid: string) {
  const payload = await calcomRequest(
    `/bookings/${encodeURIComponent(bookingUid)}`,
    BOOKINGS_API_VERSION,
    'get',
    { method: 'GET' },
  );
  const parsed = calcomTimedBookingSchema.safeParse(payload);
  if (!parsed.success) throw new CalcomApiError(502, 'get');

  return {
    uid: parsed.data.data.uid,
    status: parsed.data.data.status ?? null,
    startsAt: parsed.data.data.start,
    endsAt: parsed.data.data.end,
    durationMinutes: parsed.data.data.duration,
    meetingUrl: safeMeetingUrl(parsed.data.data.meetingUrl ?? parsed.data.data.location),
    rescheduledFromUid: parsed.data.data.rescheduledFromUid ?? null,
    rescheduledToUid: parsed.data.data.rescheduledToUid ?? null,
  };
}

/**
 * Recovers only the provider booking that carries our exact internal UUID.
 * This is deliberately a lookup, never a retry of the external create call.
 */
export async function findCalcomBookingByInternalId(input: {
  internalBookingId: string;
  attendeeEmail: string;
  createdAt: string;
}) {
  const createdAt = new Date(input.createdAt);
  if (Number.isNaN(createdAt.getTime())) throw new CalcomApiError(422, 'list');

  const afterCreatedAt = new Date(createdAt.getTime() - 5 * 60_000).toISOString();
  const beforeCreatedAt = new Date(createdAt.getTime() + 60 * 60_000).toISOString();
  const matches = await listCalcomBookingsByInternalId({
    internalBookingId: input.internalBookingId,
    attendeeEmail: input.attendeeEmail,
    afterCreatedAt,
    beforeCreatedAt,
  });

  // More than one create in this narrow window is never safe to adopt.
  if (matches.length > 1) throw new CalcomApiError(502, 'list');
  if (matches.length === 0) return null;
  return calcomListBookingToSnapshot(matches[0]);
}

async function listCalcomBookingsByInternalId(input: {
  internalBookingId: string;
  attendeeEmail: string;
  afterCreatedAt: string;
  beforeCreatedAt: string;
}) {
  const matches: z.infer<typeof calcomBookingDataSchema>[] = [];
  let cursor: string | null = null;
  let searchComplete = false;

  // The email and narrow creation window normally fit in one page. A second
  // page covers bursts while keeping the reconciliation worker strictly bounded.
  for (let page = 0; page < 2; page += 1) {
    const search = new URLSearchParams({
      attendeeEmail: input.attendeeEmail.trim().toLowerCase(),
      afterCreatedAt: input.afterCreatedAt,
      beforeCreatedAt: input.beforeCreatedAt,
      limit: '100',
    });
    if (cursor) search.set('cursor', cursor);

    const payload = await calcomRequest(
      `/bookings?${search}`,
      BOOKINGS_LIST_API_VERSION,
      'list',
      { method: 'GET' },
    );
    const parsed = calcomBookingsListSchema.safeParse(payload);
    if (!parsed.success) throw new CalcomApiError(502, 'list');

    matches.push(
      ...parsed.data.data.filter(
        (booking) => booking.metadata?.internalBookingId === input.internalBookingId,
      ),
    );
    if (!parsed.data.pagination.hasMore) {
      searchComplete = true;
      break;
    }
    cursor = parsed.data.pagination.nextCursor;
    if (!cursor) throw new CalcomApiError(502, 'list');
  }

  // A missing match is only authoritative after the complete bounded result
  // set was inspected.
  if (!searchComplete) throw new CalcomApiError(502, 'list');
  return matches;
}

function calcomListBookingToSnapshot(booking: z.infer<typeof calcomBookingDataSchema>) {
  return {
    uid: booking.uid,
    status: booking.status ?? null,
    startsAt: booking.start ?? null,
    endsAt: booking.end ?? null,
    durationMinutes: booking.duration ?? null,
    meetingUrl: safeMeetingUrl(booking.meetingUrl ?? booking.location),
    rescheduledFromUid: booking.rescheduledFromUid ?? null,
    rescheduledToUid: booking.rescheduledToUid ?? null,
  };
}

/**
 * Resolves the current logical lesson after a source UID returns 404. The
 * broader, complete list search can prove a unique replacement lineage or a
 * complete absence without treating the missing source UID as cancellation.
 */
export async function findCalcomBookingLineageByInternalId(input: {
  internalBookingId: string;
  attendeeEmail: string;
  createdAt: string;
  observedAt: string;
  sourceUid: string;
}) {
  const createdAt = new Date(input.createdAt);
  const observedAt = new Date(input.observedAt);
  if (
    Number.isNaN(createdAt.getTime()) ||
    Number.isNaN(observedAt.getTime()) ||
    observedAt < createdAt ||
    !input.sourceUid.trim()
  ) {
    throw new CalcomApiError(422, 'list');
  }

  const matches = await listCalcomBookingsByInternalId({
    internalBookingId: input.internalBookingId,
    attendeeEmail: input.attendeeEmail,
    afterCreatedAt: new Date(createdAt.getTime() - 5 * 60_000).toISOString(),
    beforeCreatedAt: new Date(observedAt.getTime() + 5 * 60_000).toISOString(),
  });
  if (matches.length === 0) return null;

  const byUid = new Map<string, z.infer<typeof calcomBookingDataSchema>>();
  const childrenBySource = new Map<string, z.infer<typeof calcomBookingDataSchema>[]>();
  for (const booking of matches) {
    if (byUid.has(booking.uid)) throw new CalcomApiError(502, 'list');
    byUid.set(booking.uid, booking);
    if (booking.rescheduledFromUid) {
      const children = childrenBySource.get(booking.rescheduledFromUid) ?? [];
      if (children.length > 0) throw new CalcomApiError(502, 'list');
      children.push(booking);
      childrenBySource.set(booking.rescheduledFromUid, children);
    }
  }

  let currentUid = input.sourceUid;
  let current = byUid.get(currentUid) ?? null;
  let firstReplacement: z.infer<typeof calcomBookingDataSchema> | null = null;
  const traversedUids = new Set([currentUid]);
  const visitedMatches = new Set<string>();
  if (current) visitedMatches.add(current.uid);

  for (let hop = 0; hop < 6; hop += 1) {
    const children = childrenBySource.get(currentUid) ?? [];
    const expectedNextUid = current?.rescheduledToUid ?? null;
    let next: z.infer<typeof calcomBookingDataSchema> | null = null;

    if (expectedNextUid) {
      next = byUid.get(expectedNextUid) ?? null;
      if (
        !next ||
        next.rescheduledFromUid !== currentUid ||
        children.length !== 1 ||
        children[0].uid !== expectedNextUid
      ) {
        throw new CalcomApiError(502, 'list');
      }
    } else if (children.length === 1) {
      next = children[0];
    } else if (children.length > 1) {
      throw new CalcomApiError(502, 'list');
    }

    if (!next) break;
    if (hop === 5 || traversedUids.has(next.uid)) throw new CalcomApiError(502, 'list');
    firstReplacement ??= next;
    traversedUids.add(next.uid);
    visitedMatches.add(next.uid);
    currentUid = next.uid;
    current = next;
  }

  if (!current) throw new CalcomApiError(502, 'list');

  // Matches before the current source UID are allowed only when they form one
  // unbroken ancestor chain into that source. Any unrelated duplicate internal
  // ID or branch makes automatic adoption unsafe.
  for (const booking of matches) {
    if (visitedMatches.has(booking.uid)) continue;
    let ancestor = booking;
    const ancestorUids = new Set([ancestor.uid]);
    let reachesSource = false;
    for (let hop = 0; hop < 6; hop += 1) {
      const nextUid = ancestor.rescheduledToUid;
      if (nextUid === input.sourceUid) {
        reachesSource = true;
        break;
      }
      if (!nextUid || ancestorUids.has(nextUid)) break;
      const next = byUid.get(nextUid);
      if (!next || next.rescheduledFromUid !== ancestor.uid) break;
      ancestorUids.add(nextUid);
      ancestor = next;
    }
    if (!reachesSource) throw new CalcomApiError(502, 'list');
  }
  const snapshot = calcomListBookingToSnapshot(current);
  return current.uid === input.sourceUid
    ? snapshot
    : {
        ...snapshot,
        lineageRootUid: input.sourceUid,
        lineageFirstReplacementUid: firstReplacement?.uid ?? null,
        lineageFirstReplacementStartsAt: firstReplacement?.start ?? null,
        lineageFirstReplacementEndsAt: firstReplacement?.end ?? null,
      };
}
