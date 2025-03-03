import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { Message } from '@/lib/chat/types'

/**
 * Service for managing chat persistence and retrieval
 */
export class ChatService {
  private supabase: SupabaseClient<Database>

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }

  /**
   * Create a new chat session
   */
  async createChat(
    userId: string,
    initialMetadata: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString()
      
      const { data, error } = await this.supabase
        .from('chats')
        .insert({
          user_id: userId,
          metadata: {
            ...initialMetadata,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .select('id')
        .single()

      if (error || !data) {
        console.error('Error creating chat:', error)
        return null
      }

      return data.id
    } catch (error) {
      console.error('Failed to create chat:', error)
      throw error
    }
  }

  /**
   * Save a message to the database
   */
  async saveMessage(message: Message, chatId: string): Promise<string | null> {
    try {
      if (!chatId) return null

      const { data, error } = await this.supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          role: message.role,
          content: message.content,
          metadata: message.metadata || {},
          created_at: message.createdAt?.toISOString() || new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error || !data) {
        console.error('Error saving message:', error)
        return null
      }

      // Update chat's last activity timestamp
      await this.updateChatLastActivity(chatId)

      return data.id
    } catch (error) {
      console.error('Failed to save message:', error)
      throw error
    }
  }

  /**
   * Save multiple messages in a batch
   */
  async saveMessages(messages: Message[], chatId: string): Promise<number> {
    try {
      if (!chatId || !messages.length) return 0

      const messagesToInsert = messages.map(msg => ({
        chat_id: chatId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {},
        created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
      }))

      const { data, error } = await this.supabase
        .from('chat_messages')
        .insert(messagesToInsert)
        .select('id')

      if (error) {
        console.error('Error saving messages batch:', error)
        return 0
      }

      // Update chat's last activity timestamp
      await this.updateChatLastActivity(chatId)

      return data?.length || 0
    } catch (error) {
      console.error('Failed to save messages batch:', error)
      throw error
    }
  }

  /**
   * Get all messages for a chat
   */
  async getChatMessages(chatId: string): Promise<Message[]> {
    try {
      if (!chatId) return []

      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching chat messages:', error)
        return []
      }

      return (data || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),
        metadata: msg.metadata,
      }))
    } catch (error) {
      console.error('Failed to fetch chat messages:', error)
      throw error
    }
  }

  /**
   * Update chat's last activity timestamp
   */
  async updateChatLastActivity(chatId: string): Promise<void> {
    try {
      if (!chatId) return

      await this.supabase
        .from('chats')
        .update({
          last_activity_at: new Date().toISOString()
        })
        .eq('id', chatId)
    } catch (error) {
      console.error('Failed to update chat last activity:', error)
      // Don't throw here as this is an auxiliary operation
    }
  }

  /**
   * Update chat metadata
   */
  async updateChatMetadata(
    chatId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      if (!chatId) return

      // First get existing metadata
      const { data: existingData, error: fetchError } = await this.supabase
        .from('chats')
        .select('metadata')
        .eq('id', chatId)
        .single()

      if (fetchError) {
        console.error('Error fetching existing chat metadata:', fetchError)
        return
      }

      const existingMetadata = existingData?.metadata || {}
      
      // Merge with new metadata
      await this.supabase
        .from('chats')
        .update({
          metadata: {
            ...existingMetadata,
            ...metadata,
            updatedAt: new Date().toISOString()
          },
          last_activity_at: new Date().toISOString()
        })
        .eq('id', chatId)
    } catch (error) {
      console.error('Failed to update chat metadata:', error)
      throw error
    }
  }

  /**
   * Archive a chat
   */
  async archiveChat(chatId: string): Promise<void> {
    try {
      if (!chatId) return

      await this.supabase
        .from('chats')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('id', chatId)
    } catch (error) {
      console.error('Failed to archive chat:', error)
      throw error
    }
  }

  /**
   * Delete a chat and its messages
   */
  async deleteChat(chatId: string): Promise<void> {
    try {
      if (!chatId) return

      // First delete all messages in the chat
      await this.supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId)

      // Then delete the chat itself
      await this.supabase
        .from('chats')
        .delete()
        .eq('id', chatId)
    } catch (error) {
      console.error('Failed to delete chat:', error)
      throw error
    }
  }

  /**
   * Update a specific message
   */
  async updateMessage(
    messageId: string,
    updates: Partial<Omit<Message, 'id'>>
  ): Promise<void> {
    try {
      if (!messageId) return

      const updateObject: Record<string, any> = {}

      if (updates.content !== undefined) {
        updateObject.content = updates.content
      }

      if (updates.metadata !== undefined) {
        // Get current metadata first to merge
        const { data: currentMessage, error: fetchError } = await this.supabase
          .from('chat_messages')
          .select('metadata')
          .eq('id', messageId)
          .single()

        if (fetchError) {
          console.error('Error fetching message metadata:', fetchError)
        } else {
          updateObject.metadata = {
            ...(currentMessage?.metadata || {}),
            ...updates.metadata
          }
        }
      }

      if (Object.keys(updateObject).length > 0) {
        await this.supabase
          .from('chat_messages')
          .update(updateObject)
          .eq('id', messageId)
      }
    } catch (error) {
      console.error('Failed to update message:', error)
      throw error
    }
  }

  /**
   * Search for messages with specific content
   */
  async searchMessages(
    query: string,
    chatId?: string,
    limit = 20
  ): Promise<Message[]> {
    try {
      let supabaseQuery = this.supabase
        .from('chat_messages')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (chatId) {
        supabaseQuery = supabaseQuery.eq('chat_id', chatId)
      }

      const { data, error } = await supabaseQuery

      if (error) {
        console.error('Error searching messages:', error)
        return []
      }

      return (data || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),
        metadata: msg.metadata,
      }))
    } catch (error) {
      console.error('Failed to search messages:', error)
      throw error
    }
  }
}

// Export singleton instance
export const chatService = new ChatService()