'use client'

import { FileText, Upload, X } from 'lucide-react'
import Image from 'next/image'
import * as React from 'react'
import Dropzone, {
  type DropzoneProps,
  type FileRejection,
} from 'react-dropzone'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatBytes } from '@/lib/utils'

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Value of the uploader.
   * @type File[]
   * @default undefined
   */
  value?: File[]

  /**
   * Function to be called when the value changes.
   * @type (files: File[]) => void
   * @default undefined
   */
  onValueChange?: (files: File[]) => void

  /**
   * Function to be called when files are uploaded.
   * @type (files: File[], progressCallback: (progress: number, file: File) => void) => Promise<void>
   * @default undefined
   */
  onUpload?: (files: File[], progressCallback: (progress: number, file: File) => void) => Promise<void>

  /**
   * Progress of the uploaded files.
   * @type Record<string, number> | undefined
   * @default undefined
   */
  progresses?: Record<string, number>

  /**
   * Accepted file types for the uploader.
   * @type { [key: string]: string[]}
   * @default { "image/*": [] }
   */
  accept?: DropzoneProps['accept']

  /**
   * Maximum file size for the uploader.
   * @type number | undefined
   * @default 1024 * 1024 * 2 // 2MB
   */
  maxSize?: DropzoneProps['maxSize']

  /**
   * Maximum number of files for the uploader.
   * @type number | undefined
   * @default 1
   */
  maxFileCount?: DropzoneProps['maxFiles']

  /**
   * Whether the uploader should accept multiple files.
   * @type boolean
   * @default false
   */
  multiple?: boolean

  /**
   * Whether the uploader is disabled.
   * @type boolean
   * @default false
   */
  disabled?: boolean
}

export function FileUploader({
  value,
  onValueChange,
  onUpload,
  progresses,
  accept = {
    'image/*': [],
  },
  maxSize = 1024 * 1024 * 2,
  maxFileCount = 1,
  multiple = false,
  disabled = false,
  className,
  ...props
}: FileUploaderProps) {
  const [files, setFiles] = React.useState<File[]>(value || [])

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      setFiles(value)
    }
  }, [value])
  
  const [internalProgresses, setInternalProgresses] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    if (value) {
      setFiles(value)
    }
  }, [value])

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Validate files based on size and MIME type
      const validFiles = acceptedFiles.filter((file) => {
        if (file.size > maxSize) {
          toast.error(`${file.name}: File too large (max ${formatBytes(maxSize)})`)
          return false
        }
        let isAccepted = false
        for (const acceptedMime in accept) {
          if (acceptedMime.endsWith('*')) {
            const prefix = acceptedMime.slice(0, -1)
            if (file.type.startsWith(prefix)) {
              isAccepted = true
              break
            }
          } else if (acceptedMime === file.type) {
            isAccepted = true
            break
          }
        }
        if (!isAccepted) {
          toast.error(`${file.name}: Unsupported file type`)
        }
        return isAccepted
      })

      if (!multiple && maxFileCount === 1 && validFiles.length > 1) {
        toast.error('Cannot upload more than 1 file at a time')
        return
      }

      if ((files?.length ?? 0) + validFiles.length > maxFileCount) {
        toast.error(`Cannot upload more than ${maxFileCount} files`)
        return
      }

      const newFiles = validFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      )

      const updatedFiles = files ? [...files, ...newFiles] : newFiles
      setFiles(updatedFiles)
      onValueChange?.(updatedFiles)

      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file, errors }) => {
          const errorMessages = errors.map((error) => error.message)
          toast.error(`${file.name}: ${errorMessages.join(', ')}`)
        })
      }

      if (
        onUpload &&
        updatedFiles.length > 0 &&
        updatedFiles.length <= maxFileCount
      ) {
        const target = updatedFiles.length > 1 ? `${updatedFiles.length} files` : 'file'
        toast.promise(onUpload(updatedFiles, (progress, file) => {
          setInternalProgresses(prev => ({ ...prev, [file.name]: progress }))
        }), {
          loading: `Uploading ${target}...`,
          success: () => {
            setFiles([])
            onValueChange?.([])
            return `${target} uploaded successfully`
          },
          error: `Failed to upload ${target}`,
        })
      }
    },
    [files, maxFileCount, multiple, onUpload, onValueChange, maxSize, accept]
  )

  const onRemove = React.useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index)
      setFiles(newFiles)
      onValueChange?.(newFiles)
    },
    [files, onValueChange]
  )

  // Cleanup previews on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if ('preview' in file) {
          URL.revokeObjectURL((file as any).preview)
        }
      })
    }
  }, [files])

  const isDisabled = disabled || (files?.length ?? 0) >= maxFileCount

  return (
    <div className="relative flex flex-col gap-6">
      <Dropzone
        accept={accept}
        disabled={isDisabled}
        maxFiles={maxFileCount}
        maxSize={maxSize}
        multiple={maxFileCount > 1 || multiple}
        onDrop={onDrop}
      >
        {({ getRootProps, getInputProps, isDragActive }) => (
          <div
            {...getRootProps()}
            className={cn(
              'group relative grid h-52 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-5 py-2.5 text-center transition hover:bg-muted/25',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isDragActive && 'border-muted-foreground/50',
              isDisabled && 'pointer-events-none opacity-60',
              className
            )}
            {...props}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                <div className="rounded-full border border-dashed p-3">
                  <Upload
                    aria-hidden="true"
                    className="size-7 text-muted-foreground"
                  />
                </div>
                <p className="font-medium text-muted-foreground">
                  Drop the files here
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                <div className="rounded-full border border-dashed p-3">
                  <Upload
                    aria-hidden="true"
                    className="size-7 text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-muted-foreground">
                    Drag {`'n'`} drop files here, or click to select files
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    You can upload up to {maxFileCount}{' '}
                    {maxFileCount === 1 ? 'file' : 'files'} (max{' '}
                    {formatBytes(maxSize)} each)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Dropzone>
      {files?.length > 0 && (
        <ScrollArea className="h-fit w-full px-3">
          <div className="flex max-h-48 flex-col gap-4">
            {files.map((file, index) => (
              <FileCard
                file={file}
                key={index}
                onRemove={() => onRemove(index)}
                progress={internalProgresses[file.name] ?? progresses?.[file.name]}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

interface FileCardProps {
  file: File & { preview?: string }
  onRemove: () => void
  progress?: number
}

function FileCard({ file, progress, onRemove }: FileCardProps) {
  return (
    <div className="relative flex items-center gap-2.5">
      <div className="flex flex-1 gap-2.5">
        {file.preview ? (
          <Image
            alt={file.name}
            className="size-12 shrink-0 rounded-md object-cover"
            height={48}
            src={file.preview}
            width={48}
          />
        ) : (
          <FileText
            aria-hidden="true"
            className="size-12 text-muted-foreground"
          />
        )}
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-col">
            <p className="line-clamp-1 text-sm font-medium text-foreground/80">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </p>
          </div>
          {progress !== undefined && <Progress value={progress} />}
        </div>
      </div>
      <Button
        className="size-7"
        onClick={onRemove}
        size="icon"
        type="button"
        variant="outline"
      >
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">Remove file</span>
      </Button>
    </div>
  )
}