import type { User } from '@supabase/supabase-js';
import { ApiError } from '@/lib/api/errors';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export async function requireAuthenticatedUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return data.user;
}

export async function requireBookingAccess(bookingId: string, user: User) {
  const service = createSupabaseServiceClient();
  const { data: booking, error } = await service
    .from('bookings')
    .select('id,user_id,tutor_id,calcom_booking_uid,starts_at,status')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Booking data is temporarily unavailable.');
  if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');

  if (booking.user_id === user.id) return { booking, service };

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('role,tutor_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Authorization could not be verified.');
  const isAssignedTutor = profile?.role === 'tutor' && profile.tutor_id === booking.tutor_id;
  const isAdmin = profile?.role === 'admin';

  if (!isAssignedTutor && !isAdmin) {
    // Do not reveal whether an inaccessible booking exists.
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  return { booking, service };
}
