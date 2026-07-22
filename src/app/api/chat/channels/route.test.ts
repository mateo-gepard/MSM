import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  requireActivePrincipal: vi.fn(),
  requireStaffMfa: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  listBookingChatMessages: vi.fn(),
  sendBookingChatMessage: vi.fn(),
}));

vi.mock('@/lib/rate-limit/server', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/auth/server', () => ({
  requireActivePrincipal: mocks.requireActivePrincipal,
  requireStaffMfa: mocks.requireStaffMfa,
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

vi.mock('@/lib/sendbird/server', () => ({
  CHAT_AUTHORIZED_BOOKING_LIFECYCLES: ['confirmed'],
  listBookingChatMessages: mocks.listBookingChatMessages,
  sendBookingChatMessage: mocks.sendBookingChatMessage,
  SendbirdApiError: class SendbirdApiError extends Error {},
}));

import { ApiError } from '@/lib/api/errors';
import { GET, POST } from './route';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_MESSAGE_ID = '22222222-2222-4222-8222-222222222222';

function expectCodeOnlyError(payload: unknown, code: string) {
  expect(payload).toEqual({ error: { code } });
  expect(Object.keys((payload as { error: Record<string, unknown> }).error)).toEqual(['code']);
}

describe('chat channel route request protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
  });

  it('applies the network read limit before query parsing and skips auth for invalid input', async () => {
    const response = await GET(
      new Request('https://msm.test/api/chat/channels?identityContext=household&bookingId=invalid'),
    );

    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1);
    const limitInput = mocks.enforceRateLimit.mock.calls[0]?.[0];
    expect(limitInput).toMatchObject({
      scope: 'chat_pre_auth_read',
      limit: 2400,
      windowSeconds: 3600,
    });
    expect(limitInput?.subject).toBeUndefined();
    expect(mocks.requireActivePrincipal).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expectCodeOnlyError(await response.json(), 'INVALID_REQUEST');
  });

  it('short-circuits a valid read before auth when the network limit rejects it', async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      new ApiError(429, 'RATE_LIMITED', 'Internal rate-limit copy must not be exposed.'),
    );
    const search = new URLSearchParams({
      identityContext: 'household',
      bookingId: BOOKING_ID,
    });

    const response = await GET(
      new Request(`https://msm.test/api/chat/channels?${search.toString()}`),
    );

    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.enforceRateLimit.mock.calls[0]?.[0]).toMatchObject({
      scope: 'chat_pre_auth_read',
      limit: 2400,
      windowSeconds: 3600,
    });
    expect(mocks.requireActivePrincipal).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expectCodeOnlyError(await response.json(), 'RATE_LIMITED');
  });

  it('rejects an oversized JSON send after the network limit and before auth', async () => {
    const body = JSON.stringify({
      identityContext: 'household',
      bookingId: BOOKING_ID,
      message: 'x'.repeat(17 * 1024),
      clientMessageId: CLIENT_MESSAGE_ID,
    });
    const response = await POST(
      new Request('https://msm.test/api/chat/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(body)),
        },
        body,
      }),
    );

    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1);
    const limitInput = mocks.enforceRateLimit.mock.calls[0]?.[0];
    expect(limitInput).toMatchObject({
      scope: 'chat_pre_auth_send',
      limit: 300,
      windowSeconds: 3600,
    });
    expect(limitInput?.subject).toBeUndefined();
    expect(mocks.requireActivePrincipal).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(mocks.sendBookingChatMessage).not.toHaveBeenCalled();
    expect(response.status).toBe(413);
    expectCodeOnlyError(await response.json(), 'PAYLOAD_TOO_LARGE');
  });
});
