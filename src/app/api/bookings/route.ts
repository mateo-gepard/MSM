import { addYears, isAfter, isBefore } from 'date-fns';
import { NextResponse } from 'next/server';
import { createBookingSchema, type BookingResponse } from '@/domain/booking-schemas';
import type { BookingListItem, BookingListResponse } from '@/domain/dashboard-dtos';
import {
  getPackageByDbId,
  getPackageById,
  getSubjectById,
  getTutorByDbId,
  getTutorBySlug,
  isSubjectId,
} from '@/domain/catalog';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireAuthenticatedUser } from '@/lib/auth/server';
import { CalcomApiError, cancelCalcomBooking, createCalcomBooking } from '@/lib/calcom/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

function entitlementError(message: string): ApiError {
  if (message.includes('TRIAL_NOT_ALLOWED')) {
    return new ApiError(403, 'TRIAL_NOT_ALLOWED', 'The trial lesson is available to new customers only.');
  }
  if (message.includes('PAYMENT_NOT_VERIFIED') || message.includes('PACKAGE_REQUIRED')) {
    return new ApiError(402, 'PAYMENT_REQUIRED', 'A verified package purchase is required.');
  }
  if (message.includes('NO_CREDITS')) {
    return new ApiError(409, 'NO_CREDITS', 'This package has no remaining lesson credits.');
  }
  return new ApiError(503, 'DATABASE_UNAVAILABLE', 'The booking could not be saved.');
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const service = createSupabaseServiceClient();
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('role,tutor_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking data is temporarily unavailable.');

    let query = service
      .from('bookings')
      .select(
        'id,tutor_id,package_id,subject_id,starts_at,duration_minutes,time_zone,location,location_venue,status,contact_name,contact_email,contact_phone,message',
      )
      .order('starts_at', { ascending: true });

    if (profile?.role === 'tutor' && profile.tutor_id) {
      query = query.eq('tutor_id', profile.tutor_id);
    } else if (profile?.role !== 'admin') {
      // Parents and pre-migration users only receive their own records.
      query = query.eq('user_id', user.id);
    }

    const { data: rows, error } = await query;
    if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking data is temporarily unavailable.');

    const bookings = (rows ?? []).flatMap<BookingListItem>((row) => {
      const tutor = getTutorByDbId(row.tutor_id);
      const selectedPackage = getPackageByDbId(row.package_id);
      if (!tutor || !selectedPackage || !isSubjectId(row.subject_id)) return [];
      const subject = getSubjectById(row.subject_id);
      return [{
        id: row.id,
        tutor: { slug: tutor.slug, name: tutor.name },
        subject: { id: subject.id, name: subject.name },
        package: { id: selectedPackage.id, name: selectedPackage.name },
        startsAt: row.starts_at,
        durationMinutes: row.duration_minutes,
        timeZone: row.time_zone,
        location: row.location,
        locationVenue: row.location_venue,
        status: row.status,
        contact: {
          name: row.contact_name,
          email: row.contact_email,
          phone: row.contact_phone,
          message: row.message,
        },
      }];
    });

    const response: BookingListResponse = { data: { bookings } };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createBookingSchema.parse(await parseJsonRequest(request));
    const user = await requireAuthenticatedUser();
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

    // Ensure persistence is configured before creating an external booking.
    const service = createSupabaseServiceClient();
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking authorization is unavailable.');
    if (profile?.role !== 'parent') {
      throw new ApiError(403, 'BOOKING_NOT_ALLOWED', 'Only parent accounts can create bookings.');
    }

    if (input.packageId === 'trial') {
      const { count, error: historyError } = await service
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (historyError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking eligibility is unavailable.');
      if ((count ?? 0) > 0) throw entitlementError('TRIAL_NOT_ALLOWED');
    } else {
      if (!input.packagePurchaseId) throw entitlementError('PACKAGE_REQUIRED');
      const { data: entitlement, error: entitlementQueryError } = await service
        .from('package_purchases')
        .select('id')
        .eq('id', input.packagePurchaseId)
        .eq('user_id', user.id)
        .eq('package_id', selectedPackage.dbId)
        .eq('payment_status', 'verified')
        .eq('status', 'active')
        .gt('remaining_sessions', 0)
        .maybeSingle();
      if (entitlementQueryError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Package eligibility is unavailable.');
      if (!entitlement) throw entitlementError('PAYMENT_NOT_VERIFIED');
    }

    const calcom = await createCalcomBooking({
      ...input,
      contact: { ...input.contact, email: user.email },
    });

    const { data: bookingId, error: persistenceError } = await service.rpc(
      'finalize_booking_with_credit',
      {
        p_user_id: user.id,
        p_tutor_id: tutor.dbId,
        p_package_id: selectedPackage.dbId,
        p_package_purchase_id: input.packagePurchaseId ?? null,
        p_subject_id: input.subjectId,
        p_starts_at: new Date(calcom.startsAt).toISOString(),
        p_time_zone: input.timeZone,
        p_location: input.location,
        p_location_venue: input.locationVenue ?? null,
        p_contact_name: input.contact.name,
        p_contact_email: user.email,
        p_contact_phone: input.contact.phone || null,
        p_message: input.contact.message || null,
        p_calcom_booking_uid: calcom.uid,
        p_calcom_event_type_id: calcom.eventTypeId,
      },
    );

    if (persistenceError || !bookingId) {
      try {
        await cancelCalcomBooking(calcom.uid, 'Application persistence failed');
      } catch (compensationError) {
        console.error('[bookings.create] compensation_failed', {
          kind: compensationError instanceof CalcomApiError ? 'calcom' : 'unknown',
        });
      }
      throw entitlementError(persistenceError?.message ?? 'DATABASE_ERROR');
    }

    const response: BookingResponse = {
      data: {
        booking: {
          id: bookingId,
          tutorSlug: input.tutorSlug,
          subjectId: input.subjectId,
          packageId: input.packageId,
          startsAt: new Date(calcom.startsAt).toISOString(),
          status: 'scheduled',
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
