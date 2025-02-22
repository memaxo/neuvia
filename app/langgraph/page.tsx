"use client";

import { Client, Message } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/langgraph-sdk/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryState } from "nuqs";
import type { ReactNode} from "react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { ChatInput, ChatLayout } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";


const onError = (error: unknown) => {
  toast.error("Failed to handle input", {
    description: error instanceof Error ? error.message : String(error),
  });
};

function EditMessage({
  message,
  onEdit,
  onCancel,
}: {
  message: Message;
  onEdit: (message: Message) => void;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(message.content as string);

  return (
    <ChatInput
      actions={
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      }
      onChange={(e) => setEditValue(e.target.value)}
      onSubmit={(e) => {
        e.preventDefault();
        onEdit({ type: "human", content: editValue });
      }}
      value={editValue}
    />
  );
}

function Message(props: {
  message: Message;
  onEdit: (message: Message) => void;
  onRegenerate: () => void;
  actions?: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  if (isEditing) {
    return (
      <EditMessage
        message={props.message}
        onCancel={() => setIsEditing(false)}
        onEdit={props.onEdit}
      />
    );
  }

  return (
    <div
      className={cn(
        "max-w-[80%]",
        props.message.type === "human" ? "ml-auto" : "mr-auto",
      )}
    >
      <div
        className={cn(
          `flex rounded-[24px]`,
          props.message.type === "human"
            ? "bg-secondary px-4 py-2 text-secondary-foreground"
            : null,
        )}
      >
        <div className="flex flex-col whitespace-pre-wrap">
          {typeof props.message.content === "string"
            ? props.message.content
            : props.message.content.map((part) => {
                if (part.type === "text") return part.text;
                return null;
              })}
        </div>
      </div>

      {props.message.type === "human" && (
        <div className="ml-auto mt-2 flex items-center justify-end gap-2">
          <button
            className="text-right text-sm text-muted-foreground"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            Edit
          </button>

          {props.actions}
        </div>
      )}

      {props.message.type === "ai" && (
        <div className="mt-2 flex items-center justify-start gap-2">
          {props.actions}
          <div className="text-sm text-muted-foreground">
            <button onClick={props.onRegenerate} type="button">
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BranchPicker(props: {
  current: string;
  branches: string[];
  onSelect: (path: string) => void;
}) {
  const index = props.branches.indexOf(props.current);

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button
        className="shrink-0"
        onClick={() => {
          const nextIndex = Math.max(0, index - 1);
          const next = props.branches[nextIndex];
          props.onSelect(next);
        }}
        type="button"
      >
        <ChevronLeft className="size-4 text-muted-foreground" />
      </button>

      <span className="text-muted-foreground">
        {index + 1} / {props.branches.length}
      </span>

      <button
        className="shrink-0"
        onClick={() => {
          const nextIndex = Math.min(props.branches.length - 1, index + 1);
          const next = props.branches[nextIndex];
          props.onSelect(next);
        }}
        type="button"
      >
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

const client = new Client<{ messages?: Message[]; timestamp?: number }>({
  apiUrl: "http://localhost:2024",
});

function StatefulChatInput(props: {
  loading: boolean;
  onSubmit: (value: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");

  return (
    <ChatInput
      loading={props.loading}
      onChange={(e) => setInput(e.target.value)}
      onStop={props.onStop}
      onSubmit={(e) => {
        e.preventDefault();
        setInput("");
        props.onSubmit(input);
      }}
      value={input}
    />
  );
}

function ClientLanggraphPage() {
  const [threadId, setThreadId] = useQueryState("threadId");

  const thread = useStream<{ messages?: Message[]; timestamp?: number }>({
    assistantId: "agent",
    apiUrl: "http://localhost:2024",
    threadId,

    onThreadId: setThreadId,
    onError,
    onFinish: (state) => {
      console.log("onFinish", state);
    },
  });

  return (
    <ChatLayout
      content={
        thread.messages.length ? (
          <div className="mx-auto mb-16 flex max-w-screen-md flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span>Timestamp: {thread.values.timestamp}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>Thread ID: {threadId}</span>
              <Button
                onClick={() => setThreadId(null)}
                type="button"
                variant="outline"
              >
                New thread
              </Button>
            </div>

            {thread.messages.map((message, index) => {
              const meta = thread.getMessagesMetadata(message, index);
              const checkpoint = meta?.firstSeenState?.parent_checkpoint;

              console.log("message", message);

              return (
                <Message
                  actions={
                    meta?.branch != null &&
                    meta?.branchOptions != null && (
                      <BranchPicker
                        branches={meta.branchOptions}
                        current={meta.branch}
                        onSelect={thread.setBranch}
                      />
                    )
                  }
                  key={message.id ?? index}
                  message={message}
                  onEdit={(message) =>
                    thread.submit({ messages: [message] }, { checkpoint })
                  }
                  onRegenerate={() => thread.submit(undefined, { checkpoint })}
                />
              );
            })}

            {thread.error ? (
              <div className="text-red-500">{thread.error.toString()}</div>
            ) : null}
          </div>
        ) : (
          <GuideInfoBox>
            <p>
              This example showcases connecting a LangGraph agent in a Next.js
              project, demonstrating a web search agent.
            </p>
          </GuideInfoBox>
        )
      }
      footer={
        <StatefulChatInput
          loading={thread.isLoading}
          onStop={thread.stop}
          onSubmit={(input) => {
            thread.submit(
              { messages: [{ type: "human", content: input }] },
              {
                optimisticValues: (prev) => ({
                  messages: [
                    ...(prev?.messages ?? []),
                    { type: "human", content: input },
                  ],
                }),
              },
            );
          }}
        />
      }
    />
  );
}

export default function LanggraphPage() {
  return (
    <Suspense>
      <ClientLanggraphPage />
    </Suspense>
  );
}
