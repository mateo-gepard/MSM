'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { GroupChannelHandler, type GroupChannel } from '@sendbird/chat/groupChannel';
import type { PreviousMessageListQuery, UserMessage } from '@sendbird/chat/message';
import type { TutorSlug } from '@/domain/catalog';
import { useSendbird, type SendbirdClient } from '@/contexts/SendbirdContext';

export interface ChatConversation {
  key: string;
  title: string;
  description: string;
  tutorSlug: TutorSlug;
  bookingId?: string;
}

interface ChannelResponse {
  data: {
    channelUrl: string;
  };
}

function apiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null;
  const error = payload.error;
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  return typeof error.message === 'string' ? error.message : null;
}

async function requestChannel(conversation: ChatConversation): Promise<string> {
  const body = conversation.bookingId
    ? { tutorSlug: conversation.tutorSlug, bookingId: conversation.bookingId }
    : { tutorSlug: conversation.tutorSlug };
  const response = await fetch('/api/chat/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Diese Unterhaltung kann gerade nicht geöffnet werden.');
  }

  if (!response.ok) {
    const fallback =
      response.status === 404
        ? 'Nachrichten sind für diesen Account noch nicht eingerichtet.'
        : 'Diese Unterhaltung kann gerade nicht geöffnet werden.';
    throw new Error(apiErrorMessage(payload) || fallback);
  }

  const channelUrl = (payload as Partial<ChannelResponse>).data?.channelUrl;
  if (!channelUrl) throw new Error('Die sichere Unterhaltung wurde nicht gefunden.');
  return channelUrl;
}

function mergeMessages(current: UserMessage[], additions: UserMessage[]): UserMessage[] {
  const messagesById = new Map(current.map((message) => [message.messageId, message]));
  for (const message of additions) messagesById.set(message.messageId, message);
  return [...messagesById.values()].sort((left, right) => left.createdAt - right.createdAt);
}

function getUserMessages(messages: Awaited<ReturnType<PreviousMessageListQuery['load']>>): UserMessage[] {
  return messages.filter((message): message is UserMessage => message.isUserMessage());
}

function registerChannelHandler(
  client: SendbirdClient,
  channelUrl: string,
  handlerKey: string,
  updateMessages: React.Dispatch<React.SetStateAction<UserMessage[]>>,
) {
  const handler = new GroupChannelHandler({
    onMessageReceived: (eventChannel, message) => {
      if (eventChannel.url === channelUrl && message.isUserMessage()) {
        updateMessages((current) => mergeMessages(current, [message]));
      }
    },
    onMessageUpdated: (eventChannel, message) => {
      if (eventChannel.url === channelUrl && message.isUserMessage()) {
        updateMessages((current) => mergeMessages(current, [message]));
      }
    },
    onMessageDeleted: (eventChannel, messageId) => {
      if (eventChannel.url === channelUrl) {
        updateMessages((current) => current.filter((message) => message.messageId !== messageId));
      }
    },
  });

  client.groupChannel.addGroupChannelHandler(handlerKey, handler);
}

