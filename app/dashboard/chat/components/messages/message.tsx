'use client';

import { useChat } from '@/contexts/chat-context';
import type { Message as MessageType } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const { verifyData } = useChat();

  const isAssistant = message.role === 'assistant';
  const isVerifiable = isAssistant && message.metadata?.type === 'verification';
  const verificationStatus = message.metadata?.verificationStatus;

  const handleVerify = () => {
    if (!isVerifiable) return;
    
    verifyData(message.id, {
      isVerified: true,
      verifiedAt: new Date()
    });
  };

  const handleCorrect = () => {
    if (!isVerifiable) return;
    // TODO: Implement correction UI
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg p-4',
        isAssistant ? 'bg-secondary' : 'bg-primary/10'
      )}
    >
      {/* Message Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {isAssistant ? 'Assistant' : 'You'}
        </span>
        <span className="text-muted-foreground text-xs">
          {new Date(message.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Message Content */}
      <div className="prose dark:prose-invert max-w-none">
        {message.content}
      </div>

      {/* Verification UI */}
      {isVerifiable && (
        <div className="mt-2 flex items-center gap-2">
          {verificationStatus?.isVerified ? (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <span>✓ Verified</span>
              {verificationStatus.verifiedAt && (
                <span className="text-muted-foreground text-xs">
                  at {new Date(verificationStatus.verifiedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700"
                onClick={handleVerify}
              >
                Verify
              </button>
              <button
                className="rounded bg-yellow-600 px-2 py-1 text-sm text-white hover:bg-yellow-700"
                onClick={handleCorrect}
              >
                Needs Correction
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metadata Display */}
      {message.metadata?.confidence && (
        <div className="text-muted-foreground mt-1 text-xs">
          Confidence: {(message.metadata.confidence * 100).toFixed(1)}%
        </div>
      )}
      
      {message.metadata?.sources && message.metadata.sources.length > 0 && (
        <div className="text-muted-foreground mt-1 text-xs">
          Sources: {message.metadata.sources.join(', ')}
        </div>
      )}
    </div>
  );
} 