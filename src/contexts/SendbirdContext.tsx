'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import SendbirdChat from '@sendbird/chat';
import { GroupChannelModule } from '@sendbird/chat/groupChannel';

function createChatClient(appId: string) {
  return SendbirdChat.init({
    appId,
    modules: [new GroupChannelModule()],
  });
}

export type SendbirdClient = ReturnType<typeof createChatClient>;

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface TokenResponse {
  data: {
    appId: string;
    userId: string;
    token: string;
    expiresAt: number;
  };
}

interface SendbirdContextValue {
  client: SendbirdClient | null;
  userId: string | null;
  status: ConnectionStatus;
  error: string | null;
  connect: () => Promise<SendbirdClient>;
}

const SendbirdContext = createContext<SendbirdContextValue | null>(null);

function apiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null;
  const error = payload.error;
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  return typeof error.message === 'string' ? error.message : null;
}

async function requestSession(): Promise<TokenResponse['data']> {
  const response = await fetch('/api/chat/token', {
    method: 'POST',
    cache: 'no-store',
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Der Nachrichtenservice antwortet gerade nicht.');
  }

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload) || 'Der Nachrichtenservice ist gerade nicht verfügbar.');
  }

  const session = (payload as Partial<TokenResponse>).data;
  if (
    !session ||
    typeof session.appId !== 'string' ||
    typeof session.userId !== 'string' ||
    typeof session.token !== 'string'
  ) {
    throw new Error('Die sichere Chat-Sitzung konnte nicht gestartet werden.');
  }

  return session;
}

export function SendbirdProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SendbirdClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SendbirdClient | null>(null);
  const pendingConnection = useRef<Promise<SendbirdClient> | null>(null);
  const isMounted = useRef(true);

  const connect = useCallback(async (): Promise<SendbirdClient> => {
    if (clientRef.current?.currentUser) return clientRef.current;
    if (pendingConnection.current) return pendingConnection.current;

    setStatus('connecting');
    setError(null);

    const connection = (async () => {
      const session = await requestSession();
      const nextClient = createChatClient(session.appId);

      try {
        await nextClient.connect(session.userId, session.token);
      } catch {
        await nextClient.disconnect().catch(() => undefined);
        throw new Error('Die sichere Verbindung konnte nicht hergestellt werden.');
      }

      if (!isMounted.current) {
        await nextClient.disconnect().catch(() => undefined);
        throw new Error('Die Chat-Ansicht wurde geschlossen.');
      }

      clientRef.current = nextClient;
      setClient(nextClient);
      setUserId(session.userId);
      setStatus('connected');
      return nextClient;
    })();

    pendingConnection.current = connection;

    try {
      return await connection;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Der Nachrichtenservice ist gerade nicht verfügbar.';
      if (isMounted.current) {
        setStatus('error');
        setError(message);
      }
      throw caughtError;
    } finally {
      pendingConnection.current = null;
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      const activeClient = clientRef.current;
      clientRef.current = null;
      if (activeClient) void activeClient.disconnect();
    };
  }, []);

  return (
    <SendbirdContext.Provider value={{ client, userId, status, error, connect }}>
      {children}
    </SendbirdContext.Provider>
  );
}

export function useSendbird(): SendbirdContextValue {
  const context = useContext(SendbirdContext);
  if (!context) throw new Error('useSendbird must be used within SendbirdProvider');
  return context;
}
