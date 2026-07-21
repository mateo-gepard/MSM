'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { SendbirdProvider } from '@/contexts/SendbirdContext';
import { ChatPanel, type ChatConversation } from './ChatPanel';

interface MessagesWorkspaceProps {
  conversations: ChatConversation[];
  emptyTitle: string;
  emptyDescription: string;
}

export function MessagesWorkspace({
  conversations,
  emptyTitle,
  emptyDescription,
}: MessagesWorkspaceProps) {
  const [selectedKey, setSelectedKey] = useState(conversations[0]?.key ?? '');
  const selectedConversation =
    conversations.find((conversation) => conversation.key === selectedKey) ?? conversations[0] ?? null;

  if (!selectedConversation) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
        <MessageCircle aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--purple-bright)]" />
        <h3 className="mt-4 font-bold text-white">{emptyTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ink-muted)]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <SendbirdProvider>
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-[var(--line)] bg-[var(--canvas-soft)] md:border-b-0 md:border-r" aria-label="Unterhaltungen">
          <div className="border-b border-[var(--line)] px-4 py-4">
            <h3 className="text-sm font-bold text-white">Unterhaltungen</h3>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">
              {conversations.length} {conversations.length === 1 ? 'Kontakt' : 'Kontakte'}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto p-2 md:block md:max-h-[34rem] md:space-y-1 md:overflow-y-auto">
            {conversations.map((conversation) => (
              <button
                key={conversation.key}
                type="button"
                aria-pressed={conversation.key === selectedConversation.key}
                onClick={() => setSelectedKey(conversation.key)}
                className="min-w-48 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5 aria-pressed:bg-[var(--surface-raised)] md:min-w-0 md:w-full"
              >
                <span className="block truncate text-sm font-bold text-white">{conversation.title}</span>
                <span className="mt-1 block truncate text-xs text-[var(--ink-subtle)]">{conversation.description}</span>
              </button>
            ))}
          </div>
        </aside>
        <ChatPanel key={selectedConversation.key} conversation={selectedConversation} />
      </div>
    </SendbirdProvider>
  );
}
