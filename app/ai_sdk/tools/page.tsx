"use client";

import { readStreamableValue } from "ai/rsc";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { executeTool } from "./action";

export default function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState({
    wso: false,
    streamEvents: false,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;
    setIsLoading(true);
    setData([]);

    const { streamData } = await executeTool(input, options);
    for await (const item of readStreamableValue(streamData)) {
      setData((prev) => [...prev, item]);
    }
    setIsLoading(false);
  }

  return (
    <div className="stretch mx-auto flex w-full max-w-4xl flex-col gap-3 py-12">
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <Input
          onChange={(e) => setInput(e.target.value)}
          placeholder="What's the weather in XYZ city and XYZ state"
          value={input}
        />
        <div className="flex items-center">
          <Checkbox
            checked={options.wso}
            id="wso-checkbox"
            onCheckedChange={(checked) =>
              setOptions((prev) => ({ ...prev, wso: !!checked }))
            }
          />
          <label className="ml-2 text-sm font-medium" htmlFor="wso-checkbox">
            Use <code>withStructuredOutput</code>
          </label>
        </div>
        <div className="flex items-center">
          <Checkbox
            checked={options.streamEvents}
            id="stream-events-checkbox"
            onCheckedChange={(checked) =>
              setOptions((prev) => ({ ...prev, streamEvents: !!checked }))
            }
          />
          <label
            className="ml-2 text-sm font-medium"
            htmlFor="stream-events-checkbox"
          >
            Use <code>streamEvents</code>
          </label>
        </div>
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
            {options.streamEvents ? (
              <>
                <strong>Event:</strong> <p className="text-sm">{item.event}</p>
              </>
            ) : (
              <strong className="text-center">Stream</strong>
            )}
            <br />
            <p className="break-all text-sm">
              {options.streamEvents
                ? JSON.stringify(item.data, null, 2)
                : JSON.stringify(item, null, 2)}
            </p>
          </div>
        ))}
      </div>
      {!isLoading && data.length > 1 && (
        <>
          <hr />
          <div className="flex w-full flex-col gap-2">
            <strong className="text-center">Result</strong>
            <p className="break-all text-sm">
              {JSON.stringify(data[data.length - 1], null, 2)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
