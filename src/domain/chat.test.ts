import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_AUTHENTICATED_READ_LIMIT_PER_HOUR,
  CHAT_EXPECTED_CONCURRENT_TABS,
  CHAT_POLL_INTERVAL_MS,
  EMPTY_CHAT_DRAFT,
  mergeOlderChatPage,
  mergePolledChatPage,
  parseChatBroadcastMessage,
  updateChatDraft,
  type ChatMessageDto,
} from './chat';

describe('chat draft idempotency identity', () => {
  it('retains one client message ID for every retry of an unchanged draft', () => {
    const createMessageId = vi.fn(() => 'first-id');
    const firstDraft = updateChatDraft(EMPTY_CHAT_DRAFT, 'Hallo', createMessageId);
    const retryDraft = updateChatDraft(firstDraft, 'Hallo', createMessageId);

    expect(retryDraft).toBe(firstDraft);
    expect(retryDraft.clientMessageId).toBe('first-id');
    expect(createMessageId).toHaveBeenCalledOnce();
  });

  it('uses a new ID only after the draft changes and clears it after confirmation', () => {
    const ids = ['first-id', 'second-id'];
    const createMessageId = vi.fn(() => ids.shift() ?? 'unexpected-id');
    const firstDraft = updateChatDraft(EMPTY_CHAT_DRAFT, 'Hallo', createMessageId);
    const changedDraft = updateChatDraft(firstDraft, 'Hallo!', createMessageId);

    expect(changedDraft.clientMessageId).toBe('second-id');
    expect(EMPTY_CHAT_DRAFT).toEqual({ text: '', clientMessageId: '' });
    expect(createMessageId).toHaveBeenCalledTimes(2);
  });
});

describe('chat polling budget and pagination continuity', () => {
  const message = (id: number): ChatMessageDto => ({
    id: String(id),
    text: `Nachricht ${id}`,
    createdAt: id,
    sender: id % 2 === 0 ? 'self' : 'other',
  });

  it('budgets two continuously visible tabs without normal rate limiting', () => {
    const scheduledReadsPerHour =
      Math.ceil(3_600_000 / CHAT_POLL_INTERVAL_MS) * CHAT_EXPECTED_CONCURRENT_TABS;

    expect(scheduledReadsPerHour).toBe(120);
    expect(CHAT_AUTHENTICATED_READ_LIMIT_PER_HOUR - scheduledReadsPerHour).toBeGreaterThanOrEqual(
      120,
    );
  });

  it('retains the existing history cursor when a refresh overlaps known messages', () => {
    const result = mergePolledChatPage(
      { messages: [message(1), message(2)], olderCursor: '1' },
      { messages: [message(2), message(3)], olderCursor: '2' },
    );

    expect(result.messages.map(({ id }) => id)).toEqual(['1', '2', '3']);
    expect(result.olderCursor).toBe('1');
  });

  it('adopts and advances a bridge cursor when more than one page accrued while hidden', () => {
    const refreshed = mergePolledChatPage(
      { messages: [message(1), message(2)], olderCursor: null },
      {
        messages: Array.from({ length: 50 }, (_, index) => message(53 + index)),
        olderCursor: '53',
      },
    );

    expect(refreshed.olderCursor).toBe('53');
    expect(refreshed.messages.map(({ id }) => id)).toContain('102');

    const firstBridgePage = mergeOlderChatPage(refreshed, {
      messages: Array.from({ length: 50 }, (_, index) => message(3 + index)),
      olderCursor: '3',
    });
    expect(firstBridgePage.olderCursor).toBe('3');

    const bridged = mergeOlderChatPage(firstBridgePage, {
      messages: [message(1), message(2)],
      olderCursor: null,
    });

    expect(bridged.olderCursor).toBeNull();
    expect(bridged.messages.map(({ id }) => id)).toEqual(
      Array.from({ length: 102 }, (_, index) => String(index + 1)),
    );
  });
});

describe('chat realtime payload validation', () => {
  it('maps the stored sender side relative to the current participant', () => {
    const payload = {
      message: {
        id: '42',
        text: 'Bis morgen!',
        createdAt: 1_784_707_200_000,
        senderContext: 'tutor',
      },
    };

    expect(parseChatBroadcastMessage(payload, 'tutor')?.sender).toBe('self');
    expect(parseChatBroadcastMessage(payload, 'household')?.sender).toBe('other');
  });

  it('rejects malformed or oversized realtime data', () => {
    expect(parseChatBroadcastMessage({ message: { id: 'not-an-id' } }, 'household')).toBeNull();
    expect(
      parseChatBroadcastMessage(
        {
          message: {
            id: '1',
            text: 'x'.repeat(2_001),
            createdAt: Date.now(),
            senderContext: 'household',
          },
        },
        'household',
      ),
    ).toBeNull();
  });
});
