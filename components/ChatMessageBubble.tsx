import type { Message } from "ai/react";

import { cn } from "@/utils/cn";

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
}) {
  return (
    <div
      className={cn(
        `mb-8 flex max-w-[80%] rounded-[24px]`,
        props.message.role === "user"
          ? "bg-secondary px-4 py-2 text-secondary-foreground"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="-mt-2 mr-4 flex size-10 shrink-0 items-center justify-center rounded-full border bg-secondary">
          {props.aiEmoji}
        </div>
      )}

      <div className="flex flex-col whitespace-pre-wrap">
        <span>{props.message.content}</span>

        {props.sources && props.sources.length ? (
          <>
            <code className="mr-auto mt-4 rounded bg-primary px-2 py-1">
              <h2>🔍 Sources:</h2>
            </code>
            <code className="mr-2 mt-1 rounded bg-primary px-2 py-1 text-xs">
              {props.sources?.map((source, i) => (
                <div className="mt-2" key={`source:${  i}`}>
                  {i + 1}. &quot;{source.pageContent}&quot;
                  {source.metadata?.loc?.lines !== undefined ? (
                    <div>
                      <br />
                      Lines {source.metadata?.loc?.lines?.from} to{" "}
                      {source.metadata?.loc?.lines?.to}
                    </div>
                  ) : (
                    ""
                  )}
                </div>
              ))}
            </code>
          </>
        ) : null}
      </div>
    </div>
  );
}
