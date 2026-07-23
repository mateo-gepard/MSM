import { describe, expect, it } from 'vitest';
import {
  createBookingSchema,
  rescheduleBookingSchema,
  slotsQuerySchema,
} from './booking-schemas';

const validBooking = {
  idempotencyKey: '3d6f0a89-748d-4f23-b21e-8809628abade',
  tutorSlug: 'mateo-mamaladze',
  subjectId: 'physics',
  packageId: 'trial',
  startsAt: '2030-05-05T10:00:00.000Z',
  timeZone: 'Europe/Berlin',
  location: 'online',
  contact: { name: 'Test Parent', email: 'parent@example.com' },
} as const;

describe('createBookingSchema', () => {
  it('accepts the canonical request shape', () => {
    expect(createBookingSchema.parse(validBooking)).toMatchObject(validBooking);
  });

  it.each(['userId', 'price', 'eventTypeId', 'calcomBookingUid', 'packagePurchaseId'])(
    'rejects untrusted %s',
    (field) => {
    expect(createBookingSchema.safeParse({ ...validBooking, [field]: 'attacker-controlled' }).success).toBe(false);
    },
  );

  it('requires a venue for in-person lessons', () => {
    expect(createBookingSchema.safeParse({ ...validBooking, location: 'in-person' }).success).toBe(false);
  });

  it('rejects invalid identifiers and time zones', () => {
    expect(createBookingSchema.safeParse({ ...validBooking, tutorSlug: '1' }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...validBooking, timeZone: 'Moon/Base' }).success).toBe(false);
  });
});

describe('mutation and slots schemas', () => {
  it('rejects an inverted slot range', () => {
    expect(slotsQuerySchema.safeParse({
      tutorSlug: 'len-sobol',
      start: '2030-05-05',
      end: '2030-05-04',
      timeZone: 'Europe/Berlin',
    }).success).toBe(false);
  });

  it('requires an offset-bearing reschedule timestamp', () => {
    const idempotencyKey = '3d6f0a89-748d-4f23-b21e-8809628abade';
    expect(rescheduleBookingSchema.safeParse({ idempotencyKey, startsAt: '2030-05-05T10:00:00' }).success).toBe(false);
    expect(rescheduleBookingSchema.safeParse({ idempotencyKey, startsAt: '2030-05-05T10:00:00Z' }).success).toBe(true);
  });
});
