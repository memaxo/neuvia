import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import React, { memo, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../editor/code-block'

// Component for collapsible sections
const CollapsibleSection = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-4 rounded-md border">
      <button
        aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        aria-expanded={isOpen}
        className="bg-muted/30 flex w-full items-center justify-between border-b p-3 text-left font-medium"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all',
          isOpen ? 'max-h-[1000px] p-3' : 'max-h-0'
        )}
        id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        {children}
      </div>
    </div>
  )
}

// Custom component for medical tables
const MedicalTable = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="divide-border min-w-full divide-y rounded-md border">
        {children}
      </table>
    </div>
  )
}

// Component to highlight changes
const HighlightedChanges = ({
  text,
  type,
}: {
  text: string
  type: 'added' | 'removed' | 'changed'
}) => {
  const bgColor =
    type === 'added'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-l-2 border-green-500 pl-2'
      : type === 'removed'
        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-l-2 border-red-500 pl-2 line-through'
        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-l-2 border-amber-500 pl-2'

  return <span className={cn('rounded px-1 py-0.5', bgColor)}>{text}</span>
}

// Enhanced components for ReactMarkdown
const components: Partial<Components> = {
  // @ts-expect-error - CodeBlock expects specific props
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="ml-4 list-outside list-decimal" {...props}>
        {children}
      </ol>
    )
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    )
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="ml-4 list-outside list-disc" {...props}>
        {children}
      </ul>
    )
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    )
  },
  a: ({ node, children, href, ...props }) => {
    // Handle special links for collapsible sections
    if (href?.startsWith('#collapse:')) {
      const title = href.replace('#collapse:', '')
      return <CollapsibleSection title={title}>{children}</CollapsibleSection>
    }

    // Handle highlighting
    if (href?.startsWith('#highlight:')) {
      const type = href.replace('#highlight:', '') as
        | 'added'
        | 'removed'
        | 'changed'
      return <HighlightedChanges text={children as string} type={type} />
    }

    return (
      <a
        className="text-blue-500 hover:underline"
        href={href}
        rel="noreferrer"
        target="_blank"
        {...props}
      >
        {children}
      </a>
    )
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="mb-2 mt-6 text-3xl font-semibold" {...props}>
        {children}
      </h1>
    )
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="mb-2 mt-6 text-2xl font-semibold" {...props}>
        {children}
      </h2>
    )
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="mb-2 mt-6 text-xl font-semibold" {...props}>
        {children}
      </h3>
    )
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="mb-2 mt-6 text-lg font-semibold" {...props}>
        {children}
      </h4>
    )
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="mb-2 mt-6 text-base font-semibold" {...props}>
        {children}
      </h5>
    )
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="mb-2 mt-6 text-sm font-semibold" {...props}>
        {children}
      </h6>
    )
  },
  table: ({ node, children, ...props }) => {
    return <MedicalTable>{children}</MedicalTable>
  },
  thead: ({ node, children, ...props }) => {
    return <thead className="bg-muted/50 dark:bg-muted/20">{children}</thead>
  },
  tbody: ({ node, children, ...props }) => {
    return <tbody className="divide-border divide-y">{children}</tbody>
  },
  tr: ({ node, children, ...props }) => {
    return <tr className="hover:bg-muted/20">{children}</tr>
  },
  th: ({ node, children, ...props }) => {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
        {...props}
      >
        {children}
      </th>
    )
  },
  td: ({ node, children, ...props }) => {
    return (
      <td className="whitespace-normal px-4 py-3" {...props}>
        {children}
      </td>
    )
  },
}

const remarkPlugins = [remarkGfm]

interface MarkdownProps {
  children: string
  isSummary?: boolean
  disableCollapsible?: boolean
}

const NonMemoizedMarkdown = ({
  children,
  isSummary = false,
  disableCollapsible = false,
}: MarkdownProps) => {
  // Auto-wrap large content in collapsible sections if it's a summary
  // and not already using collapsible sections
  let content = children

  if (
    isSummary &&
    !disableCollapsible &&
    !content.includes('#collapse:') &&
    content.length > 500
  ) {
    // Find heading markers (##) and wrap sections
    const sections = content.split(/\n(?=## )/)

    if (sections.length > 1) {
      // Only first section open by default
      content = sections
        .map((section, i) => {
          if (!section.trim()) return ''
          const title = section.match(/^## (.*?)(\n|$)/)?.[1] || 'Section'
          const body = section.replace(/^## (.*?)(\n|$)/, '')
          return `[${title}](#collapse:${title})\n${body}\n`
        })
        .join('\n')
    }
  }

  return (
    <ReactMarkdown components={components} remarkPlugins={remarkPlugins}>
      {content}
    </ReactMarkdown>
  )
}

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isSummary === nextProps.isSummary &&
    prevProps.disableCollapsible === nextProps.disableCollapsible
)
