import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_AUTHORIZED_BOOKING_LIFECYCLES,
  ensureBookingChatChannel,
  listBookingChatMessages,
  sendBookingChatMessage,
  toSendbirdChannelUrl,
  toSendbirdUserId,
} from './server';

const bookingId = '8bb08d6d-4bc1-4e5f-9ad8-673f78769341';
const otherBookingId = '424f75cb-03c2-493e-9435-40721155673f';
const clientMessageId = '72f88f45-a19e-4b70-bc65-72a02a34ff35';
const channelContractSecret = 'test-sendbird-channel-contract-secret-0001';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const householdUserId = toSendbirdUserId({ side: 'household', bookingId });
const tutorUserId = toSendbirdUserId({ side: 'tutor', bookingId });
const channelUrl = toSendbirdChannelUrl(bookingId);

function channelContractData(forChannelUrl = channelUrl) {
  return JSON.stringify({
    version: 1,
    blockSdkUserChannelJoin: true,
    seal: createHmac('sha256', channelContractSecret)
      .update(
        `msm-sendbird-channel-contract-v1:test-app:${forChannelUrl}:block-sdk-join=true`,
      )
      .digest('hex'),
  });
}

function channelPayload(
  members = [
    { user_id: householdUserId, state: 'joined' },
    { user_id: tutorUserId, state: 'joined' },
  ],
  overrides: Record<string, unknown> = {},
) {
  return {
    channel_url: channelUrl,
    custom_type: 'msm_booking_v1',
    data: channelContractData(),
    is_distinct: false,
    is_public: false,
    is_super: false,
    is_ephemeral: false,
    is_access_code_required: false,
    member_count: members.length,
    joined_member_count: members.filter((member) => member.state === 'joined').length,
    members,
    operators: [],
    ...overrides,
  };
}

const channelInput = {
  bookingId,
  parentNickname: 'MSM Haushalt',
  tutorNickname: 'Ada Tutor',
  tutorName: 'Ada Tutor',
};

beforeEach(() => {
  vi.stubEnv('SENDBIRD_APP_ID', 'test-app');
  vi.stubEnv('SENDBIRD_API_TOKEN', 'test-platform-token');
  vi.stubEnv('SENDBIRD_CHANNEL_CONTRACT_SECRET', channelContractSecret);
  vi.stubEnv('SENDBIRD_TOKEN_AUTH_REQUIRED', 'true');
  vi.stubEnv('SENDBIRD_RESTRICTED_ACL_REQUIRED', 'true');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Sendbird booking scope', () => {
  it('admits only live booking lifecycle states', () => {
    expect(CHAT_AUTHORIZED_BOOKING_LIFECYCLES).toEqual([
      'provider_pending',
      'pending_confirmation',
      'scheduled',
      'cancellation_pending',
      'reschedule_pending',
    ]);
    expect(CHAT_AUTHORIZED_BOOKING_LIFECYCLES).not.toContain('completed');
  });

  it('derives opaque users and one deterministic channel per booking', () => {
    expect(householdUserId).toMatch(/^msm_h_[0-9a-f]{32}$/);
    expect(tutorUserId).toMatch(/^msm_t_[0-9a-f]{32}$/);
    expect(householdUserId.slice('msm_h_'.length)).toBe(
      tutorUserId.slice('msm_t_'.length),
    );
    expect(channelUrl).toMatch(/^msm_booking_[0-9a-f]{32}$/);
    expect(toSendbirdChannelUrl(bookingId)).toBe(channelUrl);
    expect(toSendbirdChannelUrl(otherBookingId)).not.toBe(channelUrl);
    expect(
      toSendbirdUserId({ side: 'household', bookingId: otherBookingId }),
    ).not.toBe(householdUserId);
  });

  it('rejects malformed booking identifiers before a provider request', () => {
    expect(() => toSendbirdChannelUrl('invalid')).toThrow('Invalid booking scope ID');
  });
});

