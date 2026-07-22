import {
  getPackageByDbId,
  getSubjectById,
  getTutorByDbId,
  isSubjectId,
} from '@/domain/catalog';
import type {
  BookingListItem,
  EntitlementListItem,
} from '@/domain/dashboard-dtos';
import type { LearnerListItem } from '@/domain/household-schemas';
import type { ActivePrincipal } from '@/lib/auth/server';
import { ApiError } from '@/lib/api/errors';
import { assertServerOnly } from '@/lib/security/server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

assertServerOnly('Dashboard data access');

function safeMeetingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function getBookingListForPrincipal(
  principal: ActivePrincipal,
  tutorIdScope?: string,
): Promise<BookingListItem[]> {
  const service = createSupabaseServiceClient();
  let query = service
    .from('bookings')
    .select(
      'id,learner_id,tutor_id,package_id,subject_id,starts_at,duration_minutes,time_zone,location,location_venue,meeting_url,lifecycle_status,sync_status,contact_name,contact_email,contact_phone,message',
    )
    .order('starts_at', { ascending: true });

  if (tutorIdScope) {
    const canUseTutorScope =
      principal.roles.includes('admin') ||
      (principal.roles.includes('tutor') && principal.tutorId === tutorIdScope);
    if (!canUseTutorScope) {
      throw new ApiError(403, 'TUTOR_SCOPE_FORBIDDEN', 'This tutor scope is not available.');
    }
    query = query.eq('tutor_id', tutorIdScope);
  } else if (principal.roles.includes('parent')) {
    if (!principal.householdId || !principal.householdPermissions) {
      throw new ApiError(403, 'HOUSEHOLD_REQUIRED', 'An active household membership is required.');
    }
    query = query.eq('household_id', principal.householdId);
    if (!principal.householdPermissions.canViewAllBookings) {
      query = query.eq('user_id', principal.user.id);
    }
  } else if (principal.roles.includes('tutor') && principal.tutorId) {
    query = query.eq('tutor_id', principal.tutorId);
  } else {
    throw new ApiError(400, 'TUTOR_SCOPE_REQUIRED', 'Choose a tutor before loading staff bookings.');
  }

  const { data: rows, error } = await query;
  if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking data is temporarily unavailable.');

  const learnerIds = [...new Set((rows ?? []).map((row) => row.learner_id))];
  const { data: learners, error: learnersError } = learnerIds.length
    ? await service.from('learners').select('id,display_name').in('id', learnerIds)
    : { data: [], error: null };
  if (learnersError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Learner data is temporarily unavailable.');
  const learnerById = new Map((learners ?? []).map((learner) => [learner.id, learner.display_name]));

  return (rows ?? []).flatMap<BookingListItem>((row) => {
    const tutor = getTutorByDbId(row.tutor_id);
    const selectedPackage = getPackageByDbId(row.package_id);
    const learnerName = learnerById.get(row.learner_id);
    if (!tutor || !selectedPackage || !learnerName || !isSubjectId(row.subject_id)) return [];
    const subject = getSubjectById(row.subject_id);
    return [{
      id: row.id,
      learner: { id: row.learner_id, displayName: learnerName },
      tutor: { slug: tutor.slug, name: tutor.name },
      subject: { id: subject.id, name: subject.name },
      package: { id: selectedPackage.id, name: selectedPackage.name },
      startsAt: row.starts_at,
      durationMinutes: row.duration_minutes,
      timeZone: row.time_zone,
      location: row.location,
      locationVenue: row.location_venue,
      meetingUrl: safeMeetingUrl(row.meeting_url),
      status: row.lifecycle_status,
      syncStatus: row.sync_status,
      contact: {
        name: row.contact_name,
        email: row.contact_email,
        phone: row.contact_phone,
        message: row.message,
      },
    }];
  });
}

export async function getEntitlementsForPrincipal(
  principal: ActivePrincipal,
): Promise<EntitlementListItem[]> {
  if (!principal.householdId || !principal.householdPermissions?.canManageBilling) {
    return [];
  }
  const service = createSupabaseServiceClient();
  let query = service
    .from('package_purchases')
    .select('id,package_id,total_sessions,used_sessions,remaining_sessions,status,payment_status,created_at')
    .eq('payment_status', 'verified')
    .order('created_at', { ascending: false });
  query = query.eq('household_id', principal.householdId);
  const { data: rows, error } = await query;
  if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Package data is temporarily unavailable.');

  return (rows ?? []).flatMap<EntitlementListItem>((row) => {
    const item = getPackageByDbId(row.package_id);
    if (!item || row.payment_status !== 'verified') return [];
    return [{
      id: row.id,
      package: { id: item.id, name: item.name, sessions: item.sessions },
      totalSessions: row.total_sessions,
      usedSessions: row.used_sessions,
      remainingSessions: row.remaining_sessions,
      status: row.status,
      paymentStatus: 'verified',
      createdAt: row.created_at,
    }];
  });
}

export async function getLearnersForPrincipal(principal: ActivePrincipal): Promise<LearnerListItem[]> {
  if (!principal.householdId) return [];
  const { data: rows, error } = await createSupabaseServiceClient()
    .from('learners')
    .select('id,display_name,birth_date,is_active,is_legacy_placeholder')
    .eq('household_id', principal.householdId)
    .order('created_at', { ascending: true });
  if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Learner data is temporarily unavailable.');

  return (rows ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    birthDate: principal.householdPermissions?.canManageLearners ? row.birth_date : null,
    isActive: row.is_active,
    isLegacyPlaceholder: row.is_legacy_placeholder,
  }));
}
