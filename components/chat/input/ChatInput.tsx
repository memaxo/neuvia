'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PreviewAttachment } from '../ui/preview-attachment'
import {
  ArrowUp,
  Paperclip,
  Search,
  SendIcon,
  Square,
  Telescope,
} from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type Attachment = {
  url: string
  name: string
  contentType: string
}

export type SearchMode = 'search' | 'deep-research' | undefined

export interface ChatInputProps {
  /** Event handler for sending a message */
  onSendMessage: (message: string, options?: any) => void
  /** Whether the input is disabled */
  isDisabled?: boolean
  /** Placeholder text for the input */
  placeholder?: string
  /** Additional class names for the textarea */
  className?: string
  /** Whether the input is loading/processing a request */
  isLoading?: boolean
  /** Function to stop a generating response */
  onStop?: () => void
  /** Whether to show file attachments UI */
  allowAttachments?: boolean
  /** Current attachments */
  attachments?: Attachment[]
  /** Handler for attachment changes */
  onAttachmentsChange?: (attachments: Attachment[]) => void
  /** Whether to show search mode toggle */
  allowSearchMode?: boolean
  /** Current search mode */
  searchMode?: SearchMode
  /** Handler for search mode changes */
  onSearchModeChange?: (mode: SearchMode) => void
  /** Auto-focus the input on mount */
  autoFocus?: boolean
}

