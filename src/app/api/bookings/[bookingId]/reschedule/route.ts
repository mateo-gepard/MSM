import { addYears, isAfter, isBefore } from 'date-fns';
import { NextResponse } from 'next/server';
import { bookingOperationRpcSchema } from '@/domain/backend-contracts';
import { bookingIdSchema, rescheduleBookingSchema } from '@/domain/booking-schemas';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireBookingAccess } from '@/lib/auth/server';
import { isDeterministicRescheduleFailure } from '@/lib/calcom/mutation-failures';
import { CalcomApiError, rescheduleCalcomBooking } from '@/lib/calcom/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';

function rescheduleOperationFailure(error: { message: string; code?: string | null }): ApiError {
  if (error.message.includes('IDEMPOTENCY_KEY_REUSED')) {
    return new ApiError(
      409,
      'IDEMPOTENCY_KEY_REUSED',
      'This request key was already used for a different booking change.',
    );
  }
  if (
    error.code === '23P01' ||
    error.message.includes('booking_slot_claims_no_overlap') ||
    error.message.includes('bookings_tutor_time_no_overlap')
  ) {
    return new ApiError(409, 'SLOT_UNAVAILABLE', 'That time is no longer available.');
  }
  if (
    error.message.includes('BOOKING_OPERATION_IN_PROGRESS') ||
    error.message.includes('BOOKING_NOT_MUTABLE') ||
    error.message.includes('INVALID_START_TIME') ||
    error.message.includes('INVALID_TIME_ZONE')
  ) {
    return new ApiError(409, 'BOOKING_NOT_RESCHEDULABLE', 'This booking cannot be rescheduled.');
  }
  return new ApiError(503, 'DATABASE_UNAVAILABLE', 'The reschedule request could not be saved.');
}

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

    const principal = await requireActivePrincipal();
    await enforceRateLimit({
      request,
      scope: 'booking_mutation',
      limit: 30,
      windowSeconds: 3600,
      subject: principal.user.id,
    });
    const { booking, service } = await requireBookingAccess(bookingId, principal);
    const lifecycleStatus = booking.lifecycle_status ?? booking.status;
    if (
      lifecycleStatus !== 'scheduled' &&
      lifecycleStatus !== 'pending_confirmation' &&
      lifecycleStatus !== 'reschedule_pending'
    ) {
      throw new ApiError(409, 'BOOKING_NOT_RESCHEDULABLE', 'This booking cannot be rescheduled.');
    }

    const { data: rawOperation, error: operationError } = await service.rpc('begin_booking_operation', {
      p_booking_id: booking.id,
      p_user_id: principal.user.id,
      p_operation_type: 'reschedule',
      p_idempotency_key: input.idempotencyKey,
      p_requested_starts_at: startsAt.toISOString(),
      p_requested_time_zone: input.timeZone,
      p_reason: input.reason ?? null,
    });
    if (operationError) throw rescheduleOperationFailure(operationError);
    const operation = bookingOperationRpcSchema.parse(rawOperation);

    const pendingResponse = () => NextResponse.json(
      { data: { booking: { id: booking.id, startsAt: startsAt.toISOString(), status: 'reschedule_pending' as const } } },
      { status: 202 },
    );
    if (operation.replayed) {
      if (operation.operation_status === 'succeeded') {
        return NextResponse.json({
          data: {
            booking: {
              id: booking.id,
              startsAt: startsAt.toISOString(),
              status: 'scheduled' as const,
            },
          },
        });
      }
      if (operation.operation_status === 'failed') {
        throw new ApiError(409, 'BOOKING_NOT_RESCHEDULABLE', 'The reschedule request was not accepted.');
      }
      if (operation.operation_status !== 'queued') return pendingResponse();
    }
    if (!operation.provider_booking_id) return pendingResponse();

    const { data: claimed, error: claimError } = await service.rpc('claim_booking_operation', {
      p_booking_id: booking.id,
      p_operation_id: operation.operation_id,
    });
    if (claimError) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The reschedule request could not be started.');
    }
    if (!claimed) return pendingResponse();

    let calcom;
    try {
      calcom = await rescheduleCalcomBooking(
        operation.provider_booking_id,
        input.startsAt,
        input.reason,
      );
    } catch (providerError) {
      // A stale source UID or provider conflict can mean that an external
      // reschedule won the race. Keep those outcomes reconcilable instead of
      // restoring local state before the provider lineage is observed.
      const deterministic = isDeterministicRescheduleFailure(providerError);
      const { error: cleanupError } = await service.rpc('fail_booking_operation', {
        p_operation_id: operation.operation_id,
        p_is_ambiguous: !deterministic,
        p_error_code: deterministic ? 'SCHEDULING_PROVIDER_ERROR' : 'PROVIDER_AMBIGUOUS',
        p_error_detail: null,
      });
      if (!deterministic || cleanupError) return pendingResponse();
      throw new ApiError(
        502,
        'SCHEDULING_PROVIDER_ERROR',
        'The scheduling provider rejected the reschedule request.',
      );
    }

    const { error: completionError } = await service.rpc('complete_booking_operation', {
      p_operation_id: operation.operation_id,
      p_provider_booking_id: calcom.uid,
      p_provider_starts_at: new Date(calcom.startsAt).toISOString(),
      p_provider_ends_at: new Date(calcom.endsAt).toISOString(),
      p_provider_status: calcom.providerStatus,
      p_meeting_url: calcom.meetingUrl,
      p_provider_response: {
        uid: calcom.uid,
        startsAt: calcom.startsAt,
        endsAt: calcom.endsAt,
        status: calcom.providerStatus,
      },
    });

    if (completionError) return pendingResponse();
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
