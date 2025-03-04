/**
 * Chat Type Schemas
 *
 * Zod schemas and type definitions for chat functionality
 */
import { z } from 'zod'
import type { UUID } from '@/lib/types/base'

/**
 * Chat message type enum
 */
export const ChatMessageTypeSchema = z.enum([
  'chat',
  'system',
  'error',
  'progress',
  'verification_request',
  'summary',
  'correction',
  'research',
  'report'
])

export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>

/**
 * Message metadata schema
 */
export const MessageMetadataSchema = z.object({
  /**
   * Message type
   */
  type: ChatMessageTypeSchema.optional(),
  
  // Legacy support - these will be migrated to the type field
  isSystem: z.boolean().optional(),
  isVerificationRequest: z.boolean().optional(),
  isSummary: z.boolean().optional(),
  isCorrection: z.boolean().optional(),
  isProgress: z.boolean().optional(),
  isResearch: z.boolean().optional(),
  isReport: z.boolean().optional(),
  isError: z.boolean().optional(),
  
  // Additional metadata fields
  documentId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  timestamp: z.date().or(z.string().datetime()).optional(),
  
  // Allow additional properties
}).passthrough()

export type MessageMetadata = z.infer<typeof MessageMetadataSchema>

/**
 * Chat message schema
 */
export const ChatMessageSchema = z.object({
  /**
   * Message ID
   */
  id: z.string(),
  
  /**
   * Message content
   */
  content: z.string(),
  
  /**
   * Message role
   */
  role: z.enum(['user', 'assistant', 'system']),
  
  /**
   * Creation timestamp
   */
  createdAt: z.date().or(z.string().datetime()).optional(),
  
  /**
   * Message metadata
   */
  metadata: MessageMetadataSchema.optional()
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

/**
 * Chat state schema
 */
export const ChatStateSchema = z.object({
  /**
   * Chat ID
   */
  id: z.string().uuid(),
  
  /**
   * Chat title
   */
  title: z.string().optional(),
  
  /**
   * Chat creation timestamp
   */
  createdAt: z.date().or(z.string().datetime()),
  
  /**
   * Chat update timestamp
   */
  updatedAt: z.date().or(z.string().datetime()).optional(),
  
  /**
   * User ID who owns the chat
   */
  userId: z.string().uuid(),
  
  /**
   * Messages in the chat
   */
  messages: z.array(ChatMessageSchema),
  
  /**
   * Chat metadata
   */
  metadata: z.record(z.unknown()).optional(),
  
  /**
   * Patient ID if this chat is related to a patient
   */
  patientId: z.string().uuid().optional(),
  
  /**
   * Workflow ID if this chat is part of a workflow
   */
  workflowId: z.string().uuid().optional(),
  
  /**
   * Is the chat active/open
   */
  isActive: z.boolean().optional()
})

export type ChatState = z.infer<typeof ChatStateSchema>

/**
 * Chat creation schema
 */
export const CreateChatSchema = z.object({
  /**
   * Chat title (optional)
   */
  title: z.string().optional(),
  
  /**
   * Initial message (optional)
   */
  initialMessage: z.string().optional(),
  
  /**
   * Chat metadata
   */
  metadata: z.record(z.unknown()).optional(),
  
  /**
   * Patient ID
   */
  patientId: z.string().uuid().optional(),
  
  /**
   * Workflow ID
   */
  workflowId: z.string().uuid().optional()
})

export type CreateChatParams = z.infer<typeof CreateChatSchema>

/**
 * Message creation schema
 */
export const CreateMessageSchema = z.object({
  /**
   * Message content
   */
  content: z.string().min(1, "Message content cannot be empty"),
  
  /**
   * Message role
   */
  role: z.enum(['user', 'assistant', 'system']),
  
  /**
   * Message metadata
   */
  metadata: MessageMetadataSchema.optional()
})

export type CreateMessageParams = z.infer<typeof CreateMessageSchema>

/**
 * Validate chat parameters
 * 
 * @param data Unknown data to validate
 * @returns Validated CreateChatParams
 */
export function validateCreateChatParams(data: unknown): CreateChatParams {
  const result = CreateChatSchema.safeParse(data)
  
  if (!result.success) {
    throw new Error(`Invalid chat creation parameters: ${result.error.message}`)
  }
  
  return result.data
}

/**
 * Validate message parameters
 * 
 * @param data Unknown data to validate
 * @returns Validated CreateMessageParams
 */
export function validateCreateMessageParams(data: unknown): CreateMessageParams {
  const result = CreateMessageSchema.safeParse(data)
  
  if (!result.success) {
    throw new Error(`Invalid message parameters: ${result.error.message}`)
  }
  
  return result.data
}