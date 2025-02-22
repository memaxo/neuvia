"use client";

import type { StreamEvent } from "@langchain/core/tracers/log_stream";
import { readStreamableValue } from "ai/rsc";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { runAgent } from "./action";



export default function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<StreamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;

    try {
      setIsLoading(true);
      setData([]);
      setInput("");

      const { streamData } = await runAgent(input);
      for await (const item of readStreamableValue(streamData)) {
        setData((prev) => [...prev, item]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="stretch mx-auto flex w-full max-w-4xl flex-col gap-3 py-12">
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <Input
          onChange={(e) => setInput(e.target.value)}
          placeholder="What's the weather like in..."
          value={input}
        />
        <Button disabled={isLoading} type="submit">
          Submit
        </Button>
      </form>
      <div
        className="flex h-[650px] flex-col gap-2 overflow-y-auto px-2"
        ref={scrollRef}
      >
        {data.map((item, i) => (
          <div className="rounded-lg bg-[#25252f] p-4" key={i}>
            <strong>Event:</strong> <p className="text-sm">{item.event}</p>
            <br />
            <strong>Data:</strong>{" "}
            <p className="break-all text-sm">
              {JSON.stringify(item.data, null, 2)}
            </p>
          </div>
        ))}
      </div>
      {data.length > 1 && (
        <div className="flex w-full flex-col gap-2">
          <strong className="text-center">Question</strong>
          <p className="break-words">{data[0].data.input.input}</p>
        </div>
      )}

      {!isLoading && data.length > 1 && (
        <>
          <hr />
          <div className="flex w-full flex-col gap-2">
            <strong className="text-center">Result</strong>
            <p className="break-words">{data[data.length - 1].data.output}</p>
          </div>
        </>
      )}
    </div>
  );
}
