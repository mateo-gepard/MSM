import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/lib/api/errors';
import { requireAuthenticatedUser } from '@/lib/auth/server';
import {
  ensureSendbirdUser,
  issueSendbirdSessionToken,
  SendbirdApiError,
  toSendbirdUserId,
} from '@/lib/sendbird/server';

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    const userId = toSendbirdUserId(user.id);
    const nickname =
      (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) || 'MSM User';

    await ensureSendbirdUser(userId, nickname);
    const session = await issueSendbirdSessionToken(userId);
    return NextResponse.json(
      { data: { appId: session.appId, userId, token: session.token, expiresAt: session.expiresAt } },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof SendbirdApiError) {
      return apiErrorResponse(new ApiError(502, 'CHAT_PROVIDER_ERROR', 'Chat is temporarily unavailable.'));
    }
    return apiErrorResponse(error);
  }
}
