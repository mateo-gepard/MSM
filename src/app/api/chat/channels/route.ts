import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TUTOR_SLUGS, getTutorBySlug } from '@/domain/catalog';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireAuthenticatedUser } from '@/lib/auth/server';
import {
  createDistinctParentTutorChannel,
  ensureSendbirdUser,
  SendbirdApiError,
  toSendbirdUserId,
} from '@/lib/sendbird/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const requestSchema = z
  .object({ tutorSlug: z.enum(TUTOR_SLUGS), bookingId: z.uuid().optional() })
  .strict();

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await parseJsonRequest(request));
    const user = await requireAuthenticatedUser();
    const tutor = getTutorBySlug(input.tutorSlug);
    const database = createSupabaseServiceClient();

    const { data: currentProfile, error: currentProfileError } = await database
      .from('profiles')
      .select('role,tutor_id,display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (currentProfileError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');

    let parentAuthId: string;
    let tutorAuthId: string;
    let parentNickname: string;
    let tutorNickname: string;

    if (currentProfile?.role === 'parent') {
      const { data: booking, error: bookingError } = await database
        .from('bookings')
        .select('id')
        .eq('user_id', user.id)
        .eq('tutor_id', tutor.dbId)
        .limit(1)
        .maybeSingle();
      if (bookingError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
      if (!booking) throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'A booking with this tutor is required.');

      const { data: tutorProfile, error: tutorProfileError } = await database
        .from('profiles')
        .select('id,display_name')
        .eq('role', 'tutor')
        .eq('tutor_id', tutor.dbId)
        .maybeSingle();
      if (tutorProfileError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
      if (!tutorProfile) throw new ApiError(409, 'TUTOR_ACCOUNT_UNAVAILABLE', 'This tutor does not have a chat account yet.');

      parentAuthId = user.id;
      tutorAuthId = tutorProfile.id;
      parentNickname = currentProfile.display_name || 'MSM Parent';
      tutorNickname = tutorProfile.display_name || tutor.name;
    } else if (currentProfile?.role === 'tutor' && currentProfile.tutor_id === tutor.dbId) {
      if (!input.bookingId) {
        throw new ApiError(400, 'BOOKING_ID_REQUIRED', 'Open chat from an assigned booking.');
      }
      const { data: booking, error: bookingError } = await database
        .from('bookings')
        .select('user_id')
        .eq('id', input.bookingId)
        .eq('tutor_id', tutor.dbId)
        .maybeSingle();
      if (bookingError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
      if (!booking) throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'The booking is not assigned to this tutor.');

      const { data: parentProfile, error: parentProfileError } = await database
        .from('profiles')
        .select('display_name')
        .eq('id', booking.user_id)
        .maybeSingle();
      if (parentProfileError) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');

      parentAuthId = booking.user_id;
      tutorAuthId = user.id;
      parentNickname = parentProfile?.display_name || 'MSM Parent';
      tutorNickname = currentProfile.display_name || tutor.name;
    } else {
      throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'You cannot create this chat channel.');
    }

    const parentUserId = toSendbirdUserId(parentAuthId);
    const tutorUserId = toSendbirdUserId(tutorAuthId);
    await Promise.all([
      ensureSendbirdUser(parentUserId, parentNickname),
      ensureSendbirdUser(tutorUserId, tutorNickname),
    ]);
    const channelUrl = await createDistinctParentTutorChannel({
      parentUserId,
      tutorUserId,
      tutorName: tutor.name,
      tutorSlug: tutor.slug,
    });
    return NextResponse.json({ data: { channelUrl } });
  } catch (error) {
    if (error instanceof SendbirdApiError) {
      return apiErrorResponse(new ApiError(502, 'CHAT_PROVIDER_ERROR', 'Chat is temporarily unavailable.'));
    }
    return apiErrorResponse(error);
  }
}
