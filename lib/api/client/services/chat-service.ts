/**
 * Chat service implementation
 */
import type { HttpClient, RequestParams } from "../models/http-client";
import { ContentType } from "../models/http-client"
import type { 
  ChatMode, 
  MessageMetadata 
} from '../models/data-contracts';
import { 
  ChatMessage 
} from '../models/data-contracts'

export class Chat<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http
  }

  /**
   * Send a message in a chat
   */
  sendMessage = (
    data: {
      message: string
      chatId?: string
      options?: {
        isCorrection?: boolean
        metadata?: MessageMetadata
      }
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/chat`,
      method: 'POST',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Get chat history
   */
  getChatHistory = (
    chatId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/chat/${chatId}`,
      method: 'GET',
      format: 'json',
      ...params,
    })
  }

  /**
   * Start a new chat
   */
  startChat = (
    data?: {
      mode?: ChatMode
      initialMessage?: string
      metadata?: Record<string, any>
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/chat`,
      method: 'PUT',
      body: data || {},
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Get message by ID
   */
  getMessage = (
    messageId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/chat/message/${messageId}`,
      method: 'GET',
      format: 'json',
      ...params,
    })
  }

  /**
   * Delete chat
   */
  deleteChat = (
    chatId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/chat/${chatId}`,
      method: 'DELETE',
      format: 'json',
      ...params,
    })
  }

  /**
   * Upload chat attachment
   */
  uploadAttachment = (
    data: {
      file: File
      chatId: string
      messageId?: string
      metadata?: Record<string, any>
    },
    params: RequestParams = {},
  ) => {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('chatId', data.chatId)
    
    if (data.messageId) {
      formData.append('messageId', data.messageId)
    }
    
    if (data.metadata) {
      formData.append('metadata', JSON.stringify(data.metadata))
    }

    return this.http.request({
      path: `/chat/${data.chatId}/attachment`,
      method: 'POST',
      body: formData,
      type: ContentType.FormData,
      format: 'json',
      ...params,
    })
  }
}