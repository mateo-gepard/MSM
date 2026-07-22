import { addYears, isAfter, isBefore } from 'date-fns';
import { NextResponse } from 'next/server';
import { createBookingSchema, type BookingResponse } from '@/domain/booking-schemas';
import {
  bookingConfirmationRpcSchema,
  bookingReservationRpcSchema,
} from '@/domain/backend-contracts';
import type { BookingListResponse } from '@/domain/dashboard-dtos';
import {
  getPackageById,
  getTutorBySlug,
  isTutorSlug,
} from '@/domain/catalog';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { CalcomApiError, createCalcomBooking } from '@/lib/calcom/server';
import { getBookingListForPrincipal } from '@/lib/dashboard/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';

function reservationFailure(error: { message: string; code?: string | null }): ApiError {
  const message = error.message;
  if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
    return new ApiError(
      409,
      'IDEMPOTENCY_KEY_REUSED',
      'This request key was already used for a different booking.',
    );
  }
  if (message.includes('TRIAL_NOT_ALLOWED')) {
    return new ApiError(403, 'TRIAL_NOT_ALLOWED', 'The trial lesson is available to new customers only.');
  }
  if (message.includes('PAYMENT_NOT_VERIFIED') || message.includes('PACKAGE_REQUIRED')) {
    return new ApiError(402, 'PAYMENT_REQUIRED', 'A verified package purchase is required.');
  }
  if (message.includes('NO_CREDITS')) {
    return new ApiError(409, 'NO_CREDITS', 'This package has no remaining lesson credits.');
  }
  if (
    error.code === '23P01' ||
    message.includes('bookings_tutor_time_no_overlap') ||
    message.includes('booking_slot_claims_no_overlap')
  ) {
    return new ApiError(409, 'SLOT_UNAVAILABLE', 'That time is no longer available.');
  }
  if (
    error.code === '23505' &&
    (message.includes('bookings_one_trial_per_household') ||
      message.includes('bookings_one_trial_per_learner'))
  ) {
    return new ApiError(403, 'TRIAL_NOT_ALLOWED', 'The trial lesson is available to new customers only.');
  }
  return new ApiError(503, 'DATABASE_UNAVAILABLE', 'The booking could not be saved.');
}

