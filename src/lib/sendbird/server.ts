import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatIdentityContext,
  type ChatMessageDto,
} from '@/domain/chat';
export { CHAT_AUTHORIZED_BOOKING_LIFECYCLES } from '@/domain/chat';
import { assertServerOnly } from '@/lib/security/server-only';
import { ServiceConfigurationError } from '@/lib/supabase/config';

assertServerOnly('Sendbird Platform API client');

const SENDBIRD_CHANNEL_CUSTOM_TYPE = 'msm_booking_v1';
const SENDBIRD_CHANNEL_CONTRACT_CONTEXT = 'msm-sendbird-channel-contract-v1';
const SENDBIRD_CHANNEL_CONTRACT_PLACEHOLDER = 'GENERATE_A_DISTINCT_LONG_RANDOM_SECRET';
const SENDBIRD_MESSAGE_PAGE_SIZE = 50;
const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const providerIdSchema = z.union([
  z.number().int().nonnegative().safe(),
  z.string().regex(/^\d{1,20}$/),
]);
const sendbirdErrorSchema = z.object({ code: z.number().optional() }).passthrough();
const sendbirdMemberSchema = z
  .object({
    user_id: z.string().min(1),
    state: z.string().optional(),
  })
  .passthrough();
const sendbirdChannelSchema = z
  .object({
    channel_url: z.string().min(1),
    custom_type: z.string(),
    data: z.string().min(1),
    is_distinct: z.boolean(),
    is_public: z.boolean(),
    is_super: z.boolean(),
    is_ephemeral: z.boolean(),
    is_access_code_required: z.boolean().optional(),
    member_count: z.number().int().nonnegative(),
    joined_member_count: z.number().int().nonnegative().optional(),
    members: z.array(sendbirdMemberSchema),
    operators: z.array(z.object({ user_id: z.string().min(1) }).passthrough()),
  })
  .passthrough();
