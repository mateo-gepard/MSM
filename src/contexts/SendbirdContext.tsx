'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initSendbird, disconnectSendbird } from '@/lib/sendbird';
import { useAuth } from '@/hooks/useAuth';

interface SendbirdContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

const SendbirdContext = createContext<SendbirdContextType | undefined>(undefined);

export function SendbirdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedUserId, setConnectedUserId] = useState<string | null>(null);

  useEffect(() => {
    // Only connect if user is logged in and Sendbird is configured
    if (!user) {
      console.log('[SendbirdContext] No user, skipping connection');
      setIsConnected(false);
      setConnectedUserId(null);
      return;
    }

    // Don't reconnect if already connected to the same user
    if (isConnected && connectedUserId === user.id) {
      console.log('[SendbirdContext] Already connected to this user, skipping...');
      return;
    }

    // Don't connect if already connecting
    if (isConnecting) {
      console.log('[SendbirdContext] Connection in progress, skipping...');
      return;
    }

    const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
    console.log('[SendbirdContext] Checking Sendbird App ID:', appId ? `Found: ${appId}` : 'NOT FOUND');
    
    if (!appId) {
      const errorMsg = 'Sendbird App ID not configured. Check NEXT_PUBLIC_SENDBIRD_APP_ID in .env.local';
      console.error('[SendbirdContext]', errorMsg);
      setError(errorMsg);
      return;
    }

    const connectToSendbird = async () => {
      console.log('[SendbirdContext] Starting connection for user:', user.id);
      setIsConnecting(true);
      setError(null);

      try {
        const nickname = user.user_metadata?.full_name || user.email || 'User';
        console.log('[SendbirdContext] Connecting with userId:', user.id, 'nickname:', nickname);
        
        await initSendbird(user.id, nickname);
        
        console.log('[SendbirdContext] ✅ Connected successfully!');
        setIsConnected(true);
        setConnectedUserId(user.id);
      } catch (err) {
        console.error('[SendbirdContext] ❌ Connection failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to chat service');
        setIsConnected(false);
        setConnectedUserId(null);
      } finally {
        setIsConnecting(false);
      }
    };

    connectToSendbird();

    // Only cleanup on unmount, not on every re-render
    return () => {
      // Only disconnect if component is actually unmounting
      // This prevents disconnect on every re-render
    };
  }, [user?.id]); // Use user.id instead of user object to prevent unnecessary re-renders

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      console.log('[SendbirdContext] Component unmounting, disconnecting...');
      disconnectSendbird();
    };
  }, []);

  return (
    <SendbirdContext.Provider value={{ isConnected, isConnecting, error }}>
      {children}
    </SendbirdContext.Provider>
  );
}

export function useSendbird() {
  const context = useContext(SendbirdContext);
  if (context === undefined) {
    throw new Error('useSendbird must be used within SendbirdProvider');
  }
  return context;
}
