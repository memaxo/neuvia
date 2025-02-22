// app/ai_sdk/agent/action.ts
"use server";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createStreamableValue } from "ai/rsc";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { pull } from "langchain/hub";

export async function runAgent(input: string) {
  "use server";

  const stream = createStreamableValue();

  (async () => {
    try {
      // Initialize tools and pull the agent prompt from the hub
      const tools = [new TavilySearchResults({ maxResults: 1 })];
      const prompt = await pull<ChatPromptTemplate>(
        "hwchase17/openai-tools-agent"
      );
      
      // Use the production‑ready model "o3-mini" with updated parameters for better performance and cost
      const llm = new ChatOpenAI({ model: "o3-mini", temperature: 0.3 });
      
      const agent = createToolCallingAgent({
        llm,
        tools,
        prompt,
      });

      const agentExecutor = new AgentExecutor({ agent, tools });

      // Stream events directly without JSON stringify/parse workaround
      const streamingEvents = agentExecutor.streamEvents(
        { input },
        { version: "v2" }
      );

      for await (const item of streamingEvents) {
        stream.update(item);
      }
    } catch (error) {
      // Log detailed error information and propagate error to the client
      console.error("Error in runAgent:", error);
      stream.update({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      stream.done();
    }
  })();

  return { streamData: stream.value };
}