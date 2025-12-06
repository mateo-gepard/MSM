'use client';

import { useState, useEffect, useRef } from 'react';
import { useSendbird } from '@/contexts/SendbirdContext';
import { Send, Loader2, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  message: string;
  sender: string;
  timestamp: number;
  isOwn: boolean;
}

interface TutorChatWidgetProps {
  tutorId: string;
  parentId: string;
  parentName: string;
}

export default function TutorChatWidget({ tutorId, parentId, parentName }: TutorChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load or create channel with parent
  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Import Sendbird dynamically
        const { default: SendbirdChat } = await import('@sendbird/chat');
        const { GroupChannelModule } = await import('@sendbird/chat/groupChannel');
        
        const appId = process.env.NEXT_PUBLIC_SENDBIRD_APP_ID;
        if (!appId) {
          throw new Error('Sendbird App ID not configured');
        }
        
        // Initialize Sendbird as tutor
        const sb = SendbirdChat.init({
          appId,
          modules: [new GroupChannelModule()]
        });
        
        // Connect as tutor
        await sb.connect(tutorId);
        console.log('[TutorChat] Connected as tutor:', tutorId);
        
        // Try to find existing channel or create new one
        // Channel URL format: parent_tutor unique identifier
        const channelUrl = `msm_chat_${[parentId, tutorId].sort().join('_')}`;
        
        try {
          // Try to get existing channel
          const existingChannel = await sb.groupChannel.getChannel(channelUrl);
          setChannel(existingChannel);
          console.log('[TutorChat] Found existing channel:', channelUrl);
          
          // Load messages
          const messageList = await existingChannel.getMessagesByTimestamp(Date.now(), {
            prevResultSize: 50,
            nextResultSize: 0
          });
          
          const formattedMessages = messageList.map((msg: any) => ({
            id: msg.messageId?.toString() || String(Date.now()),
            message: msg.message || '',
            sender: msg.sender?.nickname || msg.sender?.userId || 'Unknown',
            timestamp: msg.createdAt || Date.now(),
            isOwn: msg.sender?.userId === tutorId
          }));
          
          setMessages(formattedMessages);
        } catch (channelError) {
          // Channel doesn't exist, create it
          console.log('[TutorChat] Creating new channel with parent:', parentId);
          
          const params = {
            invitedUserIds: [parentId],
            name: `Chat: ${parentName}`,
            channelUrl: channelUrl,
            isDistinct: true,
            operatorUserIds: [tutorId]
          };
          
          const newChannel = await sb.groupChannel.createChannel(params);
          setChannel(newChannel);
          setMessages([]);
          console.log('[TutorChat] Created new channel:', newChannel.url);
        }
        
      } catch (err) {
        console.error('[TutorChat] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chat');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (parentId && tutorId) {
      initializeChat();
    }
  }, [parentId, tutorId, parentName]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !channel) return;
    
    setIsSending(true);
    try {
      const params = {
        message: newMessage.trim()
      };
      
      const sentMessage = await channel.sendUserMessage(params);
      
      // Add to messages list
      setMessages(prev => [...prev, {
        id: sentMessage.messageId?.toString() || String(Date.now()),
        message: sentMessage.message,
        sender: 'Du',
        timestamp: sentMessage.createdAt || Date.now(),
        isOwn: true
      }]);
      
      setNewMessage('');
    } catch (err) {
      console.error('[TutorChat] Send error:', err);
      setError('Nachricht konnte nicht gesendet werden');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Chat wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-white/10 bg-primary-dark/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold">
            {parentName.charAt(0)}
          </div>
          <div>
            <h3 className="text-white font-semibold">{parentName}</h3>
            <p className="text-gray-400 text-sm">Elternteil</p>
          </div>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Noch keine Nachrichten.</p>
            <p className="text-sm mt-1">Schreibe die erste Nachricht!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  msg.isOwn
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-secondary-dark text-gray-100 rounded-bl-md'
                }`}
              >
                <p>{msg.message}</p>
                <p className={`text-xs mt-1 ${msg.isOwn ? 'text-white/60' : 'text-gray-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-primary-dark/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nachricht schreiben..."
            className="flex-1 bg-secondary-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="bg-accent hover:bg-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
