'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ChatRequestOptions } from '@/lib/types'
import { sanitizeUIMessages } from '@/lib/utils'
import type { CreateMessage, Message } from 'ai'
import cx from 'classnames'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion'
import { nanoid } from 'nanoid'
import {
  type Dispatch,
  type SetStateAction,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useOnClickOutside } from 'usehooks-ts'

import type { BlockKind } from './block'
import {
  ArrowUpIcon,
  CodeIcon,
  FileIcon,
  LogsIcon,
  MessageIcon,
  PenIcon,
  SparklesIcon,
  StopIcon,
  SummarizeIcon,
  TerminalIcon,
} from './icons'

type ToolProps = {
  type:
    | 'final-polish'
    | 'request-suggestions'
    | 'adjust-reading-level'
    | 'code-review'
    | 'add-comments'
    | 'add-logs'
  description: string
  icon: JSX.Element
  selectedTool: string | null
  setSelectedTool: Dispatch<SetStateAction<string | null>>
  isToolbarVisible?: boolean
  setIsToolbarVisible?: Dispatch<SetStateAction<boolean>>
  isAnimating: boolean
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

const Tool = ({
  type,
  description,
  icon,
  selectedTool,
  setSelectedTool,
  isToolbarVisible,
  setIsToolbarVisible,
  isAnimating,
  append,
}: ToolProps) => {
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (selectedTool !== type) {
      setIsHovered(false)
    }
  }, [selectedTool, type])

  const handleSelect = () => {
    if (!isToolbarVisible && setIsToolbarVisible) {
      setIsToolbarVisible(true)
      return
    }

    if (!selectedTool) {
      setIsHovered(true)
      setSelectedTool(type)
      return
    }

    if (selectedTool !== type) {
      setSelectedTool(type)
    } else {
      if (type === 'final-polish') {
        append({
          role: 'user',
          content:
            'Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.',
        })

        setSelectedTool(null)
      } else if (type === 'request-suggestions') {
        append({
          role: 'user',
          content:
            'Please add suggestions you have that could improve the writing.',
        })

        setSelectedTool(null)
      } else if (type === 'add-comments') {
        append({
          role: 'user',
          content: 'Please add comments to explain the code.',
        })

        setSelectedTool(null)
      } else if (type === 'add-logs') {
        append({
          role: 'user',
          content: 'Please add logs to help debug the code.',
        })

        setSelectedTool(null)
      }
    }
  }

  return (
    <Tooltip open={isHovered && !isAnimating}>
      <TooltipTrigger asChild>
        <motion.div
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className={cx('p-3 rounded-full', {
            'bg-primary !text-primary-foreground': selectedTool === type,
          })}
          exit={{
            scale: 0.9,
            opacity: 0,
            transition: { duration: 0.1 },
          }}
          initial={{ scale: 1, opacity: 0 }}
          onClick={() => {
            handleSelect()
          }}
          onHoverEnd={() => {
            if (selectedTool !== type) setIsHovered(false)
          }}
          onHoverStart={() => {
            setIsHovered(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSelect()
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {selectedTool === type ? <ArrowUpIcon /> : icon}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        className="bg-foreground text-background rounded-2xl p-3 px-4"
        side="left"
        sideOffset={16}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

const randomArr = [...Array(6)].map((x) => nanoid(5))

const ReadingLevelSelector = ({
  setSelectedTool,
  append,
  isAnimating,
}: {
  setSelectedTool: Dispatch<SetStateAction<string | null>>
  isAnimating: boolean
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}) => {
  const LEVELS = [
    'Elementary',
    'Middle School',
    'Keep current level',
    'High School',
    'College',
    'Graduate',
  ]

  const y = useMotionValue(-40 * 2)
  const dragConstraints = 5 * 40 + 2
  const yToLevel = useTransform(y, [0, -dragConstraints], [0, 5])

  const [currentLevel, setCurrentLevel] = useState(2)
  const [hasUserSelectedLevel, setHasUserSelectedLevel] =
    useState<boolean>(false)

  useEffect(() => {
    const unsubscribe = yToLevel.on('change', (latest) => {
      const level = Math.min(5, Math.max(0, Math.round(Math.abs(latest))))
      setCurrentLevel(level)
    })

    return () => unsubscribe()
  }, [yToLevel])

  return (
    <div className="relative flex flex-col items-center justify-end">
      {randomArr.map((id) => (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex size-[40px] flex-row items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={id}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-muted-foreground/40 size-2 rounded-full" />
        </motion.div>
      ))}

      <TooltipProvider>
        <Tooltip open={!isAnimating}>
          <TooltipTrigger asChild>
            <motion.div
              className={cx(
                'absolute bg-background p-3 border rounded-full flex flex-row items-center',
                {
                  'bg-primary text-primary-foreground': currentLevel !== 2,
                  'bg-background text-foreground': currentLevel === 2,
                }
              )}
              drag="y"
              dragConstraints={{ top: -dragConstraints, bottom: 0 }}
              dragElastic={0}
              dragMomentum={false}
              onClick={() => {
                if (currentLevel !== 2 && hasUserSelectedLevel) {
                  append({
                    role: 'user',
                    content: `Please adjust the reading level to ${LEVELS[currentLevel]} level.`,
                  })

                  setSelectedTool(null)
                }
              }}
              onDragEnd={() => {
                if (currentLevel === 2) {
                  setSelectedTool(null)
                } else {
                  setHasUserSelectedLevel(true)
                }
              }}
              onDragStart={() => {
                setHasUserSelectedLevel(false)
              }}
              style={{ y }}
              transition={{ duration: 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {currentLevel === 2 ? <SummarizeIcon /> : <ArrowUpIcon />}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent
            className="bg-foreground text-background rounded-2xl p-3 px-4 text-sm"
            side="left"
            sideOffset={16}
          >
            {LEVELS[currentLevel]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

const toolsByBlockKind: Record<
  BlockKind,
  Array<{
    type:
      | 'final-polish'
      | 'request-suggestions'
      | 'adjust-reading-level'
      | 'code-review'
      | 'add-comments'
      | 'add-logs'
    description: string
    icon: JSX.Element
  }>
> = {
  text: [
    {
      type: 'final-polish',
      description: 'Add final polish',
      icon: <PenIcon />,
    },
    {
      type: 'adjust-reading-level',
      description: 'Adjust reading level',
      icon: <SummarizeIcon />,
    },
    {
      type: 'request-suggestions',
      description: 'Request suggestions',
      icon: <MessageIcon />,
    },
  ],
  code: [
    {
      type: 'add-comments',
      description: 'Add comments',
      icon: <CodeIcon />,
    },
    {
      type: 'add-logs',
      description: 'Add logs',
      icon: <LogsIcon />,
    },
  ],
  spreadsheet: [
    {
      type: 'final-polish',
      description: 'Format and clean data',
      icon: <SparklesIcon />,
    },
    {
      type: 'request-suggestions',
      description: 'Analyze and visualize data',
      icon: <MessageIcon />,
    },
  ],
}

export const Tools = ({
  isToolbarVisible,
  selectedTool,
  setSelectedTool,
  append,
  isAnimating,
  setIsToolbarVisible,
  blockKind,
}: {
  isToolbarVisible: boolean
  selectedTool: string | null
  setSelectedTool: Dispatch<SetStateAction<string | null>>
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  isAnimating: boolean
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>
  blockKind: BlockKind
}) => {
  const [primaryTool, ...secondaryTools] = toolsByBlockKind[blockKind]

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-1.5"
      exit={{ opacity: 0, scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.95 }}
    >
      <AnimatePresence>
        {isToolbarVisible &&
          secondaryTools.map((secondaryTool) => (
            <Tool
              append={append}
              description={secondaryTool.description}
              icon={secondaryTool.icon}
              isAnimating={isAnimating}
              key={secondaryTool.type}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              type={secondaryTool.type}
            />
          ))}
      </AnimatePresence>

      <Tool
        append={append}
        description={primaryTool.description}
        icon={primaryTool.icon}
        isAnimating={isAnimating}
        isToolbarVisible={isToolbarVisible}
        selectedTool={selectedTool}
        setIsToolbarVisible={setIsToolbarVisible}
        setSelectedTool={setSelectedTool}
        type={primaryTool.type}
      />
    </motion.div>
  )
}

const PureToolbar = ({
  isToolbarVisible,
  setIsToolbarVisible,
  append,
  isLoading,
  stop,
  setMessages,
  blockKind,
}: {
  isToolbarVisible: boolean
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>
  isLoading: boolean
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  stop: () => void
  setMessages: Dispatch<SetStateAction<Message[]>>
  blockKind: BlockKind
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  useOnClickOutside(toolbarRef, () => {
    setIsToolbarVisible(false)
    setSelectedTool(null)
  })

  const startCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setSelectedTool(null)
      setIsToolbarVisible(false)
    }, 2000)
  }

  const cancelCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      setIsToolbarVisible(false)
    }
  }, [isLoading, setIsToolbarVisible])

  return (
    <TooltipProvider delayDuration={0}>
      <motion.div
        animate={
          isToolbarVisible
            ? selectedTool === 'adjust-reading-level'
              ? {
                  opacity: 1,
                  y: 0,
                  height: 6 * 43,
                  transition: { delay: 0 },
                  scale: 0.95,
                }
              : {
                  opacity: 1,
                  y: 0,
                  height: toolsByBlockKind[blockKind].length * 50,
                  transition: { delay: 0 },
                  scale: 1,
                }
            : { opacity: 1, y: 0, height: 54, transition: { delay: 0 } }
        }
        className="bg-background absolute bottom-6 right-6 flex cursor-pointer flex-col justify-end rounded-full border p-1.5 shadow-lg"
        exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
        initial={{ opacity: 0, y: -20, scale: 1 }}
        onAnimationComplete={() => {
          setIsAnimating(false)
        }}
        onAnimationStart={() => {
          setIsAnimating(true)
        }}
        onHoverEnd={() => {
          if (isLoading) return

          startCloseTimer()
        }}
        onHoverStart={() => {
          if (isLoading) return

          cancelCloseTimer()
          setIsToolbarVisible(true)
        }}
        ref={toolbarRef}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {isLoading ? (
          <motion.div
            animate={{ scale: 1.4 }}
            className="p-3"
            exit={{ scale: 1 }}
            initial={{ scale: 1 }}
            key="stop-icon"
            onClick={() => {
              stop()
              setMessages((messages) => sanitizeUIMessages(messages))
            }}
          >
            <StopIcon />
          </motion.div>
        ) : selectedTool === 'adjust-reading-level' ? (
          <ReadingLevelSelector
            append={append}
            isAnimating={isAnimating}
            key="reading-level-selector"
            setSelectedTool={setSelectedTool}
          />
        ) : (
          <Tools
            append={append}
            blockKind={blockKind}
            isAnimating={isAnimating}
            isToolbarVisible={isToolbarVisible}
            key="tools"
            selectedTool={selectedTool}
            setIsToolbarVisible={setIsToolbarVisible}
            setSelectedTool={setSelectedTool}
          />
        )}
      </motion.div>
    </TooltipProvider>
  )
}

export const Toolbar = memo(PureToolbar, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false
  if (prevProps.isToolbarVisible !== nextProps.isToolbarVisible) return false
  if (prevProps.blockKind !== nextProps.blockKind) return false

  return true
})
