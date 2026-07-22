import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CHAT_AUTHENTICATED_READ_LIMIT_PER_HOUR,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_PRE_AUTH_READ_LIMIT_PER_HOUR,
  CHAT_PRE_AUTH_SEND_LIMIT_PER_HOUR,
  CHAT_SEND_REQUEST_MAX_BYTES,
  type ChatIdentityContext,
} from '@/domain/chat';
import { getTutorByDbId } from '@/domain/catalog';
import { ApiError, apiErrorResponse, parseJsonRequest } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import { enforceRateLimit } from '@/lib/rate-limit/server';
import {
  CHAT_AUTHORIZED_BOOKING_LIFECYCLES,
  listBookingChatMessages,
  sendBookingChatMessage,
  SendbirdApiError,
} from '@/lib/sendbird/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const conversationSchema = z
  .object({
    identityContext: z.enum(['household', 'tutor']),
    bookingId: z.uuid(),
  })
  .strict();
const listSchema = conversationSchema.extend({
  beforeMessageId: z.string().regex(/^\d{1,20}$/).optional(),
});
const sendSchema = conversationSchema.extend({
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  clientMessageId: z.uuid(),
});

interface AuthorizedConversation {
  bookingId: string;
  side: ChatIdentityContext;
  parentNickname: string;
  tutorNickname: string;
  tutorName: string;
}

async function authorizeConversation(
  identityContext: ChatIdentityContext,
  bookingId: string,
): Promise<{ conversation: AuthorizedConversation; principalId: string }> {
  const principal = await requireActivePrincipal();
  const database = createSupabaseServiceClient();

  if (identityContext === 'tutor') {
    await requireStaffMfa(principal);
    if (!principal.roles.includes('tutor') || !principal.tutorId) {
      throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'An active tutor role is required.');
    }
    const { data: booking, error: bookingError } = await database
      .from('bookings')
      .select('id,user_id,tutor_id')
      .eq('id', bookingId)
      .eq('tutor_id', principal.tutorId)
      .in('lifecycle_status', [...CHAT_AUTHORIZED_BOOKING_LIFECYCLES])
      .maybeSingle();
    if (bookingError) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
    }
    if (!booking || booking.user_id === principal.user.id) {
      throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'An active tutoring relationship is required.');
    }
    const tutor = getTutorByDbId(booking.tutor_id);
    if (!tutor) {
      throw new ApiError(409, 'TUTOR_ACCOUNT_UNAVAILABLE', 'The assigned tutor is unavailable.');
    }
    return {
      principalId: principal.user.id,
      conversation: {
        bookingId: booking.id,
        side: 'tutor',
        parentNickname: 'MSM Haushalt',
        tutorNickname: principal.displayName || tutor.name,
        tutorName: tutor.name,
      },
    };
  }

  if (!principal.roles.includes('parent')) {
    throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'An active parent role is required.');
  }
  if (!principal.householdId || !principal.householdPermissions) {
    throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'An active household membership is required.');
  }
  let bookingQuery = database
    .from('bookings')
    .select('id,user_id,tutor_id')
    .eq('id', bookingId)
    .eq('household_id', principal.householdId)
    .in('lifecycle_status', [...CHAT_AUTHORIZED_BOOKING_LIFECYCLES]);
  if (!principal.householdPermissions.canViewAllBookings) {
    bookingQuery = bookingQuery.eq('user_id', principal.user.id);
  }
  const { data: booking, error: bookingError } = await bookingQuery.maybeSingle();
  if (bookingError) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
  }
  if (!booking) {
    throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'An active tutoring relationship is required.');
  }
  const tutor = getTutorByDbId(booking.tutor_id);
  if (!tutor) {
    throw new ApiError(409, 'TUTOR_ACCOUNT_UNAVAILABLE', 'The assigned tutor is unavailable.');
  }

  const { data: tutorRole, error: tutorRoleError } = await database
    .from('account_roles')
    .select('user_id')
    .eq('role', 'tutor')
    .eq('tutor_id', booking.tutor_id)
    .is('revoked_at', null)
    .maybeSingle();
  if (tutorRoleError) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
  }
  if (!tutorRole || tutorRole.user_id === principal.user.id) {
    throw new ApiError(409, 'TUTOR_ACCOUNT_UNAVAILABLE', 'This tutor does not have a chat account yet.');
  }
  const { data: tutorProfile, error: tutorProfileError } = await database
    .from('profiles')
    .select('display_name,deactivated_at')
    .eq('id', tutorRole.user_id)
    .maybeSingle();
  if (tutorProfileError) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat authorization is unavailable.');
  }
  if (!tutorProfile || tutorProfile.deactivated_at) {
    throw new ApiError(409, 'TUTOR_ACCOUNT_UNAVAILABLE', 'This tutor does not have an active chat account.');
  }

  return {
    principalId: principal.user.id,
    conversation: {
      bookingId: booking.id,
      side: 'household',
      parentNickname: 'MSM Haushalt',
      tutorNickname: tutorProfile.display_name || tutor.name,
      tutorName: tutor.name,
    },
  };
}

function chatProviderError(error: unknown) {
  if (error instanceof SendbirdApiError) {
    return apiErrorResponse(
      new ApiError(502, 'CHAT_PROVIDER_ERROR', 'Chat is temporarily unavailable.'),
    );
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      request,
      scope: 'chat_pre_auth_read',
      limit: CHAT_PRE_AUTH_READ_LIMIT_PER_HOUR,
      windowSeconds: 3600,
    });
    const url = new URL(request.url);
    const input = listSchema.parse({
      identityContext: url.searchParams.get('identityContext'),
      bookingId: url.searchParams.get('bookingId'),
      beforeMessageId: url.searchParams.get('beforeMessageId') || undefined,
    });
    const { conversation, principalId } = await authorizeConversation(
      input.identityContext,
      input.bookingId,
    );
    await enforceRateLimit({
      request,
      scope: 'chat_read',
      limit: CHAT_AUTHENTICATED_READ_LIMIT_PER_HOUR,
      windowSeconds: 3600,
      subject: principalId,
    });
    const result = await listBookingChatMessages({
      ...conversation,
      beforeMessageId: input.beforeMessageId,
    });
    return NextResponse.json(
      { data: result },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    return chatProviderError(error);
  }
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      request,
      scope: 'chat_pre_auth_send',
      limit: CHAT_PRE_AUTH_SEND_LIMIT_PER_HOUR,
      windowSeconds: 3600,
    });
    const input = sendSchema.parse(
      await parseJsonRequest(request, { maxBytes: CHAT_SEND_REQUEST_MAX_BYTES }),
    );
    const { conversation, principalId } = await authorizeConversation(
      input.identityContext,
      input.bookingId,
    );
    await enforceRateLimit({
      request,
      scope: 'chat_send',
      limit: 120,
      windowSeconds: 3600,
      subject: principalId,
    });
    const message = await sendBookingChatMessage({
      ...conversation,
      message: input.message,
      clientMessageId: input.clientMessageId,
    });
    return NextResponse.json(
      { data: { message } },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    return chatProviderError(error);
  }
}
