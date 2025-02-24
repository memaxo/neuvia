'use client';

import { useRef, useEffect } from 'react';

import type { Message as MessageType } from '@lib/chat/types';

import { Message } from './message';


interface MessageListProps {
  messages: MessageType[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">
          <p>No messages yet. Start a conversation!</p>
        </div>
      ) : (
        messages.map((message) => (
          <Message key={message.id} message={message} />
        ))
      )}
      
      {isLoading && (
        <div className="text-muted-foreground flex animate-pulse items-center gap-2">
          <div className="size-2 rounded-full bg-current" />
          <div className="animation-delay-200 size-2 rounded-full bg-current" />
          <div className="animation-delay-400 size-2 rounded-full bg-current" />
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
} 