describe('Sendbird channel creation and repair', () => {
  it.each(['SENDBIRD_TOKEN_AUTH_REQUIRED', 'SENDBIRD_RESTRICTED_ACL_REQUIRED'])(
    'fails closed when the %s operator attestation is absent',
    async (variable) => {
      vi.stubEnv(variable, 'false');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({
        code: 'SERVICE_NOT_CONFIGURED',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the channel-contract secret is absent', async () => {
    vi.stubEnv('SENDBIRD_CHANNEL_CONTRACT_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({
      code: 'SERVICE_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the documented channel-contract placeholder in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SENDBIRD_CHANNEL_CONTRACT_SECRET', 'GENERATE_A_DISTINCT_LONG_RANDOM_SECRET');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({
      code: 'SERVICE_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the provider omits the operator list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(channelPayload(undefined, { operators: undefined }))),
    );

    await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({ status: 502 });
  });

  it.each([
    ['missing', ''],
    [
      'invalid',
      JSON.stringify({
        version: 1,
        blockSdkUserChannelJoin: true,
        seal: '0'.repeat(64),
      }),
    ],
  ])('fails closed for a %s channel creation contract', async (_case, data) => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?`)) {
        return jsonResponse(channelPayload(undefined, { data }));
      }
      throw new Error(`Unexpected request: ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('creates a strict private channel at the deterministic URL', async () => {
    let channelReads = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?`)) {
        channelReads += 1;
        return channelReads === 1
          ? jsonResponse({ code: 400201 }, 400)
          : jsonResponse(channelPayload());
      }
      if (href.endsWith('/users')) return jsonResponse({});
      if (href.endsWith('/group_channels') && init?.method === 'POST') {
        return jsonResponse(channelPayload());
      }
      throw new Error(`Unexpected request: ${init?.method} ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureBookingChatChannel(channelInput)).resolves.toBe(channelUrl);

    const creationCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/group_channels') && init?.method === 'POST',
    );
    expect(creationCall).toBeDefined();
    const createIndex = fetchMock.mock.calls.indexOf(creationCall!);
    const userCreateIndexes = fetchMock.mock.calls
      .map(([url], index) => (String(url).endsWith('/users') ? index : -1))
      .filter((index) => index >= 0);
    expect(userCreateIndexes).toHaveLength(2);
    expect(userCreateIndexes.every((index) => index < createIndex)).toBe(true);
    const creationBody = JSON.parse(String(creationCall?.[1]?.body));
    expect(creationBody).toEqual(
      expect.objectContaining({
        channel_url: channelUrl,
        user_ids: [householdUserId, tutorUserId],
        invitation_status: {
          [householdUserId]: 'joined',
          [tutorUserId]: 'joined',
        },
        custom_type: 'msm_booking_v1',
        is_distinct: false,
        is_public: false,
        is_super: false,
        is_ephemeral: false,
        strict: true,
        operator_ids: [],
        block_sdk_user_channel_join: true,
      }),
    );
    expect(JSON.parse(creationBody.data)).toEqual({
      version: 1,
      blockSdkUserChannelJoin: true,
      seal: createHmac('sha256', channelContractSecret)
        .update(`msm-sendbird-channel-contract-v1:test-app:${channelUrl}:block-sdk-join=true`)
        .digest('hex'),
    });
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/token'))).toBe(true);
  });

  it('recovers a concurrent create race by re-fetching the deterministic URL', async () => {
    let channelReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        if (href.includes(`group_channels/${channelUrl}?`)) {
          channelReads += 1;
          return channelReads === 1
            ? jsonResponse({ code: 400201 }, 400)
            : jsonResponse(channelPayload());
        }
        if (href.endsWith('/users')) return jsonResponse({});
        if (href.endsWith('/group_channels') && init?.method === 'POST') {
          return jsonResponse({ code: 400201 }, 400);
        }
        throw new Error(`Unexpected request: ${init?.method} ${href}`);
      }),
    );

    await expect(ensureBookingChatChannel(channelInput)).resolves.toBe(channelUrl);
    expect(channelReads).toBe(2);
  });

  it('does not mistake a failed create for a race when the canonical channel is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        if (href.includes(`group_channels/${channelUrl}?`)) {
          return jsonResponse({ code: 400201 }, 400);
        }
        if (href.endsWith('/users')) return jsonResponse({});
        if (href.endsWith('/group_channels') && init?.method === 'POST') {
          return jsonResponse({ code: 500901 }, 500);
        }
        throw new Error(`Unexpected request: ${init?.method} ${href}`);
      }),
    );

    await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({ status: 500 });
  });

  it('removes extras before inviting missing users and then verifies exact membership', async () => {
    const intruder = 'msm_h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    let channelReads = 0;
    const requestOrder: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?`)) {
        requestOrder.push('get');
        channelReads += 1;
        return channelReads === 1
          ? jsonResponse(
              channelPayload([
                { user_id: householdUserId, state: 'invited' },
                { user_id: intruder, state: 'joined' },
              ]),
            )
          : jsonResponse(channelPayload());
      }
      if (href.endsWith('/users')) {
        requestOrder.push('ensure');
        return jsonResponse({});
      }
      if (href.endsWith('/leave')) {
        requestOrder.push('leave');
        return new Response(null, { status: 204 });
      }
      if (href.endsWith('/invite')) {
        requestOrder.push('invite');
        return jsonResponse(channelPayload());
      }
      throw new Error(`Unexpected request: ${init?.method} ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureBookingChatChannel(channelInput)).resolves.toBe(channelUrl);

    expect(requestOrder.indexOf('leave')).toBeLessThan(requestOrder.indexOf('invite'));
    expect(requestOrder.at(-1)).toBe('get');
    const leaveCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/leave'));
    expect(JSON.parse(String(leaveCall?.[1]?.body))).toMatchObject({
      user_ids: [intruder],
      should_remove_operator_status: true,
    });
    const inviteCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/invite'));
    expect(JSON.parse(String(inviteCall?.[1]?.body))).toEqual({
      user_ids: [householdUserId, tutorUserId],
      invitation_status: {
        [householdUserId]: 'joined',
        [tutorUserId]: 'joined',
      },
    });
  });

  it('unregisters every operator, including operators who are not channel members', async () => {
    const externalOperator = 'provider-operator-not-in-members';
    let channelReads = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?`)) {
        channelReads += 1;
        return jsonResponse(
          channelReads === 1
            ? channelPayload(undefined, { operators: [{ user_id: externalOperator }] })
            : channelPayload(),
        );
      }
      if (href.endsWith(`/operators?delete_all=true`) && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${init?.method} ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureBookingChatChannel(channelInput)).resolves.toBe(channelUrl);

    expect(channelReads).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/group_channels/${channelUrl}/operators?delete_all=true`),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/leave'))).toBe(false);
  });

  it('fails closed when membership remains inexact after repair', async () => {
    const intruder = 'msm_t_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        if (href.includes(`group_channels/${channelUrl}?`)) {
          return jsonResponse(
            channelPayload([
              { user_id: householdUserId, state: 'joined' },
              { user_id: tutorUserId, state: 'joined' },
              { user_id: intruder, state: 'joined' },
            ]),
          );
        }
        if (href.endsWith('/leave')) return new Response(null, { status: 204 });
        throw new Error(`Unexpected request: ${href}`);
      }),
    );

    await expect(ensureBookingChatChannel(channelInput)).rejects.toMatchObject({ status: 502 });
  });
});