const sendbirdChannelContractSchema = z
  .object({
    version: z.literal(1),
    blockSdkUserChannelJoin: z.literal(true),
    seal: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
const sendbirdMessageSchema = z
  .object({
    message_id: providerIdSchema,
    type: z.string(),
    message: z.string(),
    created_at: z.number().int().nonnegative().safe(),
    is_removed: z.boolean().optional(),
    user: z.object({ user_id: z.string().min(1) }).passthrough(),
  })
  .passthrough();
const sendbirdMessageListSchema = z
  .object({ messages: z.array(sendbirdMessageSchema) })
  .passthrough();

export interface SendbirdBookingScope {
  side: ChatIdentityContext;
  bookingId: string;
}

interface SendbirdConfig {
  appId: string;
  apiToken: string;
  channelContractSecret: string;
}

interface BookingChannelInput {
  bookingId: string;
  parentNickname: string;
  tutorNickname: string;
  tutorName: string;
}

interface BookingMessageInput extends BookingChannelInput {
  side: ChatIdentityContext;
}

export class SendbirdApiError extends Error {
  constructor(readonly status: number) {
    super('Sendbird Platform API request failed');
    this.name = 'SendbirdApiError';
  }
}

function requireSendbirdConfig(): SendbirdConfig {
  const appId = process.env.SENDBIRD_APP_ID?.trim();
  const apiToken = process.env.SENDBIRD_API_TOKEN?.trim();
  const channelContractSecret = process.env.SENDBIRD_CHANNEL_CONTRACT_SECRET?.trim();
  const tokenAuthenticationAttested =
    process.env.SENDBIRD_TOKEN_AUTH_REQUIRED?.trim().toLowerCase() === 'true';
  const restrictedAclAttested =
    process.env.SENDBIRD_RESTRICTED_ACL_REQUIRED?.trim().toLowerCase() === 'true';
  if (
    !appId ||
    !/^[a-zA-Z0-9-]+$/.test(appId) ||
    !apiToken ||
    !channelContractSecret ||
    channelContractSecret.length < 32 ||
    (process.env.NODE_ENV === 'production' &&
      channelContractSecret === SENDBIRD_CHANNEL_CONTRACT_PLACEHOLDER) ||
    !tokenAuthenticationAttested ||
    !restrictedAclAttested
  ) {
    throw new ServiceConfigurationError('Sendbird');
  }
  return { appId, apiToken, channelContractSecret };
}

async function sendbirdRequest(path: string, init: RequestInit) {
  const { appId, apiToken } = requireSendbirdConfig();
  const response = await fetch(`https://api-${appId}.sendbird.com/v3${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Api-Token': apiToken,
      'Content-Type': 'application/json; charset=utf-8',
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { response, payload };
}

function normalizeUuid(value: string, label: string): string {
  const normalized = value.toLowerCase();
  if (!canonicalUuidPattern.test(normalized)) throw new Error(`Invalid ${label}`);
  return normalized.replaceAll('-', '');
}

function bookingRelationshipHash(bookingId: string): string {
  const normalizedBookingId = normalizeUuid(bookingId, 'booking scope ID');
  return createHash('sha256')
    .update(`msm-chat-booking-v1:${normalizedBookingId}`)
    .digest('hex')
    .slice(0, 32);
}

function channelContractSeal(channelUrl: string, appId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(
      `${SENDBIRD_CHANNEL_CONTRACT_CONTEXT}:${appId}:${channelUrl}:block-sdk-join=true`,
    )
    .digest('hex');
}

function createChannelContractData(channelUrl: string): string {
  const { appId, channelContractSecret } = requireSendbirdConfig();
  return JSON.stringify({
    version: 1,
    blockSdkUserChannelJoin: true,
    seal: channelContractSeal(channelUrl, appId, channelContractSecret),
  });
}

function assertChannelContract(data: string, channelUrl: string): void {
  let decoded: unknown;
  try {
    decoded = JSON.parse(data);
  } catch {
    throw new SendbirdApiError(502);
  }
  const contract = sendbirdChannelContractSchema.safeParse(decoded);
  if (!contract.success) throw new SendbirdApiError(502);

  const { appId, channelContractSecret } = requireSendbirdConfig();
  const expected = Buffer.from(
    channelContractSeal(channelUrl, appId, channelContractSecret),
    'hex',
  );
  const actual = Buffer.from(contract.data.seal, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new SendbirdApiError(502);
  }
}

/** Provider identities represent one side of one exact booking. */
export function toSendbirdUserId(scope: SendbirdBookingScope): string {
  const relationshipId = bookingRelationshipHash(scope.bookingId);
  return `msm_${scope.side === 'household' ? 'h' : 't'}_${relationshipId}`;
}

/** A fixed URL prevents duplicate channels during concurrent creation. */
export function toSendbirdChannelUrl(bookingId: string): string {
  return `msm_booking_${bookingRelationshipHash(bookingId)}`;
}

export async function ensureSendbirdUser(userId: string, nickname: string): Promise<void> {
  const safeNickname = nickname.trim().slice(0, 80) || 'MSM User';
  const create = await sendbirdRequest('/users', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, nickname: safeNickname, profile_url: '' }),
  });
  if (create.response.ok) return;

  const parsedError = sendbirdErrorSchema.safeParse(create.payload);
  if (create.response.status !== 400 || !parsedError.success || parsedError.data.code !== 400202) {
    throw new SendbirdApiError(create.response.status);
  }

  const update = await sendbirdRequest(`/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ nickname: safeNickname }),
  });
  if (!update.response.ok) throw new SendbirdApiError(update.response.status);
}

function expectedBookingUsers(bookingId: string) {
  return {
    household: toSendbirdUserId({ side: 'household', bookingId }),
    tutor: toSendbirdUserId({ side: 'tutor', bookingId }),
  };
}

async function getGroupChannel(channelUrl: string) {
  const result = await sendbirdRequest(
    `/group_channels/${encodeURIComponent(channelUrl)}?show_member=true`,
    { method: 'GET' },
  );
  const parsedError = sendbirdErrorSchema.safeParse(result.payload);
  const isMissing =
    result.response.status === 404 ||
    (result.response.status === 400 &&
      parsedError.success &&
      parsedError.data.code === 400201);
  if (isMissing) return null;
  if (!result.response.ok) throw new SendbirdApiError(result.response.status);
  const parsed = sendbirdChannelSchema.safeParse(result.payload);
  if (!parsed.success) throw new SendbirdApiError(502);
  return parsed.data;
}

function assertStrictBookingChannel(
  channel: z.infer<typeof sendbirdChannelSchema>,
  channelUrl: string,
  options: { allowOperatorRepair?: boolean } = {},
): void {
  assertChannelContract(channel.data, channelUrl);
  if (
    channel.channel_url !== channelUrl ||
    channel.custom_type !== SENDBIRD_CHANNEL_CUSTOM_TYPE ||
    channel.is_distinct ||
    channel.is_public ||
    channel.is_super ||
    channel.is_ephemeral ||
    channel.is_access_code_required === true ||
    (!options.allowOperatorRepair && (channel.operators?.length ?? 0) !== 0)
  ) {
    throw new SendbirdApiError(502);
  }
}

