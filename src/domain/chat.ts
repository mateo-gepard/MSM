import type { BookingLifecycleStatus } from '@/types/database';

export type ChatIdentityContext = 'household' | 'tutor';
export const CHAT_MESSAGE_MAX_LENGTH = 2_000;
export const CHAT_POLL_INTERVAL_MS = 15_000;
export const CHAT_EXPECTED_CONCURRENT_TABS = 2;
export const CHAT_AUTHENTICATED_READ_LIMIT_PER_HOUR = 600;
export const CHAT_PRE_AUTH_READ_LIMIT_PER_HOUR = 2_400;
export const CHAT_PRE_AUTH_SEND_LIMIT_PER_HOUR = 300;
export const CHAT_SEND_REQUEST_MAX_BYTES = 16 * 1_024;

export interface ChatMessageDto {
  id: string;
  text: string;
  createdAt: number;
  sender: 'self' | 'other';
}

export interface ChatMessagePage {
  messages: ChatMessageDto[];
  olderCursor: string | null;
}

export type ChatHistoryState = ChatMessagePage;

export function mergeChatMessages(
  current: ChatMessageDto[],
  additions: ChatMessageDto[],
): ChatMessageDto[] {
  const messagesById = new Map(current.map((message) => [message.id, message]));
  for (const message of additions) messagesById.set(message.id, message);
  return [...messagesById.values()].sort(
    (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  );
}

/**
 * A visible-page refresh normally overlaps the newest messages already held by
 * the client. If it does not, more than one provider page may have accumulated
 * while the page was hidden. In that case the refresh cursor becomes the load-
 * older cursor so the intervening pages remain reachable.
 */
export function mergePolledChatPage(
  current: ChatHistoryState,
  page: ChatMessagePage,
): ChatHistoryState {
  const currentIds = new Set(current.messages.map((message) => message.id));
  const overlapsCurrent = page.messages.some((message) => currentIds.has(message.id));
  const shouldAdoptBridgeCursor =
    page.olderCursor !== null &&
    page.messages.length > 0 &&
    (current.messages.length === 0 || !overlapsCurrent);

  return {
    messages: mergeChatMessages(current.messages, page.messages),
    olderCursor: shouldAdoptBridgeCursor ? page.olderCursor : current.olderCursor,
  };
}

export function mergeOlderChatPage(
  current: ChatHistoryState,
  page: ChatMessagePage,
): ChatHistoryState {
  return {
    messages: mergeChatMessages(current.messages, page.messages),
    olderCursor: page.olderCursor,
  };
}

export interface ChatDraft {
  text: string;
  clientMessageId: string;
}

export const EMPTY_CHAT_DRAFT: ChatDraft = Object.freeze({
  text: '',
  clientMessageId: '',
});

export function updateChatDraft(
  current: ChatDraft,
  text: string,
  createMessageId: () => string,
): ChatDraft {
  if (current.text === text) return current;
  return {
    text,
    clientMessageId: text ? createMessageId() : '',
  };
}

export const CHAT_AUTHORIZED_BOOKING_LIFECYCLES = [
  'provider_pending',
  'pending_confirmation',
  'scheduled',
  'cancellation_pending',
  'reschedule_pending',
] as const satisfies readonly BookingLifecycleStatus[];

export function isChatAuthorizedBookingLifecycle(status: BookingLifecycleStatus): boolean {
  return (CHAT_AUTHORIZED_BOOKING_LIFECYCLES as readonly BookingLifecycleStatus[]).includes(status);
}
