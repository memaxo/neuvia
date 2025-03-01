'use client'

export function ChatLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <div className="space-y-4 text-center">
        <div className="flex animate-pulse items-center justify-center space-x-2">
          <div className="size-2 rounded-full bg-blue-400" />
          <div className="animation-delay-200 size-2 rounded-full bg-blue-400" />
          <div className="animation-delay-400 size-2 rounded-full bg-blue-400" />
        </div>
        <p className="text-muted-foreground text-sm">
          Loading chat interface...
        </p>
      </div>
    </div>
  )
}
