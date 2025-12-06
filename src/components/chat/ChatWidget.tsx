'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { createParentTutorChannel, sendMessage, getMessages } from '@/lib/sendbird';
import { useSendbird } from '@/contexts/SendbirdContext';
import { Button } from '@/components/ui/Button';

interface Message {
  messageId: number;
  message: string;
  createdAt: number;
  sender?: {
    userId: string;
    nickname: string;
  };
}

interface ChatWidgetProps {
  tutorId: string;
  tutorName: string;
  parentId: string;
}

export default function ChatWidget({ tutorId, tutorName, parentId }: ChatWidgetProps) {
  const { isConnected, isConnecting, error } = useSendbird();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [channelUrl, setChannelUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if tutorId is valid
  if (!tutorId || tutorId === 'null' || tutorId === 'undefined') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-gray-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-semibold mb-2">Chat nicht verfügbar</p>
          <p className="text-sm">
            Für diese Buchung ist kein Tutor zugewiesen. Bitte kontaktiere den Support.
          </p>
        </div>
      </div>
    );
  }

  // Auto-scroll to bottom only when shouldAutoScroll is true (after sending a message)
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShouldAutoScroll(false);
    }
  }, [shouldAutoScroll, messages]);

  // Initialize channel when Sendbird is connected
  useEffect(() => {
    if (!isConnected) return;

    const initChannel = async () => {
      setIsLoading(true);
      try {
        const url = await createParentTutorChannel(parentId, tutorId, tutorName);
        setChannelUrl(url);
        
        // Load initial messages
        const initialMessages = await getMessages(url);
        setMessages(initialMessages as Message[]);
      } catch (error) {
        console.error('Failed to initialize chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initChannel();
  }, [isConnected, parentId, tutorId, tutorName]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!channelUrl) return;

    const interval = setInterval(async () => {
      try {
        const latestMessages = await getMessages(channelUrl);
        setMessages(latestMessages as Message[]);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [channelUrl]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !channelUrl || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(channelUrl, newMessage.trim());
      setNewMessage('');
      
      // Immediately fetch updated messages
      const updatedMessages = await getMessages(channelUrl);
      setMessages(updatedMessages as Message[]);
      
      // Trigger auto-scroll after sending a message
      setShouldAutoScroll(true);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-primary-dark/30">
        <div className="text-center space-y-3 p-6 max-w-md">
          {isConnecting ? (
            <>
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-accent" />
              <p className="text-sm text-gray-400">Verbinde mit Chat-Server...</p>
              <p className="text-xs text-gray-500">Dies kann einige Sekunden dauern</p>
            </>
          ) : (
            <>
              <MessageCircle className="w-12 h-12 mx-auto text-gray-600" />
              <p className="text-sm font-semibold text-white">Chat nicht verbunden</p>
              <div className="text-xs text-gray-400 space-y-2">
                {error ? (
                  <p className="text-red-400 font-medium">{error}</p>
                ) : (
                  <p>Sendbird Chat ist nicht konfiguriert oder nicht erreichbar.</p>
                )}
                <div className="mt-4 p-3 bg-secondary-dark/50 rounded-lg text-left space-y-1">
                  <p className="text-white font-medium mb-2">Debugging-Schritte:</p>
                  <p>1. Überprüfe Browser Console (F12) für Details</p>
                  <p>2. App ID: {process.env.NEXT_PUBLIC_SENDBIRD_APP_ID ? '✅ Konfiguriert' : '❌ Fehlt'}</p>
                  <p>3. Versuche Browser neu zu laden</p>
                  <p>4. Stelle sicher, dass der Server läuft</p>
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors text-sm"
              >
                Seite neu laden
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-secondary-dark/50 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <h3 className="font-semibold text-white">{tutorName}</h3>
        <p className="text-xs text-gray-400">Antwortet normalerweise innerhalb 1 Stunde</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-primary-dark/30">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Noch keine Nachrichten. Starte ein Gespräch!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.sender?.userId === parentId;
            return (
              <motion.div
                key={msg.messageId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                    isOwnMessage
                      ? 'bg-accent-purple text-white'
                      : 'bg-secondary-dark/70 text-gray-200'
                  }`}
                >
                  {!isOwnMessage && (
                    <p className="text-xs text-gray-400 mb-1">{msg.sender?.nickname}</p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="bg-secondary-dark/50 backdrop-blur-md border-t border-white/10 p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Schreibe eine Nachricht..."
            disabled={isSending}
            className="flex-1 bg-primary-dark/50 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="px-4"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
