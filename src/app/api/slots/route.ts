import { differenceInCalendarDays } from 'date-fns';
import { NextResponse } from 'next/server';
import { slotsQuerySchema, type SlotsResponse } from '@/domain/booking-schemas';
import { getTutorBySlug } from '@/domain/catalog';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { requireActivePrincipal, requireBookingAccess } from '@/lib/auth/server';
import { removeClaimedSlots } from '@/lib/booking/availability';
import { CalcomApiError, getCalcomSlots } from '@/lib/calcom/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      request,
      scope: 'slots',
      limit: 60,
      windowSeconds: 60,
    });
    const search = new URL(request.url).searchParams;
    const query = slotsQuerySchema.parse(Object.fromEntries(search.entries()));
    if (differenceInCalendarDays(new Date(query.end), new Date(query.start)) > 31) {
      throw new ApiError(400, 'DATE_RANGE_TOO_LARGE', 'Availability can be requested for up to 31 days.');
    }
    if (differenceInCalendarDays(new Date(query.start), new Date()) > 366) {
      throw new ApiError(400, 'DATE_RANGE_TOO_FAR', 'Availability can be requested up to one year ahead.');
    }

    let bookingUidToReschedule: string | undefined;
    let excludedBookingId: string | undefined;
    let durationMinutes = 60;
    if (query.bookingId) {
      const principal = await requireActivePrincipal();
      const { booking } = await requireBookingAccess(query.bookingId, principal);
      if (booking.tutor_id !== getTutorBySlug(query.tutorSlug).dbId) {
        throw new ApiError(400, 'TUTOR_MISMATCH', 'The selected tutor does not match this booking.');
      }
      const lifecycle = booking.lifecycle_status ?? booking.status;
      const providerBookingId = booking.provider_booking_id ?? booking.calcom_booking_uid;
      if (
        (lifecycle !== 'scheduled' && lifecycle !== 'pending_confirmation') ||
        !providerBookingId
      ) {
        throw new ApiError(
          409,
          'BOOKING_NOT_RESCHEDULABLE',
          'This booking cannot be rescheduled.',
        );
      }
      if (
        !Number.isInteger(booking.duration_minutes) ||
        booking.duration_minutes < 15 ||
        booking.duration_minutes > 240
      ) {
        throw new ApiError(503, 'BOOKING_DATA_INVALID', 'Availability is temporarily unavailable.');
      }
      bookingUidToReschedule = providerBookingId;
      excludedBookingId = booking.id;
      durationMinutes = booking.duration_minutes;
    }

    const tutor = getTutorBySlug(query.tutorSlug);
    const providerSlots = await getCalcomSlots(query, bookingUidToReschedule);
    // Query one day beyond either side because date-only provider ranges are
    // interpreted in the requested IANA zone rather than necessarily in UTC.
    const claimRangeStart = new Date(Date.parse(query.start) - 24 * 60 * 60 * 1_000).toISOString();
    const claimRangeEnd = new Date(Date.parse(query.end) + 48 * 60 * 60 * 1_000).toISOString();
    const { data: claimRows, error: claimError } = await createSupabaseServiceClient()
      .from('booking_slot_claims')
      .select('booking_id,starts_at,ends_at')
      .eq('tutor_id', tutor.dbId)
      .is('released_at', null)
      .lt('starts_at', claimRangeEnd)
      .gt('ends_at', claimRangeStart);
    if (claimError) {
      throw new ApiError(503, 'SLOT_CLAIMS_UNAVAILABLE', 'Availability is temporarily unavailable.');
    }

    const response: SlotsResponse = {
      data: {
        slots: removeClaimedSlots(
          providerSlots,
          (claimRows ?? []).map((claim) => ({
            bookingId: claim.booking_id,
            startsAt: claim.starts_at,
            endsAt: claim.ends_at,
          })),
          { excludedBookingId, durationMinutes },
        ),
      },
    };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    if (error instanceof CalcomApiError) {
      return apiErrorResponse(
        new ApiError(502, 'SCHEDULING_PROVIDER_ERROR', 'Availability is temporarily unavailable.'),
      );
    }
    return apiErrorResponse(error);
  }
}