export function ChatPanel({ conversation }: { conversation: ChatConversation }) {
  const { connect, userId, status: connectionStatus, error: connectionError } = useSendbird();
  const handlerId = useId();
  const [channel, setChannel] = useState<GroupChannel | null>(null);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [canLoadOlder, setCanLoadOlder] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const queryRef = useRef<PreviousMessageListQuery | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const shouldScrollAfterSend = useRef(false);

  useEffect(() => {
    let active = true;
    let registeredClient: SendbirdClient | null = null;
    const handlerKey = `chat-${handlerId}-${attempt}`;

    const openConversation = async () => {
      try {
        const connectedClient = await connect();
        if (!active) return;
        const channelUrl = await requestChannel(conversation);
        if (!active) return;
        const nextChannel = await connectedClient.groupChannel.getChannel(channelUrl);

        if (!active) return;
        registeredClient = connectedClient;
        registerChannelHandler(connectedClient, channelUrl, handlerKey, setMessages);

        const query = nextChannel.createPreviousMessageListQuery({ limit: 50, reverse: false });
        queryRef.current = query;
        const initialMessages = getUserMessages(await query.load());

        if (!active) return;
        setChannel(nextChannel);
        setMessages((current) => mergeMessages(current, initialMessages));
        setCanLoadOlder(query.hasNext);
        setStatus('ready');
        void nextChannel.markAsRead().catch(() => undefined);
        requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end' }));
      } catch (caughtError) {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Diese Unterhaltung kann gerade nicht geöffnet werden.',
        );
        setStatus('error');
      }
    };

    void openConversation();

    return () => {
      active = false;
      queryRef.current = null;
      registeredClient?.groupChannel.removeGroupChannelHandler(handlerKey);
    };
  }, [attempt, connect, conversation, handlerId]);

  useEffect(() => {
    if (!shouldScrollAfterSend.current) return;
    shouldScrollAfterSend.current = false;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const loadOlderMessages = async () => {
    const query = queryRef.current;
    if (!query || !query.hasNext || query.isLoading) return;

    setIsLoadingOlder(true);
    try {
      const olderMessages = getUserMessages(await query.load());
      setMessages((current) => mergeMessages(current, olderMessages));
      setCanLoadOlder(query.hasNext);
    } catch {
      setError('Ältere Nachrichten konnten nicht geladen werden.');
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = messageText.trim();
    if (!message || !channel || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const sentMessage = await new Promise<UserMessage>((resolve, reject) => {
        channel
          .sendUserMessage({ message })
          .onSucceeded((result) => {
            if (result.isUserMessage()) resolve(result);
            else reject(new Error('Ungültige Nachricht'));
          })
          .onFailed((sendError) => reject(sendError));
      });
      shouldScrollAfterSend.current = true;
      setMessages((current) => mergeMessages(current, [sentMessage]));
      setMessageText('');
    } catch {
      setError('Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.');
    } finally {
      setIsSending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[28rem] items-center justify-center p-8" role="status">
        <div className="text-center">
          <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-[var(--purple-bright)]" />
          <p className="mt-3 text-sm text-[#b5b1bf]">
            {connectionStatus === 'connecting' ? 'Sichere Verbindung wird aufgebaut …' : 'Unterhaltung wird geladen …'}
          </p>
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
            {error || connectionError || 'Bitte versuche es später erneut.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStatus('loading');
              setAttempt((current) => current + 1);
            }}
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
        {canLoadOlder ? (
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
              <MessageCircle aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--purple-bright)]" />
              <p className="mt-3 font-semibold text-white">Noch keine Nachrichten</p>
              <p className="mt-1 text-sm text-[var(--ink-subtle)]">Du kannst die Unterhaltung hier beginnen.</p>
            </div>
          </div>
        ) : (
          <ol className="space-y-3" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => {
              const isOwnMessage = message.sender.userId === userId;
              return (
                <li key={message.messageId} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 sm:max-w-[72%] ${
                      isOwnMessage
                        ? 'rounded-br-md bg-[var(--action)] text-white'
                        : 'rounded-bl-md border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p>
                    <time
                      dateTime={new Date(message.createdAt).toISOString()}
                      className={`mt-1 block text-[0.7rem] ${isOwnMessage ? 'text-white/70' : 'text-[var(--ink-subtle)]'}`}
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
        <label htmlFor={`${handlerId}-message`} className="sr-only">
          Nachricht an {conversation.title}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`${handlerId}-message`}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={2000}
            rows={2}
            disabled={isSending}
            placeholder="Nachricht schreiben …"
            className="min-h-12 flex-1 resize-none rounded-xl border border-[var(--line-strong)] bg-[var(--canvas)] px-3.5 py-3 text-sm text-white placeholder:text-[var(--ink-subtle)] focus:border-[var(--action)] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || isSending}
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
