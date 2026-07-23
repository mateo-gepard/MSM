import { NextResponse } from 'next/server';
import { bookingOperationRpcSchema } from '@/domain/backend-contracts';
import { bookingIdSchema, cancelBookingSchema } from '@/domain/booking-schemas';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireBookingAccess } from '@/lib/auth/server';
import { CalcomApiError, cancelCalcomBooking } from '@/lib/calcom/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  try {
    const bookingId = bookingIdSchema.parse((await context.params).bookingId);
    const input = cancelBookingSchema.parse(await parseJsonRequest(request));
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
    if (lifecycleStatus === 'cancelled') {
      return NextResponse.json({ data: { booking: { id: booking.id, status: 'cancelled' as const } } });
    }
    if (
      lifecycleStatus !== 'scheduled' &&
      lifecycleStatus !== 'pending_confirmation' &&
      lifecycleStatus !== 'cancellation_pending'
    ) {
      throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled.');
    }
    if (new Date(booking.starts_at) <= new Date()) {
      throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', 'Past bookings cannot be cancelled.');
    }

    const { data: rawOperation, error: operationError } = await service.rpc('begin_booking_operation', {
      p_booking_id: booking.id,
      p_user_id: principal.user.id,
      p_operation_type: 'cancel',
      p_idempotency_key: input.idempotencyKey,
      p_requested_starts_at: null,
      p_requested_time_zone: null,
      p_reason: input.reason ?? null,
    });
    if (operationError) throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled.');
    const operation = bookingOperationRpcSchema.parse(rawOperation);

    const pendingResponse = () => NextResponse.json(
      { data: { booking: { id: booking.id, status: 'cancellation_pending' as const } } },
      { status: 202 },
    );
    if (operation.replayed) {
      if (operation.operation_status === 'succeeded') {
        return NextResponse.json({ data: { booking: { id: booking.id, status: 'cancelled' as const } } });
      }
      if (operation.operation_status === 'failed') {
        throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', 'The cancellation was not accepted.');
      }
      if (operation.operation_status !== 'queued') return pendingResponse();
    }
    if (!operation.provider_booking_id) return pendingResponse();

    const { data: claimed, error: claimError } = await service.rpc('claim_booking_operation', {
      p_booking_id: booking.id,
      p_operation_id: operation.operation_id,
    });
    if (claimError) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The cancellation could not be started.');
    }
    if (!claimed) return pendingResponse();

    let cancellation;
    try {
      cancellation = await cancelCalcomBooking(operation.provider_booking_id, input.reason);
    } catch (providerError) {
      // 400/404/409 can describe a source UID retired by a concurrent provider
      // reschedule. Only a later, complete lineage lookup may prove that the
      // logical lesson is actually absent; until then the cancel stays pending.
      const deterministic =
        providerError instanceof CalcomApiError &&
        [401, 403, 422].includes(providerError.status);
      const { error: cleanupError } = await service.rpc('fail_booking_operation', {
        p_operation_id: operation.operation_id,
        p_is_ambiguous: !deterministic,
        p_error_code: deterministic ? 'PROVIDER_REJECTED' : 'PROVIDER_AMBIGUOUS',
        p_error_detail: null,
      });
      if (!deterministic || cleanupError) return pendingResponse();
      throw new ApiError(
        502,
        'BOOKING_NOT_CANCELLABLE',
        'The scheduling provider rejected the cancellation.',
      );
    }

    const cancellationStatus = cancellation.status?.trim().toLowerCase();
    if (
      cancellation.uid !== operation.provider_booking_id ||
      cancellation.rescheduledToUid !== null ||
      !['cancelled', 'canceled', 'rejected'].includes(cancellationStatus ?? '')
    ) {
      const { error: ambiguityError } = await service.rpc('fail_booking_operation', {
        p_operation_id: operation.operation_id,
        p_is_ambiguous: true,
        p_error_code: 'PROVIDER_CANCEL_RESULT_AMBIGUOUS',
        p_error_detail: null,
      });
      if (ambiguityError) {
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The cancellation is awaiting confirmation.');
      }
      return pendingResponse();
    }

    const { error: completionError } = await service.rpc('complete_booking_operation', {
      p_operation_id: operation.operation_id,
      p_provider_booking_id: operation.provider_booking_id,
      p_provider_starts_at: null,
      p_provider_ends_at: null,
      p_provider_status: cancellation.status,
      p_provider_response: {
        uid: cancellation.uid,
        status: cancellation.status,
        rescheduledFromUid: cancellation.rescheduledFromUid,
        rescheduledToUid: cancellation.rescheduledToUid,
      },
    });
    if (completionError) return pendingResponse();
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