describe('Sendbird server-mediated messages', () => {
  it('filters provider messages and returns only minimized text DTOs', async () => {
    const now = Date.parse('2030-05-05T08:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?show_member=true`)) {
        return jsonResponse(channelPayload());
      }
      if (href.includes(`/group_channels/${channelUrl}/messages?`)) {
        return jsonResponse({
          messages: [
            {
              message_id: 100,
              type: 'MESG',
              message: 'Hallo',
              created_at: now - 2,
              user: { user_id: householdUserId, nickname: 'private' },
              channel_url: channelUrl,
            },
            {
              message_id: 101,
              type: 'FILE',
              message: 'not-a-text-message',
              created_at: now - 1,
              user: { user_id: tutorUserId },
            },
            {
              message_id: 102,
              type: 'MESG',
              message: 'intruder',
              created_at: now,
              user: { user_id: 'unexpected-user' },
            },
            {
              message_id: 103,
              type: 'MESG',
              message: 'Guten Morgen',
              created_at: now + 1,
              user: { user_id: tutorUserId },
            },
          ],
        });
      }
      throw new Error(`Unexpected request: ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listBookingChatMessages({
      ...channelInput,
      side: 'household',
    });

    expect(result).toEqual({
      messages: [
        { id: '100', text: 'Hallo', createdAt: now - 2, sender: 'self' },
        { id: '103', text: 'Guten Morgen', createdAt: now + 1, sender: 'other' },
      ],
      olderCursor: null,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('test-app');
    expect(serialized).not.toContain('test-platform-token');
    expect(serialized).not.toContain(householdUserId);
    expect(serialized).not.toContain(tutorUserId);
    const listUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(listUrl).toContain('message_type=MESG');
    expect(listUrl).toContain(
      `sender_ids=${encodeURIComponent(`${householdUserId},${tutorUserId}`)}`,
    );
  });

  it('loads exactly 50 older messages using an opaque message-ID cursor', async () => {
    const messages = Array.from({ length: 50 }, (_, index) => ({
      message_id: 200 + index,
      type: 'MESG',
      message: `Nachricht ${index + 1}`,
      created_at: 2_000 + index,
      user: { user_id: index % 2 === 0 ? householdUserId : tutorUserId },
    }));
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?show_member=true`)) {
        return jsonResponse(channelPayload());
      }
      if (href.includes(`/group_channels/${channelUrl}/messages?`)) {
        return jsonResponse({ messages });
      }
      throw new Error(`Unexpected request: ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listBookingChatMessages({
      ...channelInput,
      side: 'tutor',
      beforeMessageId: '1000',
    });

    expect(result.messages).toHaveLength(50);
    expect(result.olderCursor).toBe('200');
    const listUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(listUrl).toContain('message_id=1000');
    expect(listUrl).toContain('prev_limit=50');
    expect(listUrl).toContain('next_limit=0');
  });

  it('rejects malformed provider message output instead of forwarding it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        if (href.includes(`group_channels/${channelUrl}?show_member=true`)) {
          return jsonResponse(channelPayload());
        }
        if (href.includes(`/group_channels/${channelUrl}/messages?`)) {
          return jsonResponse({ messages: [{ type: 'MESG', message: 'missing fields' }] });
        }
        throw new Error(`Unexpected request: ${href}`);
      }),
    );

    await expect(
      listBookingChatMessages({ ...channelInput, side: 'household' }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('sends only MESG with a stable deduplication ID and minimizes the response', async () => {
    const now = Date.parse('2030-05-05T08:00:00.000Z');
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes(`group_channels/${channelUrl}?show_member=true`)) {
        return jsonResponse(channelPayload());
      }
      if (href.endsWith(`/group_channels/${channelUrl}/messages`) && init?.method === 'POST') {
        return jsonResponse({
          message_id: 777,
          type: 'MESG',
          message: 'Bitte um 16 Uhr.',
          created_at: now,
          user: { user_id: householdUserId, nickname: 'private' },
          channel_url: channelUrl,
          data: 'provider-only',
        });
      }
      throw new Error(`Unexpected request: ${init?.method} ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBookingChatMessage({
      ...channelInput,
      side: 'household',
      message: 'Bitte um 16 Uhr.',
      clientMessageId,
    });

    expect(result).toEqual({
      id: '777',
      text: 'Bitte um 16 Uhr.',
      createdAt: now,
      sender: 'self',
    });
    const sendCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/messages') && init?.method === 'POST',
    );
    expect(JSON.parse(String(sendCall?.[1]?.body))).toEqual({
      message_type: 'MESG',
      user_id: householdUserId,
      message: 'Bitte um 16 Uhr.',
      dedup_id: clientMessageId,
      send_push: false,
    });
  });
});
