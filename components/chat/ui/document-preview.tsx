'use client'

import type {
  MouseEvent} from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import useSWR from 'swr'

import { useBlock } from '@/hooks/use-block'
import type { Document } from '@/lib/db/schema'
import { cn, fetcher } from '@/lib/utils'

import { FileIcon, FullscreenIcon, LoaderIcon } from '@/components/icons'
import type { UIBlock } from '@/components/ui/block';
import { BlockKind } from '@/components/ui/block'
import { CodeEditor } from '@/components/ui/code-editor'
import { DocumentToolCall, DocumentToolResult } from '@/components/ui/document'
import { InlineDocumentSkeleton } from '@/components/ui/document-skeleton'
import { Editor } from '@/components/ui/editor'
import { SpreadsheetEditor } from '@/components/ui/spreadsheet-editor'

interface DocumentPreviewProps {
  isReadonly: boolean
  result?: any
  args?: any
}

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { block, setBlock } = useBlock()

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Array<Document>
  >(result ? `/api/document?id=${result.id}` : null, fetcher)

  const previewDocument = useMemo(() => documents?.[0], [documents])
  const hitboxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect()
    if (block.documentId && boundingBox) {
      setBlock((block) => ({
        ...block,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }))
    }
  }, [block.documentId, setBlock])

  if (block.isVisible) {
    if (result) {
      return (
        <DocumentToolResult
          isReadonly={isReadonly}
          result={{ id: result.id, title: result.title, kind: result.kind }}
          type="create"
        />
      )
    }

    if (args) {
      return (
        <DocumentToolCall
          args={{ title: args.title }}
          isReadonly={isReadonly}
          type="create"
        />
      )
    }
  }

  if (isDocumentsFetching) {
    return <LoadingSkeleton />
  }

  const document: Document | null = previewDocument
    ? previewDocument
    : block.status === 'streaming'
      ? {
          title: block.title,
          kind: block.kind,
          content: block.content,
          id: block.documentId,
          createdAt: new Date(),
          userId: 'noop',
        }
      : null

  if (!document) return <LoadingSkeleton />

  return (
    <div className="relative w-full cursor-pointer">
      <HitboxLayer hitboxRef={hitboxRef} result={result} setBlock={setBlock} />
      <DocumentHeader
        isStreaming={block.status === 'streaming'}
        title={document.title}
      />
      <DocumentContent document={document} />
    </div>
  )
}

const LoadingSkeleton = () => (
  <div className="w-full">
    <div className="dark:bg-muted flex h-[57px] flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 p-4 dark:border-zinc-700">
      <div className="flex flex-row items-center gap-3">
        <div className="text-muted-foreground">
          <div className="bg-muted-foreground/20 size-4 animate-pulse rounded-md" />
        </div>
        <div className="bg-muted-foreground/20 h-4 w-24 animate-pulse rounded-lg" />
      </div>
      <div>
        <FullscreenIcon />
      </div>
    </div>
    <div className="bg-muted overflow-y-scroll rounded-b-2xl border border-t-0 p-8 pt-4 dark:border-zinc-700">
      <InlineDocumentSkeleton />
    </div>
  </div>
)

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setBlock,
}: {
  hitboxRef: React.RefObject<HTMLDivElement>
  result: any
  setBlock: (updaterFn: UIBlock | ((currentBlock: UIBlock) => UIBlock)) => void
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect()

      setBlock((block) =>
        block.status === 'streaming'
          ? { ...block, isVisible: true }
          : {
              ...block,
              documentId: result.id,
              kind: result.kind,
              isVisible: true,
              boundingBox: {
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            }
      )
    },
    [setBlock, result]
  )

  return (
    <div
      aria-hidden="true"
      className="absolute left-0 top-0 z-10 size-full rounded-xl"
      onClick={handleClick}
      ref={hitboxRef}
      role="presentation"
    />
  )
}

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) return false
  return true
})

const PureDocumentHeader = ({
  title,
  isStreaming,
}: {
  title: string
  isStreaming: boolean
}) => (
  <div className="dark:bg-muted flex flex-row items-start justify-between gap-2 rounded-t-2xl border border-b-0 p-4 sm:items-center dark:border-zinc-700">
    <div className="flex flex-row items-start gap-3 sm:items-center">
      <div className="text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        ) : (
          <FileIcon />
        )}
      </div>
      <div className="-translate-y-1 font-medium sm:translate-y-0">{title}</div>
    </div>
    <div>
      <FullscreenIcon />
    </div>
  </div>
)

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) return false
  if (prevProps.isStreaming !== nextProps.isStreaming) return false

  return true
})

const DocumentContent = ({ document }: { document: Document }) => {
  const { block } = useBlock()

  const containerClassName = cn(
    'dark:bg-muted h-[257px] overflow-y-scroll rounded-b-2xl border border-t-0 dark:border-zinc-700',
    {
      'p-4 sm:px-14 sm:py-16': document.kind === 'text',
      'p-0': document.kind === 'code',
    }
  )

  const commonProps = {
    content: document.content ?? '',
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: block.status,
    saveContent: () => {},
    suggestions: [],
  }

  return (
    <div className={containerClassName}>
      {document.kind === 'text' ? (
        <Editor {...commonProps} />
      ) : document.kind === 'code' ? (
        <div className="relative flex w-full flex-1">
          <div className="absolute inset-0">
            <CodeEditor {...commonProps} />
          </div>
        </div>
      ) : document.kind === 'spreadsheet' ? (
        <div className="relative flex w-full flex-1 p-4">
          <div className="absolute inset-0">
            <SpreadsheetEditor {...commonProps} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
