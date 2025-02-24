export type ChatMode = 'regular' | 'verification';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: {
    type?: 'verification';
    confidence?: number;
    verificationStatus?: VerificationStatus;
  };
}

export interface VerificationStatus {
  isVerified: boolean;
  verifiedAt: Date;
  corrections?: Record<string, string>;
}

export interface ChatState {
  mode: ChatMode;
  messages: Message[];
  isLoading: boolean;
  error?: string;
}

export interface ChatContextType {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  setMode: (mode: ChatMode) => void;
  verifyData: (messageId: string, status: VerificationStatus) => void;
  clearChat: () => void;
}

export interface ChatProps {
  patientId: string;
  initialMode?: ChatMode;
  isReadOnly?: boolean;
} 