import { describe, expect, it } from 'vitest';
import { removeClaimedSlots } from './availability';

const slots = [
  { start: '2030-05-05T09:00:00.000Z' },
  { start: '2030-05-05T10:00:00.000Z' },
  { start: '2030-05-05T11:00:00.000Z' },
];

describe('local slot-claim overlay', () => {
  it('removes provider slots overlapping canonical or reschedule claims', () => {
    expect(
      removeClaimedSlots(slots, [
        {
          bookingId: 'booking-a',
          startsAt: '2030-05-05T09:30:00.000Z',
          endsAt: '2030-05-05T10:30:00.000Z',
        },
      ]),
    ).toEqual([{ start: '2030-05-05T11:00:00.000Z' }]);
  });

  it('keeps adjacent intervals and the current booking during rescheduling', () => {
    expect(
      removeClaimedSlots(
        slots,
        [
          {
            bookingId: 'current-booking',
            startsAt: '2030-05-05T09:00:00.000Z',
            endsAt: '2030-05-05T10:00:00.000Z',
          },
          {
            bookingId: 'other-booking',
            startsAt: '2030-05-05T12:00:00.000Z',
            endsAt: '2030-05-05T13:00:00.000Z',
          },
        ],
        { excludedBookingId: 'current-booking' },
      ),
    ).toEqual(slots);
  });

  it('normalizes the excluded booking ID and uses the actual reschedule duration', () => {
    const bookingId = '8bb08d6d-4bc1-4e5f-9ad8-673f78769341';
    expect(
      removeClaimedSlots(
        slots,
        [
          {
            bookingId,
            startsAt: '2030-05-05T09:00:00.000Z',
            endsAt: '2030-05-05T10:30:00.000Z',
          },
          {
            bookingId: 'other-booking',
            startsAt: '2030-05-05T11:00:00.000Z',
            endsAt: '2030-05-05T12:00:00.000Z',
          },
        ],
        { excludedBookingId: bookingId.toUpperCase(), durationMinutes: 90 },
      ),
    ).toEqual([{ start: '2030-05-05T09:00:00.000Z' }]);
  });

  it('does not hide an adjacent interval for a shorter legacy lesson', () => {
    expect(
      removeClaimedSlots(
        [{ start: '2030-05-05T10:00:00.000Z' }],
        [
          {
            bookingId: 'other-booking',
            startsAt: '2030-05-05T10:30:00.000Z',
            endsAt: '2030-05-05T11:00:00.000Z',
          },
        ],
        { durationMinutes: 30 },
      ),
    ).toHaveLength(1);
  });

  it('fails closed on malformed local intervals', () => {
    expect(() =>
      removeClaimedSlots(slots, [
        { bookingId: 'booking-a', startsAt: 'invalid', endsAt: '2030-05-05T10:00:00.000Z' },
      ]),
    ).toThrow('Invalid slot-claim start');
  });

  it('fails closed on an unsupported lesson duration', () => {
    expect(() => removeClaimedSlots(slots, [], { durationMinutes: 241 })).toThrow(
      'Invalid lesson duration',
    );
  });
});