async function createBookingChannel(
  input: BookingChannelInput,
  channelUrl: string,
  householdUserId: string,
  tutorUserId: string,
): Promise<z.infer<typeof sendbirdChannelSchema>> {
  const invitationStatus = {
    [householdUserId]: 'joined',
    [tutorUserId]: 'joined',
  };
  const result = await sendbirdRequest('/group_channels', {
    method: 'POST',
    body: JSON.stringify({
      channel_url: channelUrl,
      user_ids: [householdUserId, tutorUserId],
      invitation_status: invitationStatus,
      name: `MSM · ${input.tutorName}`.slice(0, 191),
      custom_type: SENDBIRD_CHANNEL_CUSTOM_TYPE,
      data: createChannelContractData(channelUrl),
      is_distinct: false,
      is_public: false,
      is_super: false,
      is_ephemeral: false,
      strict: true,
      operator_ids: [],
      block_sdk_user_channel_join: true,
    }),
  });

  // The canonical read is mandatory even after a successful response. If the
  // POST lost a create race, only an exact deterministic channel may recover it.
  const canonical = await getGroupChannel(channelUrl);
  if (!canonical) {
    throw new SendbirdApiError(result.response.ok ? 502 : result.response.status);
  }
  return canonical;
}

async function reconcileBookingMembers(
  channel: z.infer<typeof sendbirdChannelSchema>,
  input: BookingChannelInput,
  expected: ReturnType<typeof expectedBookingUsers>,
) {
  const expectedIds = [expected.household, expected.tutor];
  const expectedSet = new Set(expectedIds);
  const operatorIds = new Set((channel.operators ?? []).map((operator) => operator.user_id));
  const membersToRemove = channel.members
    .filter((member) => !expectedSet.has(member.user_id))
    .map((member) => member.user_id);
  const joinedIds = new Set(
    channel.members
      .filter((member) => expectedSet.has(member.user_id) && member.state === 'joined')
      .map((member) => member.user_id),
  );
  const membersToInvite = expectedIds.filter((userId) => !joinedIds.has(userId));

  if (operatorIds.size) {
    const unregister = await sendbirdRequest(
      `/group_channels/${encodeURIComponent(channel.channel_url)}/operators?delete_all=true`,
      { method: 'DELETE' },
    );
    if (!unregister.response.ok) throw new SendbirdApiError(unregister.response.status);
  }

  if (membersToInvite.includes(expected.household)) {
    await ensureSendbirdUser(expected.household, input.parentNickname);
  }
  if (membersToInvite.includes(expected.tutor)) {
    await ensureSendbirdUser(expected.tutor, input.tutorNickname);
  }

  if (membersToRemove.length) {
    const leave = await sendbirdRequest(
      `/group_channels/${encodeURIComponent(channel.channel_url)}/leave`,
      {
        method: 'PUT',
        body: JSON.stringify({
          user_ids: membersToRemove,
          should_remove_operator_status: true,
          reason: 'admin_removed',
        }),
      },
    );
    if (!leave.response.ok) throw new SendbirdApiError(leave.response.status);
  }

  if (membersToInvite.length) {
    const invitationStatus = Object.fromEntries(
      membersToInvite.map((userId) => [userId, 'joined']),
    );
    const invite = await sendbirdRequest(
      `/group_channels/${encodeURIComponent(channel.channel_url)}/invite`,
      {
        method: 'POST',
        body: JSON.stringify({
          user_ids: membersToInvite,
          invitation_status: invitationStatus,
        }),
      },
    );
    if (!invite.response.ok) throw new SendbirdApiError(invite.response.status);
  }

  const reconciled =
    operatorIds.size || membersToRemove.length || membersToInvite.length
      ? await getGroupChannel(channel.channel_url)
      : channel;
  if (!reconciled) throw new SendbirdApiError(502);
  assertStrictBookingChannel(reconciled, channel.channel_url);

  const reconciledIds = reconciled.members.map((member) => member.user_id).sort();
  if (
    reconciled.member_count !== 2 ||
    reconciledIds.length !== 2 ||
    reconciledIds[0] !== [...expectedIds].sort()[0] ||
    reconciledIds[1] !== [...expectedIds].sort()[1] ||
    reconciled.members.some((member) => member.state !== 'joined')
  ) {
    throw new SendbirdApiError(502);
  }

  return reconciled;
}

