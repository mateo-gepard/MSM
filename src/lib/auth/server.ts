import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database';
import { ApiError } from '@/lib/api/errors';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export async function requireAuthenticatedUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return data.user;
}

export interface ActivePrincipal {
  user: User;
  role: UserRole;
  roles: readonly UserRole[];
  tutorId: string | null;
  displayName: string | null;
  householdId: string | null;
  householdPermissions: {
    canManageLearners: boolean;
    canBook: boolean;
    canManageBilling: boolean;
    canViewAllBookings: boolean;
  } | null;
}

/**
 * Resolves authorization from server-owned profile data for every protected
 * operation. A valid Supabase session without a provisioned profile is not an
 * active application principal.
 */
export async function requireActivePrincipal(
  allowedRoles?: readonly UserRole[],
): Promise<ActivePrincipal> {
  const user = await requireAuthenticatedUser();
  const service = createSupabaseServiceClient();
  const { data: profile, error } = await service
    .from('profiles')
    .select('role,tutor_id,display_name,primary_household_id,deactivated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Authorization could not be verified.');
  if (!profile || profile.deactivated_at) {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account is not active.');
  }

  const { data: roleRows, error: rolesError } = await service
    .from('account_roles')
    .select('role,tutor_id')
    .eq('user_id', user.id)
    .is('revoked_at', null);
  if (rolesError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Account roles could not be verified.');
  const roles = [...new Set((roleRows ?? []).map((row) => row.role))];
  if (!roles.length) throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account is not active.');
  if (allowedRoles && !allowedRoles.some((role) => roles.includes(role))) {
    throw new ApiError(403, 'ROLE_NOT_ALLOWED', 'This account cannot perform that action.');
  }
  const role: UserRole = roles.includes('admin')
    ? 'admin'
    : roles.includes('tutor')
      ? 'tutor'
      : 'parent';
  const tutorId = roleRows?.find((row) => row.role === 'tutor')?.tutor_id ?? profile.tutor_id;

  let householdPermissions: ActivePrincipal['householdPermissions'] = null;
  if (profile.primary_household_id) {
    const { data: membership, error: membershipError } = await service
      .from('household_memberships')
      .select('can_manage_learners,can_book,can_manage_billing,can_view_all_bookings')
      .eq('household_id', profile.primary_household_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lte('active_from', new Date().toISOString())
      .maybeSingle();
    if (membershipError) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Household access could not be verified.');
    }
    if (membership) {
      householdPermissions = {
        canManageLearners: membership.can_manage_learners,
        canBook: membership.can_book,
        canManageBilling: membership.can_manage_billing,
        canViewAllBookings: membership.can_view_all_bookings,
      };
    }
  }

  return {
    user,
    role,
    roles,
    tutorId,
    displayName: profile.display_name,
    householdId: householdPermissions ? profile.primary_household_id : null,
    householdPermissions,
  };
}

export async function requireStaffMfa(principal: ActivePrincipal): Promise<void> {
  const isStaff = principal.roles.some((role) => role === 'tutor' || role === 'admin');
  const explicitlyDisabled = process.env.REQUIRE_STAFF_MFA?.trim().toLowerCase() === 'false';
  const mfaRequired = process.env.NODE_ENV === 'production' || !explicitlyDisabled;
  if (!isStaff || !mfaRequired) return;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new ApiError(503, 'MFA_UNAVAILABLE', 'Multi-factor authentication could not be verified.');
  if (data.currentLevel !== 'aal2') {
    throw new ApiError(
      403,
      data.nextLevel === 'aal2' ? 'MFA_REQUIRED' : 'MFA_ENROLLMENT_REQUIRED',
      'Staff accounts require multi-factor authentication.',
    );
  }
}

export async function requireBookingAccess(bookingId: string, principal: ActivePrincipal) {
  await requireStaffMfa(principal);
  const service = createSupabaseServiceClient();
  const { data: booking, error } = await service
    .from('bookings')
    .select('id,user_id,household_id,tutor_id,calcom_booking_uid,provider_booking_id,starts_at,duration_minutes,status,lifecycle_status')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking data is temporarily unavailable.');
  if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');

  const isCurrentHousehold =
    Boolean(booking.household_id) &&
    booking.household_id === principal.householdId;
  const isHouseholdBooker =
    isCurrentHousehold &&
    Boolean(principal.householdPermissions?.canBook) &&
    (booking.user_id === principal.user.id ||
      Boolean(principal.householdPermissions?.canViewAllBookings));
  const isAssignedTutor = principal.roles.includes('tutor') && principal.tutorId === booking.tutor_id;
  const isAdmin = principal.roles.includes('admin');

  if (!isHouseholdBooker && !isAssignedTutor && !isAdmin) {
    // Do not reveal whether an inaccessible booking exists.
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  return { booking, service };
}
