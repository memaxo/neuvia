'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'

import { ChatProvider } from '@/lib/stores/chat-store'

import { ChatErrorBoundary } from './components/chat-error-boundary'
import { ChatInterface } from './components/chat-interface'
import { ChatLoading } from './components/chat-loading'

// Valid chat modes for type safety
type ChatMode = 'regular' | 'verification'

// Validation function for patient ID
function isValidPatientId(id: string): boolean {
  // Add your validation logic here
  // Example: UUID format or specific pattern
  return id.length > 0 && id.length <= 50 && /^[a-zA-Z0-9-_]+$/.test(id)
}

interface ChatPageProps {
  params: {
    patientId?: string
  }
}

export default function ChatPage() {
  const params = useParams()

  // Patient ID validation and resolution
  const patientId = (() => {
    const rawId =
      typeof params?.patientId === 'string' ? params.patientId : 'default'
    return isValidPatientId(rawId) ? rawId : 'default'
  })()

  // Initial mode with type safety
  const initialMode: ChatMode = 'regular'

  return (
    <ChatErrorBoundary>
      <Suspense fallback={<ChatLoading />}>
        <ChatProvider>
          <div className="flex h-full flex-col">
            <ChatInterface initialMode={initialMode} patientId={patientId} />
          </div>
        </ChatProvider>
      </Suspense>
    </ChatErrorBoundary>
  )
}