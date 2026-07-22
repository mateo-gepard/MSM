import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { listBookingChatMessages, sendBookingChatMessage } from './server';

function queryResult<T>(result: T) {
  const query = {
    eq: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  query.eq.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('Supabase booking chat data access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a chronological page and a cursor without exposing storage fields', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      id: 100 - index,
      body: `Nachricht ${100 - index}`,
      created_at: new Date(1_784_707_200_000 - index * 1_000).toISOString(),
      sender_context: index % 2 === 0 ? ('household' as const) : ('tutor' as const),
    }));
    const query = queryResult({ data: rows, error: null });
    const select = vi.fn(() => query);
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({ select })),
    });

    const result = await listBookingChatMessages({
      bookingId: '11111111-1111-4111-8111-111111111111',
      principalId: '22222222-2222-4222-8222-222222222222',
      side: 'household',
      beforeMessageId: '101',
    });

    expect(query.lt).toHaveBeenCalledWith('id', '101');
    expect(result.messages).toHaveLength(50);
    expect(result.messages[0]).toEqual({
      id: '51',
      text: 'Nachricht 51',
      createdAt: 1_784_707_151_000,
      sender: 'other',
    });
    expect(result.messages.at(-1)).toMatchObject({ id: '100', sender: 'self' });
    expect(result.olderCursor).toBe('51');
  });

  it('returns the stored message after an exact idempotent retry', async () => {
    const inserted = {
      data: null,
      error: { code: '23505' },
    };
    const existing = {
      data: {
        id: 7,
        booking_id: '11111111-1111-4111-8111-111111111111',
        body: 'Hallo',
        created_at: '2026-07-22T10:00:00.000Z',
        sender_context: 'household' as const,
      },
      error: null,
    };
    const insertChain = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(async () => inserted) })),
      })),
    };
    const existingChain = {
      select: vi.fn(() => {
        const chain = {
          eq: vi.fn(),
          maybeSingle: vi.fn(async () => existing),
        };
        chain.eq.mockReturnValue(chain);
        return chain;
      }),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(existingChain);
    mocks.createSupabaseServiceClient.mockReturnValue({ from });

    await expect(
      sendBookingChatMessage({
        bookingId: '11111111-1111-4111-8111-111111111111',
        principalId: '22222222-2222-4222-8222-222222222222',
        side: 'household',
        message: 'Hallo',
        clientMessageId: '33333333-3333-4333-8333-333333333333',
      }),
    ).resolves.toEqual({
      id: '7',
      text: 'Hallo',
      createdAt: 1_784_714_400_000,
      sender: 'self',
    });
  });

  it('rejects reuse of one client message ID for different content', async () => {
    const insertChain = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: { code: '23505' } })),
        })),
      })),
    };
    const existingChain = {
      select: vi.fn(() => {
        const chain = {
          eq: vi.fn(),
          maybeSingle: vi.fn(async () => ({
            data: {
              id: 7,
              booking_id: '11111111-1111-4111-8111-111111111111',
              body: 'Ursprünglich',
              created_at: '2026-07-22T10:00:00.000Z',
              sender_context: 'household',
            },
            error: null,
          })),
        };
        chain.eq.mockReturnValue(chain);
        return chain;
      }),
    };
    mocks.createSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValueOnce(insertChain).mockReturnValueOnce(existingChain),
    });

    const result = sendBookingChatMessage({
      bookingId: '11111111-1111-4111-8111-111111111111',
      principalId: '22222222-2222-4222-8222-222222222222',
      side: 'household',
      message: 'Verändert',
      clientMessageId: '33333333-3333-4333-8333-333333333333',
    });
    await expect(result).rejects.toMatchObject({
      status: 409,
      code: 'CHAT_IDEMPOTENCY_REUSED',
    });
  });
});
