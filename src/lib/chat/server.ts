import {
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatIdentityContext,
  type ChatMessageDto,
  type ChatMessagePage,
} from '@/domain/chat';
import { ApiError } from '@/lib/api/errors';
import { assertServerOnly } from '@/lib/security/server-only';
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server';
import type { Database } from '@/types/database';

assertServerOnly('Supabase booking chat');

const CHAT_MESSAGE_PAGE_SIZE = 50;

type BookingMessageRow = Pick<
  Database['public']['Tables']['booking_messages']['Row'],
  'id' | 'body' | 'created_at' | 'sender_context'
>;

interface BookingChatScope {
  bookingId: string;
  side: ChatIdentityContext;
  principalId: string;
}

function toMessageDto(row: BookingMessageRow, side: ChatIdentityContext): ChatMessageDto {
  const createdAt = Date.parse(row.created_at);
  if (!Number.isSafeInteger(createdAt) || row.body.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat history contains invalid data.');
  }
  return {
    id: String(row.id),
    text: row.body,
    createdAt,
    sender: row.sender_context === side ? 'self' : 'other',
  };
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

function isAuthorizationViolation(error: { code?: string } | null): boolean {
  return error?.code === '42501';
}

export async function listBookingChatMessages(
  input: BookingChatScope & { beforeMessageId?: string },
): Promise<ChatMessagePage> {
  const database = await createSupabaseServerClient();
  let query = database
    .from('booking_messages')
    .select('id,body,created_at,sender_context')
    .eq('booking_id', input.bookingId)
    .order('id', { ascending: false })
    .limit(CHAT_MESSAGE_PAGE_SIZE + 1);
  if (input.beforeMessageId) query = query.lt('id', input.beforeMessageId);

  const { data, error } = await query;
  if (error) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Chat history is temporarily unavailable.');
  }

  const rows = data ?? [];
  const pageRows = rows.slice(0, CHAT_MESSAGE_PAGE_SIZE);
  const oldestRow = pageRows.at(-1);
  return {
    messages: pageRows
      .map((row) => toMessageDto(row, input.side))
      .reverse(),
    olderCursor:
      rows.length > CHAT_MESSAGE_PAGE_SIZE && oldestRow ? String(oldestRow.id) : null,
  };
}

export async function sendBookingChatMessage(
  input: BookingChatScope & { message: string; clientMessageId: string },
): Promise<ChatMessageDto> {
  const database = createSupabaseServiceClient();
  const messageInsert: Database['public']['Tables']['booking_messages']['Insert'] = {
    booking_id: input.bookingId,
    sender_user_id: input.principalId,
    sender_context: input.side,
    client_message_id: input.clientMessageId,
    body: input.message,
  };
  const inserted = await database
    .from('booking_messages')
    .insert(messageInsert)
    .select('id,body,created_at,sender_context')
    .maybeSingle();

  if (!inserted.error && inserted.data) return toMessageDto(inserted.data, input.side);
  if (isAuthorizationViolation(inserted.error)) {
    throw new ApiError(403, 'CHAT_NOT_ALLOWED', 'The booking no longer authorizes chat.');
  }
  if (!isUniqueViolation(inserted.error)) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The message could not be stored.');
  }

  const { data: existing, error: existingError } = await database
    .from('booking_messages')
    .select('id,booking_id,body,created_at,sender_context')
    .eq('sender_user_id', input.principalId)
    .eq('client_message_id', input.clientMessageId)
    .maybeSingle();
  if (existingError || !existing) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The message retry could not be verified.');
  }
  if (
    existing.booking_id !== input.bookingId ||
    existing.sender_context !== input.side ||
    existing.body !== input.message
  ) {
    throw new ApiError(
      409,
      'CHAT_IDEMPOTENCY_REUSED',
      'The client message ID was already used for different content.',
    );
  }
  return toMessageDto(existing, input.side);
}
