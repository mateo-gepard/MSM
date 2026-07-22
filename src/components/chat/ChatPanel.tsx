'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react';
import type { TutorSlug } from '@/domain/catalog';
import {
  CHAT_POLL_INTERVAL_MS,
  CHAT_REALTIME_REAUTHORIZE_INTERVAL_MS,
  CHAT_MESSAGE_MAX_LENGTH,
  EMPTY_CHAT_DRAFT,
  mergeChatMessages,
  mergeOlderChatPage,
  mergePolledChatPage,
  parseChatBroadcastMessage,
  type ChatIdentityContext,
  type ChatHistoryState,
  type ChatMessageDto,
  updateChatDraft,
} from '@/domain/chat';
import {
  apiClientError,
  ClientVisibleError,
  clientErrorMessage,
} from '@/lib/api/client-error';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface ChatConversation {
  key: string;
  title: string;
  description: string;
  tutorSlug: TutorSlug;
  bookingId: string;
}

interface MessageListResponse {
  data: {
    messages: ChatMessageDto[];
    olderCursor: string | null;
  };
}

interface SendMessageResponse {
  data: {
    message: ChatMessageDto;
  };
}

function parseMessage(value: unknown): ChatMessageDto | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ChatMessageDto>;
  if (
    typeof candidate.id !== 'string' ||
    !/^\d{1,20}$/.test(candidate.id) ||
    typeof candidate.text !== 'string' ||
    candidate.text.length < 1 ||
    candidate.text.length > CHAT_MESSAGE_MAX_LENGTH ||
    typeof candidate.createdAt !== 'number' ||
    !Number.isSafeInteger(candidate.createdAt) ||
    (candidate.sender !== 'self' && candidate.sender !== 'other')
  ) {
    return null;
  }
  return candidate as ChatMessageDto;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ClientVisibleError('Der Nachrichtenservice antwortet gerade nicht.');
  }
}

