import { NextResponse } from 'next/server';
import { bookingIdSchema, cancelBookingSchema } from '@/domain/booking-schemas';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireAuthenticatedUser, requireBookingAccess } from '@/lib/auth/server';
import { CalcomApiError, cancelCalcomBooking } from '@/lib/calcom/server';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  try {
    const bookingId = bookingIdSchema.parse((await context.params).bookingId);
    const input = cancelBookingSchema.parse(await parseJsonRequest(request));
    const user = await requireAuthenticatedUser();
    const { booking, service } = await requireBookingAccess(bookingId, user);

    if (booking.status === 'cancelled') {
      return NextResponse.json({ data: { booking: { id: booking.id, status: 'cancelled' as const } } });
    }
    if (booking.status !== 'scheduled') {
      throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled.');
    }
    if (new Date(booking.starts_at) <= new Date()) {
      throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', 'Past bookings cannot be cancelled.');
    }

    await cancelCalcomBooking(booking.calcom_booking_uid, input.reason);
    const { data, error } = await service.rpc('cancel_booking_and_restore_credit', {
      p_booking_id: booking.id,
      p_expected_calcom_uid: booking.calcom_booking_uid,
    });

    if (error || data === null) {
      throw new ApiError(502, 'DATABASE_SYNC_FAILED', 'The provider cancelled the booking, but synchronization failed.');
    }
    return NextResponse.json({ data: { booking: { id: booking.id, status: 'cancelled' as const } } });
  } catch (error) {
    if (error instanceof CalcomApiError) {
      return apiErrorResponse(
        new ApiError(502, 'SCHEDULING_PROVIDER_ERROR', 'The scheduling provider could not cancel the booking.'),
      );
    }
    return apiErrorResponse(error);
  }
}
