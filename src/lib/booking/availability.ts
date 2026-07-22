export interface AvailableSlot {
  start: string;
}

export interface ActiveSlotClaim {
  bookingId: string;
  startsAt: string;
  endsAt: string;
}

function instant(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`Invalid ${label}`);
  return parsed;
}

/**
 * Cal.com remains the source for tutor availability, while local canonical and
 * reschedule claims are the final concurrency authority. Overlaying both keeps
 * intentionally held intervals out of the picker before the final SQL check.
 */
export function removeClaimedSlots(
  slots: readonly AvailableSlot[],
  claims: readonly ActiveSlotClaim[],
  options: { excludedBookingId?: string; durationMinutes?: number } = {},
): AvailableSlot[] {
  const durationMinutes = options.durationMinutes ?? 60;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    throw new Error('Invalid lesson duration');
  }
  const excludedBookingId = options.excludedBookingId?.toLowerCase();
  const intervals = claims
    .filter((claim) => claim.bookingId.toLowerCase() !== excludedBookingId)
    .map((claim) => {
      const startsAt = instant(claim.startsAt, 'slot-claim start');
      const endsAt = instant(claim.endsAt, 'slot-claim end');
      if (endsAt <= startsAt) throw new Error('Invalid slot-claim interval');
      return { startsAt, endsAt };
    });

  return slots.filter((slot) => {
    const startsAt = instant(slot.start, 'provider slot');
    const endsAt = startsAt + durationMinutes * 60 * 1_000;
    return !intervals.some(
      (claim) => claim.startsAt < endsAt && claim.endsAt > startsAt,
    );
  });
}