export async function GET(request: Request) {
  try {
    const principal = await requireActivePrincipal();
    await requireStaffMfa(principal);
    const tutorSlug = new URL(request.url).searchParams.get('tutorSlug');
    if (tutorSlug && !isTutorSlug(tutorSlug)) {
      throw new ApiError(400, 'INVALID_TUTOR', 'The tutor identifier is invalid.');
    }
    const tutorIdScope = tutorSlug && isTutorSlug(tutorSlug)
      ? getTutorBySlug(tutorSlug).dbId
      : undefined;
    const bookings = await getBookingListForPrincipal(
      principal,
      tutorIdScope,
    );

    const response: BookingListResponse = { data: { bookings } };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createBookingSchema.parse(await parseJsonRequest(request));
    const principal = await requireActivePrincipal(['parent']);
    await requireStaffMfa(principal);
    await enforceRateLimit({
      request,
      scope: 'booking_create',
      limit: 20,
      windowSeconds: 3600,
      subject: principal.user.id,
    });
    const user = principal.user;
    const tutor = getTutorBySlug(input.tutorSlug);
    const selectedPackage = getPackageById(input.packageId);
    const startsAt = new Date(input.startsAt);

    if (!user.email || user.email.toLowerCase() !== input.contact.email.toLowerCase()) {
      throw new ApiError(400, 'EMAIL_MISMATCH', 'Use the email address associated with your account.');
    }
    if (!tutor.subjectIds.includes(input.subjectId)) {
      throw new ApiError(400, 'SUBJECT_NOT_OFFERED', 'This tutor does not offer the selected subject.');
    }
    if (tutor.onlineOnly && input.location !== 'online') {
      throw new ApiError(400, 'LOCATION_NOT_OFFERED', 'This tutor offers online lessons only.');
    }
    if (isBefore(startsAt, new Date()) || isAfter(startsAt, addYears(new Date(), 1))) {
      throw new ApiError(400, 'INVALID_START_TIME', 'Choose a future time within the next year.');
    }

    if (!principal.householdId || !principal.householdPermissions?.canBook) {
      throw new ApiError(403, 'HOUSEHOLD_REQUIRED', 'A household is required before booking.');
    }

    const service = createSupabaseServiceClient();
    let learnerQuery = service
      .from('learners')
      .select('id')
      .eq('household_id', principal.householdId)
      .eq('is_active', true)
      .limit(2);
    if (input.learnerId) learnerQuery = learnerQuery.eq('id', input.learnerId);
    const { data: learners, error: learnerError } = await learnerQuery;
    if (learnerError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Learner data is unavailable.');
    if (!learners?.length || (!input.learnerId && learners.length !== 1)) {
      throw new ApiError(
        409,
        'LEARNER_REQUIRED',
        learners?.length ? 'Choose the learner for this lesson.' : 'Add a learner before booking a lesson.',
      );
    }
    const learnerId = input.learnerId ?? learners[0].id;

    const { data: rawReservation, error: reservationError } = await service.rpc(
      'reserve_booking_credit',
      {
        p_user_id: user.id,
        p_household_id: principal.householdId,
        p_learner_id: learnerId,
        p_tutor_id: tutor.dbId,
        p_package_id: selectedPackage.dbId,
        p_package_purchase_id: null,
        p_subject_id: input.subjectId,
        p_starts_at: startsAt.toISOString(),
        p_duration_minutes: 60,
        p_time_zone: input.timeZone,
        p_location: input.location,
        p_location_venue: input.locationVenue ?? null,
        p_contact_name: input.contact.name,
        p_contact_email: user.email,
        p_contact_phone: input.contact.phone || null,
        p_message: input.contact.message || null,
        p_idempotency_key: input.idempotencyKey,
      },
    );
    if (reservationError) throw reservationFailure(reservationError);
    const reservation = bookingReservationRpcSchema.parse(rawReservation);

    const bookingResponse = (
      status: BookingResponse['data']['booking']['status'],
      responseStatus: number,
    ) => {
      const response: BookingResponse = {
        data: {
          booking: {
            id: reservation.booking_id,
            tutorSlug: input.tutorSlug,
            subjectId: input.subjectId,
            packageId: input.packageId,
            startsAt: reservation.starts_at,
            status,
          },
        },
      };
      return NextResponse.json(response, { status: responseStatus });
    };
    const pendingResponse = () => bookingResponse('provider_pending', 202);

    // Never repeat an external create after an idempotent replay: a previous
    // request may have succeeded at Cal.com and timed out before confirmation.
    if (reservation.replayed) {
      if (reservation.lifecycle_status === 'failed') {
        throw new ApiError(409, 'BOOKING_NOT_CREATED', 'This booking request did not complete.');
      }
      const settled = ['scheduled', 'pending_confirmation', 'completed', 'cancelled'].includes(
        reservation.lifecycle_status,
      );
      if (settled) return bookingResponse(reservation.lifecycle_status, 200);
      if (reservation.operation_status !== 'queued') return pendingResponse();
    }

    const { data: claimed, error: claimError } = await service.rpc('claim_booking_operation', {
      p_booking_id: reservation.booking_id,
      p_operation_id: reservation.operation_id,
    });
    if (claimError) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The booking request could not be started.');
    }
    if (!claimed) return pendingResponse();

    const markAmbiguous = async (code: string) => {
      await service.rpc('fail_booking_operation', {
        p_operation_id: reservation.operation_id,
        p_is_ambiguous: true,
        p_error_code: code,
        p_error_detail: null,
      });
    };

    let calcom;
    try {
      calcom = await createCalcomBooking(
        { ...input, contact: { ...input.contact, email: user.email } },
        reservation.booking_id,
      );
    } catch (providerError) {
      const deterministic =
        providerError instanceof CalcomApiError &&
        [400, 401, 403, 404, 409, 422].includes(providerError.status);
      if (!deterministic) {
        await markAmbiguous('PROVIDER_CREATE_AMBIGUOUS');
        return pendingResponse();
      }

      const { error: releaseError } = await service.rpc('release_booking_credit', {
        p_booking_id: reservation.booking_id,
        p_operation_id: reservation.operation_id,
        p_error_code: 'SLOT_UNAVAILABLE',
        p_error_detail: null,
      });
      if (releaseError) {
        await markAmbiguous('CREDIT_RELEASE_REQUIRES_RECONCILIATION');
        return pendingResponse();
      }
      const slotUnavailable =
        providerError instanceof CalcomApiError &&
        (providerError.status === 400 || providerError.status === 409);
      throw new ApiError(
        slotUnavailable ? 409 : 502,
        slotUnavailable ? 'SLOT_UNAVAILABLE' : 'SCHEDULING_PROVIDER_ERROR',
        slotUnavailable
          ? 'That time is no longer available.'
          : 'The scheduling provider rejected the booking request.',
      );
    }

    const { data: rawConfirmation, error: confirmationError } = await service.rpc(
      'confirm_booking_credit',
      {
        p_booking_id: reservation.booking_id,
        p_operation_id: reservation.operation_id,
        p_provider_booking_id: calcom.uid,
        p_provider_event_type_id: calcom.eventTypeId,
        p_provider_starts_at: new Date(calcom.startsAt).toISOString(),
        p_provider_ends_at: new Date(calcom.endsAt).toISOString(),
        p_provider_status: calcom.providerStatus,
        p_meeting_url: calcom.meetingUrl,
        p_provider_response: {
          uid: calcom.uid,
          eventTypeId: calcom.eventTypeId,
          startsAt: calcom.startsAt,
          endsAt: calcom.endsAt,
          durationMinutes: calcom.durationMinutes,
          status: calcom.providerStatus,
        },
      },
    );
    if (confirmationError) {
      await markAmbiguous('PROVIDER_CREATED_CONFIRMATION_AMBIGUOUS');
      return pendingResponse();
    }
    const confirmation = bookingConfirmationRpcSchema.parse(rawConfirmation);

    const response: BookingResponse = {
      data: {
        booking: {
          id: reservation.booking_id,
          tutorSlug: input.tutorSlug,
          subjectId: input.subjectId,
          packageId: input.packageId,
          startsAt: new Date(calcom.startsAt).toISOString(),
          status: confirmation.lifecycle_status,
        },
      },
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof CalcomApiError) {
      const unavailable = error.status === 409 || error.status === 400;
      return apiErrorResponse(
        new ApiError(
          unavailable ? 409 : 502,
          unavailable ? 'SLOT_UNAVAILABLE' : 'SCHEDULING_PROVIDER_ERROR',
          unavailable ? 'That time is no longer available.' : 'The scheduling provider is unavailable.',
        ),
      );
    }
    return apiErrorResponse(error);
  }
}