export async function ensureBookingChatChannel(input: BookingChannelInput): Promise<string> {
  const channelUrl = toSendbirdChannelUrl(input.bookingId);
  const expected = expectedBookingUsers(input.bookingId);
  let channel = await getGroupChannel(channelUrl);

  if (!channel) {
    await Promise.all([
      ensureSendbirdUser(expected.household, input.parentNickname),
      ensureSendbirdUser(expected.tutor, input.tutorNickname),
    ]);
    channel = await createBookingChannel(
      input,
      channelUrl,
      expected.household,
      expected.tutor,
    );
  }

  assertStrictBookingChannel(channel, channelUrl, { allowOperatorRepair: true });
  await reconcileBookingMembers(channel, input, expected);
  return channelUrl;
}

function minimizeMessage(
  message: z.infer<typeof sendbirdMessageSchema>,
  ownUserId: string,
): ChatMessageDto {
  return {
    id: String(message.message_id),
    text: message.message,
    createdAt: message.created_at,
    sender: message.user.user_id === ownUserId ? 'self' : 'other',
  };
}

function isAllowedTextMessage(
  message: z.infer<typeof sendbirdMessageSchema>,
  expectedUserIds: ReadonlySet<string>,
): boolean {
  return (
    message.type === 'MESG' &&
    message.is_removed !== true &&
    expectedUserIds.has(message.user.user_id) &&
    message.message.trim().length > 0 &&
    message.message.length <= CHAT_MESSAGE_MAX_LENGTH
  );
}

export async function listBookingChatMessages(
  input: BookingMessageInput & { beforeMessageId?: string },
): Promise<{ messages: ChatMessageDto[]; olderCursor: string | null }> {
  const channelUrl = await ensureBookingChatChannel(input);
  const expected = expectedBookingUsers(input.bookingId);
  const ownUserId = expected[input.side];
  const reference = input.beforeMessageId
    ? `message_id=${encodeURIComponent(input.beforeMessageId)}`
    : `message_ts=${Date.now() + 1}`;
  const query = new URLSearchParams({
    prev_limit: String(SENDBIRD_MESSAGE_PAGE_SIZE),
    next_limit: '0',
    include: 'false',
    reverse: 'false',
    message_type: 'MESG',
    sender_ids: `${expected.household},${expected.tutor}`,
  });
  const result = await sendbirdRequest(
    `/group_channels/${encodeURIComponent(channelUrl)}/messages?${reference}&${query.toString()}`,
    { method: 'GET' },
  );
  if (!result.response.ok) throw new SendbirdApiError(result.response.status);
  const parsed = sendbirdMessageListSchema.safeParse(result.payload);
  if (!parsed.success) throw new SendbirdApiError(502);

  const expectedUserIds = new Set([expected.household, expected.tutor]);
  const messages = parsed.data.messages
    .filter((message) => isAllowedTextMessage(message, expectedUserIds))
    .map((message) => minimizeMessage(message, ownUserId))
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  const oldestProviderMessage = parsed.data.messages[0];
  const olderCursor =
    parsed.data.messages.length === SENDBIRD_MESSAGE_PAGE_SIZE && oldestProviderMessage
      ? String(oldestProviderMessage.message_id)
      : null;

  return { messages, olderCursor };
}

export async function sendBookingChatMessage(
  input: BookingMessageInput & { message: string; clientMessageId: string },
): Promise<ChatMessageDto> {
  const channelUrl = await ensureBookingChatChannel(input);
  const expected = expectedBookingUsers(input.bookingId);
  const senderUserId = expected[input.side];
  const result = await sendbirdRequest(
    `/group_channels/${encodeURIComponent(channelUrl)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        message_type: 'MESG',
        user_id: senderUserId,
        message: input.message,
        dedup_id: input.clientMessageId,
        send_push: false,
      }),
    },
  );
  if (!result.response.ok) throw new SendbirdApiError(result.response.status);
  const parsed = sendbirdMessageSchema.safeParse(result.payload);
  if (
    !parsed.success ||
    !isAllowedTextMessage(
      parsed.data,
      new Set([expected.household, expected.tutor]),
    ) ||
    parsed.data.user.user_id !== senderUserId
  ) {
    throw new SendbirdApiError(502);
  }
  return minimizeMessage(parsed.data, senderUserId);
}