async function requestMessages(
  bookingId: string,
  identityContext: ChatIdentityContext,
  beforeMessageId?: string,
  signal?: AbortSignal,
): Promise<MessageListResponse['data']> {
  const query = new URLSearchParams({
    identityContext,
    bookingId,
  });
  if (beforeMessageId) query.set('beforeMessageId', beforeMessageId);
  const response = await fetch(`/api/chat/channels?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw apiClientError(payload, 'Diese Unterhaltung kann gerade nicht geöffnet werden.');
  }
  const data = (payload as Partial<MessageListResponse>).data;
  if (!data || !Array.isArray(data.messages)) {
    throw new ClientVisibleError('Die sichere Unterhaltung wurde nicht gefunden.');
  }
  const messages = data.messages.map(parseMessage);
  if (messages.some((message) => message === null)) {
    throw new ClientVisibleError('Der Nachrichtenservice hat ungültige Daten geliefert.');
  }
  if (data.olderCursor !== null && !/^\d{1,20}$/.test(data.olderCursor)) {
    throw new ClientVisibleError('Der Nachrichtenservice hat ungültige Daten geliefert.');
  }
  return {
    messages: messages as ChatMessageDto[],
    olderCursor: data.olderCursor,
  };
}

async function postMessage(
  bookingId: string,
  identityContext: ChatIdentityContext,
  message: string,
  clientMessageId: string,
): Promise<ChatMessageDto> {
  const response = await fetch('/api/chat/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityContext,
      bookingId,
      message,
      clientMessageId,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw apiClientError(payload, 'Die Nachricht konnte nicht gesendet werden.');
  }
  const parsed = parseMessage((payload as Partial<SendMessageResponse>).data?.message);
  if (!parsed) throw new ClientVisibleError('Der Nachrichtenservice hat ungültige Daten geliefert.');
  return parsed;
}

export function ChatPanel({
  conversation,
  identityContext,
}: {
  conversation: ChatConversation;
  identityContext: ChatIdentityContext;
}) {
  const bookingId = conversation.bookingId;
  const fieldId = useId();
  const [history, setHistory] = useState<ChatHistoryState>({
    messages: [],
    olderCursor: null,
  });
  const [draft, setDraft] = useState(EMPTY_CHAT_DRAFT);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const shouldScrollAfterSend = useRef(false);
  const { messages, olderCursor } = history;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setHistory({ messages: [], olderCursor: null });
    setDraft(EMPTY_CHAT_DRAFT);
    setError(null);
    setStatus('loading');

    void requestMessages(bookingId, identityContext, undefined, controller.signal)
      .then((result) => {
        if (!active) return;
        setHistory(result);
        setStatus('ready');
        requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end' }));
      })
      .catch((caughtError: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(
          clientErrorMessage(
            caughtError,
            'Diese Unterhaltung kann gerade nicht geöffnet werden.',
          ),
        );
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, bookingId, identityContext]);

  useEffect(() => {
    if (status !== 'ready') return;
    let active = true;
    let refreshInFlight = false;
    let controller: AbortController | null = null;
    let connectionGeneration = 0;
    let realtimeChannel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null =
      null;

    const refresh = async () => {
      if (!active || refreshInFlight || document.visibilityState !== 'visible') return;
      refreshInFlight = true;
      controller = new AbortController();
      try {
        const result = await requestMessages(
          bookingId,
          identityContext,
          undefined,
          controller.signal,
        );
        if (active) setHistory((current) => mergePolledChatPage(current, result));
      } catch {
        // A transient polling failure must not discard a usable conversation.
      } finally {
        refreshInFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const connectRealtime = async () => {
      const generation = ++connectionGeneration;
      try {
        const supabase = getSupabaseBrowserClient();
        await supabase.realtime.setAuth();
        if (!active || generation !== connectionGeneration) return;
        const channel = supabase
          .channel(`booking:${bookingId}`, { config: { private: true } })
          .on('broadcast', { event: 'message_created' }, (event) => {
            const message = parseChatBroadcastMessage(event.payload, identityContext);
            if (!active || !message) return;
            setHistory((current) => ({
              ...current,
              messages: mergeChatMessages(current.messages, [message]),
            }));
          })
          .subscribe((subscriptionStatus) => {
            if (subscriptionStatus === 'SUBSCRIBED') void refresh();
          });
        realtimeChannel = channel;
      } catch {
        // The visible-page reconciliation below keeps chat usable if Realtime
        // is temporarily unavailable or not enabled in a staging project.
      }
    };
    const reconnectRealtime = async () => {
      connectionGeneration += 1;
      const channel = realtimeChannel;
      realtimeChannel = null;
      if (channel) await getSupabaseBrowserClient().removeChannel(channel);
      if (active) await connectRealtime();
    };

    void connectRealtime();
    const intervalId = window.setInterval(() => void refresh(), CHAT_POLL_INTERVAL_MS);
    const reconnectId = window.setInterval(() => {
      void reconnectRealtime();
    }, CHAT_REALTIME_REAUTHORIZE_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      connectionGeneration += 1;
      controller?.abort();
      window.clearInterval(intervalId);
      window.clearInterval(reconnectId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (realtimeChannel) {
        void getSupabaseBrowserClient().removeChannel(realtimeChannel);
      }
    };
  }, [bookingId, identityContext, status]);

  useEffect(() => {
    if (!shouldScrollAfterSend.current) return;
    shouldScrollAfterSend.current = false;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const loadOlderMessages = async () => {
    if (!olderCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    setError(null);
    try {
      const result = await requestMessages(bookingId, identityContext, olderCursor);
      setHistory((current) => mergeOlderChatPage(current, result));
    } catch {
      setError('Ältere Nachrichten konnten nicht geladen werden.');
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.text.trim();
    if (!message || isSending) return;

    const clientMessageId = draft.clientMessageId || crypto.randomUUID();
    if (!draft.clientMessageId) {
      setDraft((current) =>
        current.text === draft.text ? { ...current, clientMessageId } : current,
      );
    }
    setIsSending(true);
    setError(null);
    try {
      const sentMessage = await postMessage(
        bookingId,
        identityContext,
        message,
        clientMessageId,
      );
      shouldScrollAfterSend.current = true;
      setHistory((current) => ({
        ...current,
        messages: mergeChatMessages(current.messages, [sentMessage]),
      }));
      setDraft(EMPTY_CHAT_DRAFT);
    } catch {
      // Keep clientMessageId for a safe retry of this unchanged draft.
      setError('Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.');
    } finally {
      setIsSending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[28rem] items-center justify-center p-8" role="status">
        <div className="text-center">
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-spin text-[var(--purple-bright)]"
          />
          <p className="mt-3 text-sm text-[#b5b1bf]">Unterhaltung wird geladen …</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[28rem] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-200" />
          <h3 className="mt-4 font-bold text-white">Nachrichten derzeit nicht verfügbar</h3>
          <p className="mt-2 text-sm leading-6 text-[#b5b1bf]">
            {error || 'Bitte versuche es später erneut.'}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/5"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[31rem] flex-col">
      <header className="border-b border-white/10 px-4 py-4 sm:px-5">
        <h3 className="font-bold text-white">{conversation.title}</h3>
        <p className="mt-0.5 text-xs text-[var(--ink-subtle)]">{conversation.description}</p>
      </header>

      <div className="h-[25rem] flex-1 overflow-y-auto bg-[var(--canvas-soft)] px-4 py-5 sm:px-5">
        {olderCursor ? (
          <div className="mb-5 text-center">
            <button
              type="button"
              onClick={() => void loadOlderMessages()}
              disabled={isLoadingOlder}
              className="min-h-10 rounded-lg px-3 text-xs font-bold text-[#d7ceff] hover:bg-white/5 disabled:opacity-50"
            >
              {isLoadingOlder ? 'Wird geladen …' : 'Ältere Nachrichten laden'}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center text-center">
            <div>
              <MessageCircle
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-[var(--purple-bright)]"
              />
              <p className="mt-3 font-semibold text-white">Noch keine Nachrichten</p>
              <p className="mt-1 text-sm text-[var(--ink-subtle)]">
                Du kannst die Unterhaltung hier beginnen.
              </p>
            </div>
          </div>
        ) : (
          <ol className="space-y-3" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => {
              const isOwnMessage = message.sender === 'self';
              return (
                <li key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 sm:max-w-[72%] ${
                      isOwnMessage
                        ? 'rounded-br-md bg-[var(--action)] text-white'
                        : 'rounded-bl-md border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)]'
                    }`}
                  >
                    <span className="sr-only">
                      {isOwnMessage ? 'Du' : conversation.title}:{' '}
                    </span>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                    <time
                      dateTime={new Date(message.createdAt).toISOString()}
                      className={`mt-1 block text-[0.7rem] ${
                        isOwnMessage ? 'text-white/70' : 'text-[var(--ink-subtle)]'
                      }`}
                    >
                      {new Intl.DateTimeFormat('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(message.createdAt))}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(event) => void sendMessage(event)} className="border-t border-white/10 p-3 sm:p-4">
        <label htmlFor={`${fieldId}-message`} className="sr-only">
          Nachricht an {conversation.title}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`${fieldId}-message`}
            value={draft.text}
            onChange={(event) => {
              const text = event.target.value;
              setDraft((current) => updateChatDraft(current, text, () => crypto.randomUUID()));
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={2}
            disabled={isSending}
            placeholder="Nachricht schreiben …"
            className="min-h-12 flex-1 resize-none rounded-xl border border-[var(--line-strong)] bg-[var(--canvas)] px-3.5 py-3 text-sm text-white placeholder:text-[var(--ink-subtle)] focus:border-[var(--action)] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!draft.text.trim() || isSending}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--action)] text-white transition-colors hover:bg-[var(--action-hover)] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={isSending ? 'Nachricht wird gesendet' : 'Nachricht senden'}
          >
            {isSending ? (
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