export function ChatInput({
  onSendMessage,
  isDisabled = false,
  placeholder = 'Type a message...',
  className,
  isLoading = false,
  onStop,
  allowAttachments = false,
  attachments = [],
  onAttachmentsChange,
  allowSearchMode = false,
  searchMode,
  onSearchModeChange,
  autoFocus = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadQueue, setUploadQueue] = useState<string[]>([])
  const [internalAttachments, setInternalAttachments] = useState<Attachment[]>(attachments)
  const [internalSearchMode, setInternalSearchMode] = useState<SearchMode>(searchMode)

  // Keep internal state in sync with props
  useEffect(() => {
    setInternalAttachments(attachments)
  }, [attachments])

  useEffect(() => {
    setInternalSearchMode(searchMode)
  }, [searchMode])

  // Auto-resize the textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = `${scrollHeight}px`
    }
  }, [message])

  // Auto-focus the textarea if specified
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])

  const handleSubmit = useCallback((e?: FormEvent) => {
    e?.preventDefault()
    
    if (!message.trim() && internalAttachments.length === 0) return
    if (isDisabled || isLoading) return
    
    // Prepare options object based on available features
    const options: Record<string, any> = {}
    
    // Add attachments if enabled
    if (allowAttachments && internalAttachments.length > 0) {
      options.attachments = internalAttachments
    }
    
    // Add search mode if enabled
    if (allowSearchMode && internalSearchMode) {
      options.searchMode = internalSearchMode
      options.experimental_deepResearch = internalSearchMode === 'deep-research'
    }
    
    // Send the message
    onSendMessage(message, options)
    
    // Reset state
    setMessage('')
    if (!onAttachmentsChange) {
      setInternalAttachments([])
    }
    resetHeight()
    
    // Focus back on the textarea
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }, [
    message,
    isDisabled,
    isLoading,
    allowAttachments,
    internalAttachments,
    allowSearchMode,
    internalSearchMode,
    onSendMessage,
    onAttachmentsChange,
    resetHeight
  ])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!allowAttachments) return
    
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    
    // Add to upload queue for UI indication
    setUploadQueue(files.map(file => file.name))
    
    // Use a mock upload function for now - in real implementation you'd call your API
    const uploadFile = async (file: File): Promise<Attachment | undefined> => {
      try {
        // This simulates an API call - replace with your actual upload logic
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Simulate successful upload
        return {
          url: URL.createObjectURL(file), // In a real app, this would be the server URL
          name: file.name,
          contentType: file.type
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`)
        return undefined
      }
    }
    
    try {
      // Upload all files in parallel
      const uploadPromises = files.map(file => uploadFile(file))
      const uploadedAttachments = await Promise.all(uploadPromises)
      const successfullyUploadedAttachments = uploadedAttachments.filter(
        attachment => attachment !== undefined
      ) as Attachment[]
      
      // Update attachments
      const newAttachments = [...internalAttachments, ...successfullyUploadedAttachments]
      
      if (onAttachmentsChange) {
        onAttachmentsChange(newAttachments)
      } else {
        setInternalAttachments(newAttachments)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Failed to upload files')
    } finally {
      setUploadQueue([])
    }
    
    // Reset the file input
    if (event.target) {
      event.target.value = ''
    }
  }, [allowAttachments, internalAttachments, onAttachmentsChange])

  const handleRemoveAttachment = useCallback((index: number) => {
    const newAttachments = [...internalAttachments]
    newAttachments.splice(index, 1)
    
    if (onAttachmentsChange) {
      onAttachmentsChange(newAttachments)
    } else {
      setInternalAttachments(newAttachments)
    }
  }, [internalAttachments, onAttachmentsChange])

  const handleSearchModeChange = useCallback((mode: SearchMode) => {
    if (onSearchModeChange) {
      onSearchModeChange(mode)
    } else {
      setInternalSearchMode(mode)
    }
  }, [onSearchModeChange])

  return (
    <form className="relative" onSubmit={handleSubmit}>
      {/* File input (hidden) */}
      {allowAttachments && (
        <input
          className="pointer-events-none fixed -left-4 -top-4 size-0.5 opacity-0"
          multiple
          onChange={handleFileChange}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      )}
      
      {/* Attachments display area */}
      {allowAttachments && (internalAttachments.length > 0 || uploadQueue.length > 0) && (
        <div className="mb-2 flex flex-row items-end gap-2 overflow-x-auto">
          {internalAttachments.map((attachment, index) => (
            <PreviewAttachment
              attachment={attachment}
              key={`${attachment.name}-${index}`}
              onRemove={() => handleRemoveAttachment(index)}
            />
          ))}
          
          {uploadQueue.map((filename) => (
            <PreviewAttachment
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
              key={filename}
            />
          ))}
        </div>
      )}
      
      <div className="relative flex items-end gap-2">
        {/* Bottom toolbar: attachments button and search mode toggle */}
        {(allowAttachments || allowSearchMode) && (
          <div className="absolute bottom-0 left-0 flex flex-row items-center justify-start gap-2 p-2">
            {/* Attachments button */}
            {allowAttachments && (
              <Button
                className="h-fit rounded-md p-[7px] hover:bg-zinc-200 dark:border-zinc-700 hover:dark:bg-zinc-900"
                disabled={isDisabled || isLoading}
                onClick={(e) => {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }}
                variant="ghost"
              >
                <Paperclip size={14} />
              </Button>
            )}
            
            {/* Search mode toggle */}
            {allowSearchMode && (
              <Tabs
                onValueChange={(value) => {
                  handleSearchModeChange(value as SearchMode)
                }}
                value={internalSearchMode}
              >
                <TabsList className="h-fit rounded-full border bg-transparent p-1">
                  <TabsTrigger
                    className="flex h-fit items-center gap-2 rounded-full border-0 px-3 py-1.5 transition-colors hover:bg-orange-50/50 data-[state=active]:bg-orange-50 data-[state=inactive]:bg-transparent data-[state=active]:text-orange-600 data-[state=active]:shadow-none"
                    value="search"
                  >
                    <Search size={14} />
                    Search
                  </TabsTrigger>
                  <TabsTrigger
                    className="flex h-fit items-center gap-2 rounded-full border-0 px-3 py-1.5 transition-colors hover:bg-orange-50/50 data-[state=active]:bg-orange-50 data-[state=inactive]:bg-transparent data-[state=active]:text-orange-600 data-[state=active]:shadow-none"
                    value="deep-research"
                  >
                    <Telescope size={14} />
                    Deep Research
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        )}
        
        {/* Main input area */}
        <div className={cn("relative flex-1", allowAttachments && "ml-2")}>
          <Textarea
            className={cn(
              "max-h-[200px] min-h-[50px] resize-none py-3 pr-10",
              allowSearchMode && "pb-10", // Extra padding when search mode is enabled
              className
            )}
            disabled={isDisabled || isLoading}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            ref={textareaRef}
            style={{ height: 'auto' }}
            value={message}
          />
        </div>
        
        {/* Send/Stop button */}
        <div className="absolute bottom-2 right-2">
          {isLoading ? (
            <Button
              className="h-fit rounded-full border p-1.5 dark:border-zinc-600"
              onClick={(e) => {
                e.preventDefault()
                onStop?.()
              }}
              type="button"
            >
              <Square size={14} />
            </Button>
          ) : (
            <Button
              className="h-fit rounded-full border p-1.5 dark:border-zinc-600"
              disabled={
                isDisabled ||
                (message.trim() === '' && internalAttachments.length === 0) ||
                uploadQueue.length > 0
              }
              type="submit"
            >
              <ArrowUp size={14} />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}