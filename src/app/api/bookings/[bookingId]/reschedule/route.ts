import { addYears, isAfter, isBefore } from 'date-fns';
import { NextResponse } from 'next/server';
import { bookingIdSchema, rescheduleBookingSchema } from '@/domain/booking-schemas';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireAuthenticatedUser, requireBookingAccess } from '@/lib/auth/server';
import { CalcomApiError, rescheduleCalcomBooking } from '@/lib/calcom/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  try {
    const bookingId = bookingIdSchema.parse((await context.params).bookingId);
    const input = rescheduleBookingSchema.parse(await parseJsonRequest(request));
    const startsAt = new Date(input.startsAt);
    if (isBefore(startsAt, new Date()) || isAfter(startsAt, addYears(new Date(), 1))) {
      throw new ApiError(400, 'INVALID_START_TIME', 'Choose a future time within the next year.');
    }

    const user = await requireAuthenticatedUser();
    const { booking, service } = await requireBookingAccess(bookingId, user);
    if (booking.status !== 'scheduled') {
      throw new ApiError(409, 'BOOKING_NOT_RESCHEDULABLE', 'This booking cannot be rescheduled.');
    }

    const calcom = await rescheduleCalcomBooking(
      booking.calcom_booking_uid,
      input.startsAt,
      input.reason,
    );
    const { data, error } = await service
      .from('bookings')
      .update({
        starts_at: new Date(calcom.startsAt).toISOString(),
        time_zone: input.timeZone,
        calcom_booking_uid: calcom.uid,
      })
      .eq('id', booking.id)
      .eq('calcom_booking_uid', booking.calcom_booking_uid)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (error || !data) {
      throw new ApiError(502, 'DATABASE_SYNC_FAILED', 'The provider rescheduled the booking, but synchronization failed.');
    }
    return NextResponse.json({
      data: {
        booking: {
          id: booking.id,
          startsAt: new Date(calcom.startsAt).toISOString(),
          status: 'scheduled' as const,
        },
      },
    });
  } catch (error) {
    if (error instanceof CalcomApiError) {
      const unavailable = error.status === 409 || error.status === 400;
      return apiErrorResponse(
        new ApiError(
          unavailable ? 409 : 502,
          unavailable ? 'SLOT_UNAVAILABLE' : 'SCHEDULING_PROVIDER_ERROR',
          unavailable ? 'That time is no longer available.' : 'The scheduling provider could not reschedule the booking.',
        ),
      );
    }
    return apiErrorResponse(error);
  }
}
