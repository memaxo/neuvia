Token Usage:
GitHub Tokens: 37327
LLM Input Tokens: 0
LLM Output Tokens: 0
Total Tokens: 37327

FileTree:
.eslintrc.json
.gitignore
.prettierrc.json
.yarnrc.yml
README.md
app/agents/page.tsx
app/ai_sdk/README.md
app/ai_sdk/agent/README.md
app/ai_sdk/agent/action.ts
app/ai_sdk/agent/page.tsx
app/ai_sdk/page.tsx
app/ai_sdk/tools/README.md
app/ai_sdk/tools/action.ts
app/ai_sdk/tools/page.tsx
app/api/chat/agents/route.ts
app/api/chat/retrieval/route.ts
app/api/chat/retrieval_agents/route.ts
app/api/chat/route.ts
app/api/chat/structured_output/route.ts
app/api/retrieval/ingest/route.ts
app/globals.css
app/langgraph/agent/.gitignore
app/langgraph/agent/agent.ts
app/langgraph/agent/langgraph.json
app/langgraph/page.tsx
app/layout.tsx
app/page.tsx
app/retrieval/page.tsx
app/retrieval_agents/page.tsx
app/structured_output/page.tsx
components.json
components/ChatMessageBubble.tsx
components/ChatWindow.tsx
components/IntermediateStep.tsx
components/Navbar.tsx
components/UploadDocumentsForm.tsx
components/guide/GuideInfoBox.tsx
components/ui/button.tsx
components/ui/checkbox.tsx
components/ui/dialog.tsx
components/ui/drawer.tsx
components/ui/input.tsx
components/ui/popover.tsx
components/ui/sonner.tsx
components/ui/textarea.tsx
data/DefaultRetrievalText.ts
next.config.js
package.json
postcss.config.js
tailwind.config.js
tsconfig.json
utils/cn.ts

Analysis:
.eslintrc.json
```.json
{
  "extends": "next/core-web-vitals"
}

```
.gitignore
```.gitignore
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
.env
```
.prettierrc.json
```.json
{}

```
.yarnrc.yml
```.yml
nodeLinker: node-modules

yarnPath: .yarn/releases/yarn-3.5.1.cjs

```
README.md
# 🦜️🔗 LangChain + Next.js Starter Template

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/langchain-ai/langchain-nextjs-template)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flangchain-ai%2Flangchain-nextjs-template)

This template scaffolds a LangChain.js + Next.js starter app. It showcases how to use and combine LangChain modules for several
use cases. Specifically:

- [Simple chat](/app/api/chat/route.ts)
- [Returning structured output from an LLM call](/app/api/chat/structured_output/route.ts)
- [Answering complex, multi-step questions with agents](/app/api/chat/agents/route.ts)
- [Retrieval augmented generation (RAG) with a chain and a vector store](/app/api/chat/retrieval/route.ts)
- [Retrieval augmented generation (RAG) with an agent and a vector store](/app/api/chat/retrieval_agents/route.ts)

Most of them use Vercel's [AI SDK](https://github.com/vercel-labs/ai) to stream tokens to the client and display the incoming messages.

The agents use [LangGraph.js](https://langchain-ai.github.io/langgraphjs/), LangChain's framework for building agentic workflows. They use preconfigured helper functions to minimize boilerplate, but you can replace them with custom graphs as desired.

https://github.com/user-attachments/assets/e389e4e4-4fb9-4223-a4c2-dc002c8f20d3

It's free-tier friendly too! Check out the [bundle size stats below](#-bundle-size).

You can check out a hosted version of this repo here: https://langchain-nextjs-template.vercel.app/

## 🚀 Getting Started

First, clone this repo and download it locally.

Next, you'll need to set up environment variables in your repo's `.env.local` file. Copy the `.env.example` file to `.env.local`.
To start with the basic examples, you'll just need to add your OpenAI API key.

Because this app is made to run in serverless Edge functions, make sure you've set the `LANGCHAIN_CALLBACKS_BACKGROUND` environment variable to `false` to ensure tracing finishes if you are using [LangSmith tracing](https://docs.smith.langchain.com/).

Next, install the required packages using your preferred package manager (e.g. `yarn`).

Now you're ready to run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result! Ask the bot something and you'll see a streamed response:

![A streaming conversation between the user and the AI](/public/images/chat-conversation.png)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Backend logic lives in `app/api/chat/route.ts`. From here, you can change the prompt and model, or add other modules and logic.

## 🧱 Structured Output

The second example shows how to have a model return output according to a specific schema using OpenAI Functions.
Click the `Structured Output` link in the navbar to try it out:

![A streaming conversation between the user and an AI agent](/public/images/structured-output-conversation.png)

The chain in this example uses a [popular library called Zod](https://zod.dev) to construct a schema, then formats it in the way OpenAI expects.
It then passes that schema as a function into OpenAI and passes a `function_call` parameter to force OpenAI to return arguments in the specified format.

For more details, [check out this documentation page](https://js.langchain.com/docs/how_to/structured_output).

## 🦜 Agents

To try out the agent example, you'll need to give the agent access to the internet by populating the `SERPAPI_API_KEY` in `.env.local`.
Head over to [the SERP API website](https://serpapi.com/) and get an API key if you don't already have one.

You can then click the `Agent` example and try asking it more complex questions:

![A streaming conversation between the user and an AI agent](/public/images/agent-conversation.png)

This example uses a [prebuilt LangGraph agent](https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/), but you can customize your own as well.

## 🐶 Retrieval

The retrieval examples both use Supabase as a vector store. However, you can swap in
[another supported vector store](https://js.langchain.com/docs/integrations/vectorstores) if preferred by changing
the code under `app/api/retrieval/ingest/route.ts`, `app/api/chat/retrieval/route.ts`, and `app/api/chat/retrieval_agents/route.ts`.

For Supabase, follow [these instructions](https://js.langchain.com/docs/integrations/vectorstores/supabase) to set up your
database, then get your database URL and private key and paste them into `.env.local`.

You can then switch to the `Retrieval` and `Retrieval Agent` examples. The default document text is pulled from the LangChain.js retrieval
use case docs, but you can change them to whatever text you'd like.

For a given text, you'll only need to press `Upload` once. Pressing it again will re-ingest the docs, resulting in duplicates.
You can clear your Supabase vector store by navigating to the console and running `DELETE FROM documents;`.

After splitting, embedding, and uploading some text, you're ready to ask questions!

For more info on retrieval chains, [see this page](https://js.langchain.com/docs/tutorials/rag).
The specific variant of the conversational retrieval chain used here is composed using LangChain Expression Language, which you can
[read more about here](https://js.langchain.com/docs/how_to/qa_sources/). This chain example will also return cited sources
via header in addition to the streaming response.

For more info on retrieval agents, [see this page](https://langchain-ai.github.io/langgraphjs/tutorials/rag/langgraph_agentic_rag/).

## 📦 Bundle size

The bundle size for LangChain itself is quite small. After compression and chunk splitting, for the RAG use case LangChain uses 37.32 KB of code space (as of [@langchain/core 0.1.15](https://npmjs.com/package/@langchain/core)), which is less than 4% of the total Vercel free tier edge function alottment of 1 MB:

![](/public/images/bundle-size.png)

This package has [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) set up by default - you can explore the bundle size interactively by running:

```bash
$ ANALYZE=true yarn build
```

## 📚 Learn More

The example chains in the `app/api/chat/route.ts` and `app/api/chat/retrieval/route.ts` files use
[LangChain Expression Language](https://js.langchain.com/docs/concepts#langchain-expression-language) to
compose different LangChain.js modules together. You can integrate other retrievers, agents, preconfigured chains, and more too, though keep in mind
`HttpResponseOutputParser` is meant to be used directly with model output.

To learn more about what you can do with LangChain.js, check out the docs here:

- https://js.langchain.com/docs/

## ▲ Deploy on Vercel

When ready, you can deploy your app on the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Thank You!

Thanks for reading! If you have any questions or comments, reach out to us on Twitter
[@LangChainAI](https://twitter.com/langchainai), or [click here to join our Discord server](https://discord.gg/langchain).

app/agents/page.tsx
```.tsx
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🤝
          <span className="ml-2">
            This template showcases a{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            agent and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li>
          🛠️
          <span className="ml-2">
            The agent has memory and access to a search engine and a calculator.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/agents/route.ts</code>.
          </span>
        </li>
        <li>
          🦜
          <span className="ml-2">
            By default, the agent is pretending to be a talking parrot, but you
            can the prompt to whatever you want!
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in <code>app/agents/page.tsx</code>
            .
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking e.g. <code>What is the weather in Honolulu?</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <ChatWindow
      endpoint="api/chat/agents"
      emptyStateComponent={InfoCard}
      placeholder="Squawk! I'm a conversational agent! Ask me about the current weather in Honolulu!"
      emoji="🦜"
      showIntermediateStepsToggle={true}
    />
  );
}

```
app/ai_sdk/README.md
# LangChain.js x AI SDK

This directory contains two pages with demo implementations of using [LangChain.js](https://js.langchain.com/v0.2/docs/introduction/) and [AI SDK](https://www.npmjs.com/package/ai) in [React Server Components](https://react.dev/reference/rsc/server-components).

Each directory contains a `README.md` file which documents exactly what is happening in the code. The README will break down each component of the server -> client data streaming process, and explain how to set up the necessary tools and models.

### [Agents](./agent/README.md)

### [Tools](./tools/README.md)

Looking for Generative UI samples? Check out the [Generative UI](../generative_ui/README.md) directory.

app/ai_sdk/agent/README.md
# How to stream agent data to the client

This guide will walk you through how we stream agent data to the client using [React Server Components](https://react.dev/reference/rsc/server-components) inside this directory.
The code in this doc is taken from the `page.tsx` and `action.ts` files in this directory. To view the full, uninterrupted code, click [here for the actions file](./action.ts)
and [here for the client file](./page.tsx).

> ## Prerequisites
>
> This guide assumes familiarity with the following concepts:
>
> - [LangChain Expression Language](https://js.langchain.com/v0.2/docs/concepts#langchain-expression-language)
> - [Chat models](https://js.langchain.com/v0.2/docs/concepts#chat-models)
> - [Tool calling](https://js.langchain.com/v0.2/docs/concepts#functiontool-calling)
> - [Agents](https://js.langchain.com/v0.2/docs/concepts#agents)

## Setup

First, install the necessary LangChain & AI SDK packages:

```bash
npm install langchain @langchain/core @langchain/community ai
```

In this demo we'll be using the `TavilySearchResults` tool, which requires an API key. You can get one [here](https://app.tavily.com/), or you can swap it out for another tool of your choice, like
[`WikipediaQueryRun`](https://js.langchain.com/v0.2/docs/integrations/tools/wikipedia) which doesn't require an API key.

If you choose to use `TavilySearchResults`, set your API key like so:

```bash
export TAVILY_API_KEY=your_api_key
```

## Get started

The first step is to create a new RSC file, and add the imports which we'll use for running our agent. In this demo, we'll name it `action.ts`:

```typescript action.ts
"use server";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { createStreamableValue } from "ai/rsc";
```

Next, we'll define a `runAgent` function. This function takes in a single input of `string`, and contains all the logic for our agent and streaming data back to the client:

```typescript action.ts
export async function runAgent(input: string) {
  "use server";
}
```

Next, inside our function we'll define our chat model of choice:

```typescript action.ts
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});
```

Next, we'll use the `createStreamableValue` helper function provided by the `ai` package to create a streamable value:

```typescript action.ts
const stream = createStreamableValue();
```

This will be very important later on when we start streaming data back to the client.

Next, lets define our async function inside which contains the agent logic:

```typescript action.ts
  (async () => {
    const tools = [new TavilySearchResults({ maxResults: 1 })];

    const prompt = await pull<ChatPromptTemplate>(
      "hwchase17/openai-tools-agent",
    );

    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });
```

Here you can see we're doing a few things:

The first is we're defining our list of tools (in this case we're only using a single tool) and pulling in our prompt from the LangChain prompt hub.

After that, we're passing our LLM, tools and prompt to the `createToolCallingAgent` function, which will construct and return a runnable agent.
This is then passed into the `AgentExecutor` class, which will handle the execution & streaming of our agent.

Finally, we'll call `.streamEvents` and pass our streamed data back to the `stream` variable we defined above,

```typescript action.ts
    const streamingEvents = agentExecutor.streamEvents(
      { input },
      { version: "v1" },
    );

    for await (const item of streamingEvents) {
      stream.update(JSON.parse(JSON.stringify(item, null, 2)));
    }

    stream.done();
  })();
```

As you can see above, we're doing something a little wacky by stringifying and parsing our data. This is due to a bug in the RSC streaming code,
however if you stringify and parse like we are above, you shouldn't experience this.

Finally, at the bottom of the function return the stream value:

```typescript action.ts
return { streamData: stream.value };
```

Once we've implemented our server action, we can add a couple lines of code in our client function to request and stream this data:

First, add the necessary imports:

```typescript page.tsx
"use client";

import { useState } from "react";
import { readStreamableValue } from "ai/rsc";
import { runAgent } from "./action";
```

Then inside our `Page` function, calling the `runAgent` function is straightforward:

```typescript page.tsx
export default function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<StreamEvent[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { streamData } = await runAgent(input);
    for await (const item of readStreamableValue(streamData)) {
      setData((prev) => [...prev, item]);
    }
  }
}
```

That's it! You've successfully built an agent that streams data back to the client. You can now run your application and see the data streaming in real-time.

app/ai_sdk/agent/action.ts
```.ts
"use server";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { createStreamableValue } from "ai/rsc";

export async function runAgent(input: string) {
  "use server";

  const stream = createStreamableValue();
  (async () => {
    const tools = [new TavilySearchResults({ maxResults: 1 })];
    const prompt = await pull<ChatPromptTemplate>(
      "hwchase17/openai-tools-agent",
    );

    const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({ agent, tools });

    const streamingEvents = agentExecutor.streamEvents(
      { input },
      { version: "v2" },
    );

    for await (const item of streamingEvents) {
      stream.update(JSON.parse(JSON.stringify(item, null, 2)));
    }

    stream.done();
  })();

  return { streamData: stream.value };
}

```
app/ai_sdk/agent/page.tsx
```.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { readStreamableValue } from "ai/rsc";
import { runAgent } from "./action";
import { StreamEvent } from "@langchain/core/tracers/log_stream";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto w-full max-w-4xl py-12 flex flex-col stretch gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Input
          placeholder="What's the weather like in..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" disabled={isLoading}>
          Submit
        </Button>
      </form>
      <div
        ref={scrollRef}
        className="flex flex-col gap-2 px-2 h-[650px] overflow-y-auto"
      >
        {data.map((item, i) => (
          <div key={i} className="p-4 bg-[#25252f] rounded-lg">
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
        <div className="flex flex-col w-full gap-2">
          <strong className="text-center">Question</strong>
          <p className="break-words">{data[0].data.input.input}</p>
        </div>
      )}

      {!isLoading && data.length > 1 && (
        <>
          <hr />
          <div className="flex flex-col w-full gap-2">
            <strong className="text-center">Result</strong>
            <p className="break-words">{data[data.length - 1].data.output}</p>
          </div>
        </>
      )}
    </div>
  );
}

```
app/ai_sdk/page.tsx
```.tsx
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ExternalLinkSVG = ({
  height,
  width,
  className,
}: {
  height: number;
  width: number;
  className?: string;
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g id="Interface / External_Link">
      <path
        id="Vector"
        d="M10.0002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002V15.8002C5 16.9203 5 17.4801 5.21799 17.9079C5.40973 18.2842 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8031C16.921 19 17.48 19 17.9074 18.7822C18.2837 18.5905 18.5905 18.2839 18.7822 17.9076C19 17.4802 19 16.921 19 15.8031V14M20 9V4M20 4H15M20 4L13 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

const STREAM_EVENTS_API_URL =
  "https://v02.api.js.langchain.com/classes/langchain_core_language_models_base.BaseLangChain.html#streamEvents";

export default function Home() {
  return (
    <div className="py-8">
      <GuideInfoBox>
        <div className="flex flex-col gap-4 items-stretch">
          <p>
            The below section contains two examples using the LangChain.js
            framework, along with helper functions from the experimental AI SDK
            RSC showing off how to create complex, full stack streaming
            applications with React Server Components.
          </p>

          <div className="grid grid-cols-[1fr,auto] items-center gap-x-2 gap-y-6">
            <p className="text-left m-0">
              The <strong>Agents</strong> example contains an agent which
              streams data back to the client using the{" "}
              <a
                href={STREAM_EVENTS_API_URL}
                target="blank"
                className="inline-flex items-center gap-1 underline"
              >
                streamEvents
                <ExternalLinkSVG className="inline" height={12} width={12} />
              </a>{" "}
              API.
            </p>

            <Button asChild variant="outline">
              <Link href="/ai_sdk/agent">
                <span>Go to Agents</span>
                <ExternalLinkSVG className="inline" height={16} width={16} />
              </Link>
            </Button>

            <p className="text-left m-0">
              The <strong>Tools</strong> example shows how to invoke a simple
              tool calling model, and stream back the result.
            </p>

            <Button asChild variant="outline">
              <Link href="/ai_sdk/tools">
                <span>Go to Tools</span>
                <ExternalLinkSVG className="inline" height={16} width={16} />
              </Link>
            </Button>
          </div>
        </div>
      </GuideInfoBox>
    </div>
  );
}

```
app/ai_sdk/tools/README.md
# How to stream structured output to the client

This guide will walk you through how we stream agent data to the client using [React Server Components](https://react.dev/reference/rsc/server-components) inside this directory.
The code in this doc is taken from the `page.tsx` and `action.ts` files in this directory. To view the full, uninterrupted code, click [here for the actions file](./action.ts)
and [here for the client file](./page.tsx).

> ## Prerequisites
>
> This guide assumes familiarity with the following concepts:
>
> - [LangChain Expression Language](https://js.langchain.com/v0.2/docs/concepts#langchain-expression-language)
> - [Chat models](https://js.langchain.com/v0.2/docs/concepts#chat-models)
> - [Tool calling](https://js.langchain.com/v0.2/docs/concepts#functiontool-calling)

## Setup

First, install the necessary LangChain & AI SDK packages:

```bash
npm install @langchain/openai @langchain/core ai zod zod-to-json-schema
```

Next, we'll create our server file.
This will contain all the logic for making tool calls and sending the data back to the client.

Start by adding the necessary imports & the `"use server"` directive:

```typescript
"use server";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStreamableValue } from "ai/rsc";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
```

After that, we'll define our tool schema. For this example we'll use a simple demo weather schema:

```typescript
const Weather = z
  .object({
    city: z.string().describe("City to search for weather"),
    state: z.string().describe("State abbreviation to search for weather"),
  })
  .describe("Weather search parameters");
```

Once our schema is defined, we can implement our `executeTool` function.
This function takes in a single input of `string`, and contains all the logic for our tool and streaming data back to the client:

```typescript
export async function executeTool(
  input: string,
) {
  "use server";

  const stream = createStreamableValue();
```

The `createStreamableValue` function is important as this is what we'll use for actually streaming all the data back to the client.

For the main logic, we'll wrap it in an async function. Start by defining our prompt and chat model:

```typescript
  (async () => {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant. Use the tools provided to best assist the user.`,
      ],
      ["human", "{input}"],
    ]);

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

```

After defining our chat model, we'll define our runnable chain using LCEL.

We start binding our `weather` tool we defined earlier to the model:

```typescript
const modelWithTools = llm.bind({
  tools: [
    {
      type: "function" as const,
      function: {
        name: "get_weather",
        description: Weather.description,
        parameters: zodToJsonSchema(Weather),
      },
    },
  ],
});
```

Next, we'll use LCEL to pipe each component together, starting with the prompt, then the model with tools, and finally the output parser:

```typescript
const chain = prompt.pipe(modelWithTools).pipe(
  new JsonOutputKeyToolsParser<z.infer<typeof Weather>>({
    keyName: "get_weather",
    zodSchema: Weather,
  }),
);
```

Finally, we'll call `.stream` on our chain, and similarly to the [streaming agent](../agent/README.md)
example, we'll iterate over the stream and stringify + parse the data before updating the stream value:

```typescript
    const streamResult = await chain.stream({
      input,
    });

    for await (const item of streamResult) {
      stream.update(JSON.parse(JSON.stringify(item, null, 2)));
    }

    stream.done();
  })();

  return { streamData: stream.value };
}
```

app/ai_sdk/tools/action.ts
```.ts
"use server";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStreamableValue } from "ai/rsc";
import { z } from "zod";
import { Runnable } from "@langchain/core/runnables";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";

const Weather = z
  .object({
    city: z.string().describe("City to search for weather"),
    state: z.string().describe("State abbreviation to search for weather"),
  })
  .describe("Weather search parameters");

export async function executeTool(
  input: string,
  options?: {
    wso?: boolean;
    streamEvents?: boolean;
  },
) {
  "use server";

  const stream = createStreamableValue();

  (async () => {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant. Use the tools provided to best assist the user.`,
      ],
      ["human", "{input}"],
    ]);

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

    let chain: Runnable;

    if (options?.wso) {
      chain = prompt.pipe(
        llm.withStructuredOutput(Weather, {
          name: "get_weather",
        }),
      );
    } else {
      chain = prompt
        .pipe(
          llm.bind({
            tools: [
              {
                type: "function" as const,
                function: {
                  name: "get_weather",
                  description: Weather.description,
                  parameters: zodToJsonSchema(Weather),
                },
              },
            ],
          }),
        )
        .pipe(
          new JsonOutputKeyToolsParser<z.infer<typeof Weather>>({
            keyName: "get_weather",
            zodSchema: Weather,
          }),
        );
    }

    if (options?.streamEvents) {
      const streamResult = chain.streamEvents(
        {
          input,
        },
        {
          version: "v2",
        },
      );

      for await (const item of streamResult) {
        stream.update(JSON.parse(JSON.stringify(item, null, 2)));
      }
    } else {
      const streamResult = await chain.stream({
        input,
      });

      for await (const item of streamResult) {
        stream.update(JSON.parse(JSON.stringify(item, null, 2)));
      }
    }

    stream.done();
  })();

  return { streamData: stream.value };
}

```
app/ai_sdk/tools/page.tsx
```.tsx
"use client";

import { readStreamableValue } from "ai/rsc";
import React, { useEffect, useRef, useState } from "react";
import { executeTool } from "./action";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto w-full max-w-4xl py-12 flex flex-col stretch gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Input
          placeholder="What's the weather in XYZ city and XYZ state"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex items-center">
          <Checkbox
            id="wso-checkbox"
            checked={options.wso}
            onCheckedChange={(checked) =>
              setOptions((prev) => ({ ...prev, wso: !!checked }))
            }
          />
          <label htmlFor="wso-checkbox" className="ml-2 text-sm font-medium">
            Use <code>withStructuredOutput</code>
          </label>
        </div>
        <div className="flex items-center">
          <Checkbox
            id="stream-events-checkbox"
            checked={options.streamEvents}
            onCheckedChange={(checked) =>
              setOptions((prev) => ({ ...prev, streamEvents: !!checked }))
            }
          />
          <label
            htmlFor="stream-events-checkbox"
            className="ml-2 text-sm font-medium"
          >
            Use <code>streamEvents</code>
          </label>
        </div>
        <Button type="submit" disabled={isLoading}>
          Submit
        </Button>
      </form>
      <div
        ref={scrollRef}
        className="flex flex-col gap-2 px-2 h-[650px] overflow-y-auto"
      >
        {data.map((item, i) => (
          <div key={i} className="p-4 bg-[#25252f] rounded-lg">
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
          <div className="flex flex-col w-full gap-2">
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

```
app/api/chat/agents/route.ts
```.ts
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Calculator } from "@langchain/community/tools/calculator";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

const AGENT_SYSTEM_TEMPLATE = `You are a talking parrot named Polly. All final responses must be how a talking parrot would respond. Squawk often!`;

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    // Requires process.env.SERPAPI_API_KEY to be set: https://serpapi.com/
    // You can remove this or use a different tool instead.
    const tools = [new Calculator(), new SerpAPI()];
    const chat = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = createReactAgent({
      llm: chat,
      tools,
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" },
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });

      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

```
app/api/chat/retrieval/route.ts
```.ts
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createClient } from "@supabase/supabase-js";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";

export const runtime = "edge";

const combineDocumentsFn = (docs: Document[]) => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join("\n\n");
};

const formatVercelMessages = (chatHistory: VercelChatMessage[]) => {
  const formattedDialogueTurns = chatHistory.map((message) => {
    if (message.role === "user") {
      return `Human: ${message.content}`;
    } else if (message.role === "assistant") {
      return `Assistant: ${message.content}`;
    } else {
      return `${message.role}: ${message.content}`;
    }
  });
  return formattedDialogueTurns.join("\n");
};

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;
const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);

const ANSWER_TEMPLATE = `You are an energetic talking puppy named Dana, and must answer all questions like a happy, talking dog would.
Use lots of puns!

Answer the question based only on the following context and chat history:
<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
`;
const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

/**
 * This handler initializes and calls a retrieval chain. It composes the chain using
 * LangChain Expression Language. See the docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/qa_chat_history_how_to/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const previousMessages = messages.slice(0, -1);
    const currentMessageContent = messages[messages.length - 1].content;

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    const vectorstore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });

    /**
     * We use LangChain Expression Language to compose two chains.
     * To learn more, see the guide here:
     *
     * https://js.langchain.com/docs/guides/expression_language/cookbook
     *
     * You can also use the "createRetrievalChain" method with a
     * "historyAwareRetriever" to get something prebaked.
     */
    const standaloneQuestionChain = RunnableSequence.from([
      condenseQuestionPrompt,
      model,
      new StringOutputParser(),
    ]);

    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    const retriever = vectorstore.asRetriever({
      callbacks: [
        {
          handleRetrieverEnd(documents) {
            resolveWithDocuments(documents);
          },
        },
      ],
    });

    const retrievalChain = retriever.pipe(combineDocumentsFn);

    const answerChain = RunnableSequence.from([
      {
        context: RunnableSequence.from([
          (input) => input.question,
          retrievalChain,
        ]),
        chat_history: (input) => input.chat_history,
        question: (input) => input.question,
      },
      answerPrompt,
      model,
    ]);

    const conversationalRetrievalQAChain = RunnableSequence.from([
      {
        question: standaloneQuestionChain,
        chat_history: (input) => input.chat_history,
      },
      answerChain,
      new BytesOutputParser(),
    ]);

    const stream = await conversationalRetrievalQAChain.stream({
      question: currentMessageContent,
      chat_history: formatVercelMessages(previousMessages),
    });

    const documents = await documentPromise;
    const serializedSources = Buffer.from(
      JSON.stringify(
        documents.map((doc) => {
          return {
            pageContent: doc.pageContent.slice(0, 50) + "...",
            metadata: doc.metadata,
          };
        }),
      ),
    ).toString("base64");

    return new StreamingTextResponse(stream, {
      headers: {
        "x-message-index": (previousMessages.length + 1).toString(),
        "x-sources": serializedSources,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

```
app/api/chat/retrieval_agents/route.ts
```.ts
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createClient } from "@supabase/supabase-js";

import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createRetrieverTool } from "langchain/tools/retriever";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

const AGENT_SYSTEM_TEMPLATE = `You are a stereotypical robot named Robbie and must answer all questions like a stereotypical robot. Use lots of interjections like "BEEP" and "BOOP".

If you don't know how to answer a question, use the available tools to look up relevant information. You should particularly do this for questions about LangChain.`;

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 * https://js.langchain.com/docs/use_cases/question_answering/conversational_retrieval_agents
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);
    const returnIntermediateSteps = body.show_intermediate_steps;

    const chatModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    const vectorstore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });

    const retriever = vectorstore.asRetriever();

    /**
     * Wrap the retriever in a tool to present it to the agent in a
     * usable form.
     */
    const tool = createRetrieverTool(retriever, {
      name: "search_latest_knowledge",
      description: "Searches and returns up-to-date general information.",
    });

    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = await createReactAgent({
      llm: chatModel,
      tools: [tool],
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = await agent.streamEvents(
        {
          messages,
        },
        { version: "v2" },
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });
      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

```
app/api/chat/route.ts
```.ts
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const runtime = "edge";

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

Current conversation:
{chat_history}

User: {input}
AI:`;

/**
 * This handler initializes and calls a simple chain with a prompt,
 * chat model, and output parser. See the docs for more information:
 *
 * https://js.langchain.com/docs/guides/expression_language/cookbook#prompttemplate--llm--outputparser
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    /**
     * You can also try e.g.:
     *
     * import { ChatAnthropic } from "@langchain/anthropic";
     * const model = new ChatAnthropic({});
     *
     * See a full list of supported models at:
     * https://js.langchain.com/docs/modules/model_io/models/
     */
    const model = new ChatOpenAI({
      temperature: 0.8,
      model: "gpt-4o-mini",
    });

    /**
     * Chat models stream message chunks rather than bytes, so this
     * output parser handles serialization and byte-encoding.
     */
    const outputParser = new HttpResponseOutputParser();

    /**
     * Can also initialize as:
     *
     * import { RunnableSequence } from "@langchain/core/runnables";
     * const chain = RunnableSequence.from([prompt, model, outputParser]);
     */
    const chain = prompt.pipe(model).pipe(outputParser);

    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"),
      input: currentMessageContent,
    });

    return new StreamingTextResponse(stream);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

```
app/api/chat/structured_output/route.ts
```.ts
import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

export const runtime = "edge";

const TEMPLATE = `Extract the requested fields from the input.

The field "entity" refers to the first mentioned entity in the input.

Input:

{input}`;

/**
 * This handler initializes and calls an OpenAI Functions powered
 * structured output chain. See the docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/structured_output
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const currentMessageContent = messages[messages.length - 1].content;

    const prompt = PromptTemplate.fromTemplate(TEMPLATE);
    /**
     * Function calling is currently only supported with ChatOpenAI models
     */
    const model = new ChatOpenAI({
      temperature: 0.8,
      model: "gpt-4o-mini",
    });

    /**
     * We use Zod (https://zod.dev) to define our schema for convenience,
     * but you can pass JSON schema if desired.
     */
    const schema = z
      .object({
        tone: z
          .enum(["positive", "negative", "neutral"])
          .describe("The overall tone of the input"),
        entity: z.string().describe("The entity mentioned in the input"),
        word_count: z.number().describe("The number of words in the input"),
        chat_response: z.string().describe("A response to the human's input"),
        final_punctuation: z
          .optional(z.string())
          .describe("The final punctuation mark in the input, if any."),
      })
      .describe("Should always be used to properly format output");

    /**
     * Bind schema to the OpenAI model.
     * Future invocations of the returned model will always match the schema.
     *
     * Under the hood, uses tool calling by default.
     */
    const functionCallingModel = model.withStructuredOutput(schema, {
      name: "output_formatter",
    });

    /**
     * Returns a chain with the function calling model.
     */
    const chain = prompt.pipe(functionCallingModel);

    const result = await chain.invoke({
      input: currentMessageContent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

```
app/api/retrieval/ingest/route.ts
```.ts
import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";

export const runtime = "edge";

// Before running, follow set-up instructions at
// https://js.langchain.com/v0.2/docs/integrations/vectorstores/supabase

/**
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * into a vector store for later retrieval. See the following docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/recursive_text_splitter
 * https://js.langchain.com/v0.2/docs/integrations/vectorstores/supabase
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = body.text;

  if (process.env.NEXT_PUBLIC_DEMO === "true") {
    return NextResponse.json(
      {
        error: [
          "Ingest is not supported in demo mode.",
          "Please set up your own version of the repo here: https://github.com/langchain-ai/langchain-nextjs-template",
        ].join("\n"),
      },
      { status: 403 },
    );
  }

  try {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );

    const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: 256,
      chunkOverlap: 20,
    });

    const splitDocuments = await splitter.createDocuments([text]);

    const vectorstore = await SupabaseVectorStore.fromDocuments(
      splitDocuments,
      new OpenAIEmbeddings(),
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      },
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

```
app/globals.css
```.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 100% 50%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20.2% 65.1%;
    --radius: 0.5rem;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --background: 224 71% 4%;
      --foreground: 213 31% 91%;
      --muted: 223 47% 11%;
      --muted-foreground: 215.4 16.3% 56.9%;
      --accent: 216 34% 17%;
      --accent-foreground: 210 40% 98%;
      --popover: 224 71% 4%;
      --popover-foreground: 215 20.2% 65.1%;
      --border: 216 34% 17%;
      --input: 216 34% 17%;
      --card: 224 71% 4%;
      --card-foreground: 213 31% 91%;
      --primary: 210 40% 98%;
      --primary-foreground: 222.2 47.4% 1.2%;
      --secondary: 222.2 47.4% 11.2%;
      --secondary-foreground: 210 40% 98%;
      --destructive: 0 63% 31%;
      --destructive-foreground: 210 40% 98%;
      --ring: 216 34% 17%;
    }
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply font-sans antialiased bg-background text-foreground;
  }

  p {
    margin: 8px 0;
  }

  code {
    @apply dark:text-orange-400 text-orange-700;
  }

  li {
    padding: 4px;
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}

```
app/langgraph/agent/.gitignore
```.gitignore

# LangGraph API
.langgraph_api

```
app/langgraph/agent/agent.ts
```.ts
import {
  StateGraph,
  MessagesAnnotation,
  START,
  Annotation,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

const builder = new StateGraph(
  Annotation.Root({
    messages: MessagesAnnotation.spec["messages"],
    timestamp: Annotation<number>,
  }),
)
  .addNode("agent", async (state, config) => {
    const message = await llm.invoke([
      {
        type: "system",
        content:
          "You are a pirate named Patchy. " +
          "All responses must be extremely verbose and in pirate dialect.",
      },
      ...state.messages,
    ]);

    return { messages: message, timestamp: Date.now() };
  })
  .addEdge(START, "agent");

export const graph = builder.compile();

```
app/langgraph/agent/langgraph.json
```.json
{
  "graphs": {
    "agent": "./agent.ts:graph"
  },
  "_INTERNAL_docker_tag": "20",
  "env": ".env"
}

```
app/langgraph/page.tsx
```.tsx
"use client";

import { ChatInput, ChatLayout } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { ReactNode, Suspense, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import { useStream } from "@langchain/langgraph-sdk/react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Client, Message } from "@langchain/langgraph-sdk";

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
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onSubmit={(e) => {
        e.preventDefault();
        onEdit({ type: "human", content: editValue });
      }}
      actions={
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
      }
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
        onEdit={props.onEdit}
        onCancel={() => setIsEditing(false)}
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
          `rounded-[24px] flex`,
          props.message.type === "human"
            ? "bg-secondary text-secondary-foreground px-4 py-2"
            : null,
        )}
      >
        <div className="whitespace-pre-wrap flex flex-col">
          {typeof props.message.content === "string"
            ? props.message.content
            : props.message.content.map((part) => {
                if (part.type === "text") return part.text;
                return null;
              })}
        </div>
      </div>

      {props.message.type === "human" && (
        <div className="ml-auto flex justify-end items-center gap-2 mt-2">
          <button
            className="text-muted-foreground text-right text-sm"
            type="button"
            onClick={() => setIsEditing(true)}
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
            <button type="button" onClick={props.onRegenerate}>
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
    <div className="flex items-center gap-2 text-sm justify-end">
      <button
        type="button"
        className="flex-shrink-0"
        onClick={() => {
          const nextIndex = Math.max(0, index - 1);
          const next = props.branches[nextIndex];
          props.onSelect(next);
        }}
      >
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </button>

      <span className="text-muted-foreground">
        {index + 1} / {props.branches.length}
      </span>

      <button
        type="button"
        className="flex-shrink-0"
        onClick={() => {
          const nextIndex = Math.min(props.branches.length - 1, index + 1);
          const next = props.branches[nextIndex];
          props.onSelect(next);
        }}
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onStop={props.onStop}
      onSubmit={(e) => {
        e.preventDefault();
        setInput("");
        props.onSubmit(input);
      }}
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
          <div className="flex flex-col gap-4 max-w-[768px] mx-auto mb-16">
            <div className="flex justify-between gap-2 items-center">
              <span>Timestamp: {thread.values.timestamp}</span>
            </div>

            <div className="flex justify-between gap-2 items-center">
              <span>Thread ID: {threadId}</span>
              <Button
                variant="outline"
                type="button"
                onClick={() => setThreadId(null)}
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
                  key={message.id ?? index}
                  message={message}
                  onEdit={(message) =>
                    thread.submit({ messages: [message] }, { checkpoint })
                  }
                  onRegenerate={() => thread.submit(undefined, { checkpoint })}
                  actions={
                    meta?.branch != null &&
                    meta?.branchOptions != null && (
                      <BranchPicker
                        current={meta.branch}
                        branches={meta.branchOptions}
                        onSelect={thread.setBranch}
                      />
                    )
                  }
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

```
app/layout.tsx
```.tsx
import "./globals.css";
import { Public_Sans } from "next/font/google";
import { ActiveLink } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const publicSans = Public_Sans({ subsets: ["latin"] });

const Logo = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 240 41"
    className="h-8 flex-shrink-0 self-start"
  >
    <path
      fill="currentColor"
      d="M61.514 11.157a3.943 3.943 0 0 0-2.806 1.158l-3.018 3.01a3.951 3.951 0 0 0-1.147 3.095l.019.191a3.894 3.894 0 0 0 1.128 2.314c.435.434.914.709 1.496.9.03.175.047.352.047.53 0 .797-.31 1.546-.874 2.107l-.186.186c-1.008-.344-1.848-.847-2.607-1.604a6.888 6.888 0 0 1-1.927-3.67l-.034-.193-.153.124a3.675 3.675 0 0 0-.294.265l-3.018 3.01a3.957 3.957 0 0 0 2.807 6.757 3.959 3.959 0 0 0 2.806-1.158l3.019-3.01a3.958 3.958 0 0 0 0-5.599 3.926 3.926 0 0 0-1.462-.92 3.252 3.252 0 0 1 .924-2.855 6.883 6.883 0 0 1 2.664 1.656 6.906 6.906 0 0 1 1.926 3.67l.035.193.153-.124c.104-.083.202-.173.296-.267l3.018-3.01a3.956 3.956 0 0 0-2.808-6.756h-.004Z"
    />
    <path
      fill="currentColor"
      d="M59.897.149h-39.49C9.153.149 0 9.279 0 20.5c0 11.222 9.154 20.351 20.406 20.351h39.49c11.253 0 20.407-9.13 20.407-20.35C80.303 9.277 71.149.148 59.897.148ZM40.419 32.056c-.651.134-1.384.158-1.882-.36-.183.42-.612.199-.943.144-.03.085-.057.16-.085.246-1.1.073-1.925-1.046-2.449-1.89-1.04-.562-2.222-.904-3.285-1.492-.062.968.15 2.17-.774 2.794-.047 1.862 2.824.22 3.088 1.608-.204.022-.43-.033-.594.124-.749.726-1.608-.55-2.471-.023-1.16.582-1.276 1.059-2.71 1.179-.08-.12-.047-.2.02-.273.404-.468.433-1.02 1.122-1.22-.71-.111-1.303.28-1.901.59-.778.317-.772-.717-1.968.054-.132-.108-.069-.206.007-.289.304-.37.704-.425 1.155-.405-2.219-1.233-3.263 1.508-4.288.145-.308.081-.424.358-.618.553-.167-.183-.04-.405-.033-.62-.2-.094-.453-.139-.394-.459-.391-.132-.665.1-.957.32-.263-.203.178-.5.26-.712.234-.407.769-.084 1.04-.377.772-.437 1.847.273 2.729.153.68.085 1.52-.61 1.179-1.305-.726-.926-.598-2.137-.614-3.244-.09-.645-1.643-1.467-2.092-2.163-.555-.627-.987-1.353-1.42-2.068-1.561-3.014-1.07-6.886-3.037-9.685-.89.49-2.048.259-2.816-.399-.414.377-.432.87-.465 1.392-.994-.99-.87-2.863-.075-3.966a5.276 5.276 0 0 1 1.144-1.11c.098-.07.131-.14.129-.25.786-3.524 6.144-2.845 7.838-.348 1.229 1.537 1.6 3.57 2.994 4.997 1.875 2.047 4.012 3.85 5.742 6.03 1.637 1.992 2.806 4.328 3.826 6.683.416.782.42 1.74 1.037 2.408.304.403 1.79 1.5 1.467 1.888.186.403 1.573.959 1.092 1.35h.002Zm26.026-12.024-3.018 3.01a6.955 6.955 0 0 1-2.875 1.728l-.056.016-.02.053a6.865 6.865 0 0 1-1.585 2.446l-3.019 3.01a6.936 6.936 0 0 1-4.932 2.035 6.936 6.936 0 0 1-4.932-2.035 6.95 6.95 0 0 1 0-9.838l3.018-3.01a6.882 6.882 0 0 1 2.871-1.721l.055-.017.02-.053a6.932 6.932 0 0 1 1.59-2.454l3.019-3.01a6.936 6.936 0 0 1 4.932-2.035c1.865 0 3.616.723 4.932 2.035a6.898 6.898 0 0 1 2.04 4.92c0 1.86-.724 3.607-2.04 4.918v.002Z"
    />
    <path
      fill="currentColor"
      d="M28.142 28.413c-.265 1.03-.35 2.782-1.694 2.832-.11.595.413.819.89.627.472-.215.696.171.855.556.729.106 1.806-.242 1.847-1.103-1.088-.625-1.424-1.813-1.896-2.914l-.002.002ZM99.209 10.816h-3.585v21.746H111v-3.464H99.209V10.816ZM129.021 32.562h3.585v-.038h.047l.007-.16c.001-.047.014-.482-.052-1.152v-8.094c0-3.045 2.22-4.43 4.283-4.43 2.219 0 3.299 1.195 3.299 3.657v10.217h3.585V21.867c0-4.062-2.581-6.586-6.734-6.586-1.765 0-3.34.502-4.577 1.454l-.033-1.156h-3.405v16.983h-.005ZM158.365 16.827c-1.246-1.012-2.848-1.546-4.655-1.546-4.834 0-7.837 3.334-7.837 8.7s3.003 8.73 7.837 8.73c1.705 0 3.227-.465 4.426-1.348-.103 2.632-1.752 4.196-4.455 4.196-2.273 0-3.559-.724-3.823-2.15l-.033-.178-3.483 1.063.031.143c.588 2.835 3.241 4.528 7.1 4.528 2.618 0 4.671-.713 6.104-2.12 1.446-1.418 2.178-3.462 2.178-6.073V15.579h-3.316l-.072 1.248h-.002Zm-.224 7.303c0 3.24-1.578 5.176-4.223 5.176-2.835 0-4.46-1.94-4.46-5.324 0-3.383 1.626-5.295 4.46-5.295 2.581 0 4.197 1.926 4.223 5.026v.418ZM179.418 25.666c-.743 2.404-2.651 3.729-5.371 3.729-3.889 0-6.307-2.953-6.307-7.707 0-4.753 2.439-7.706 6.367-7.706 2.718 0 4.284 1.065 5.081 3.453l.372 1.117 3.385-1.59-.318-.894c-1.289-3.632-4.266-5.55-8.609-5.55-2.951 0-5.456 1.065-7.245 3.08-1.77 1.996-2.707 4.792-2.707 8.092 0 6.786 3.917 11.172 9.981 11.172 4.273 0 7.583-2.236 8.853-5.982l.324-.957-3.477-1.322-.331 1.067.002-.002ZM192.806 15.281c-1.712 0-3.235.47-4.431 1.36V8.733h-3.585v23.832h3.585V23.12c0-3.064 2.219-4.46 4.283-4.46 2.219 0 3.299 1.196 3.299 3.657v10.249h3.585V21.84c0-3.983-2.643-6.556-6.734-6.556l-.002-.003ZM220.496 8.22c-1.332 0-2.299.967-2.299 2.298 0 1.332.967 2.299 2.299 2.299 1.331 0 2.298-.967 2.298-2.299 0-1.331-.967-2.298-2.298-2.298ZM233.262 15.281c-1.765 0-3.339.502-4.576 1.454l-.034-1.156h-3.404v16.983h3.585v-9.444c0-3.045 2.219-4.43 4.283-4.43 2.219 0 3.299 1.195 3.299 3.657v10.217H240V21.867c0-4.062-2.581-6.586-6.734-6.586h-.004ZM222.237 15.58h-3.567v8.418c-.99-.831-2.156-1.46-3.472-1.871v-.856c0-3.75-2.462-5.99-6.587-5.99-3.351 0-5.857 1.574-6.878 4.315l-.275.74 2.874 2.118.493-1.285c.65-1.694 1.854-2.483 3.786-2.483 1.933 0 3.002.93 3.002 2.762v.096a12.075 12.075 0 0 0-.347-.01c-3.838-.061-6.638.836-8.322 2.664-1.723 1.87-1.572 3.97-1.549 4.202l.016.162h.016c.268 2.616 2.553 4.295 5.874 4.295 1.829 0 3.519-.509 4.797-1.44l.014 1.144h3.086v-5.313l-.067-.048c-.436-.32-1.197-.732-2.342-.877a7.087 7.087 0 0 0-1.018-.061h-.16v.488c0 1.123-1.291 2.705-4.163 2.705-2.12 0-2.436-.892-2.436-1.424v-.054c.016-.239.116-.823.643-1.366.669-.691 2.175-1.5 5.552-1.449 2.445.039 4.321.722 5.577 2.033 1.541 1.608 1.831 3.81 1.884 4.673v.694h3.567V15.58h.002ZM119.752 15.207c-3.351 0-5.857 1.573-6.878 4.315l-.275.74 2.874 2.118.493-1.285c.65-1.694 1.854-2.484 3.786-2.484 1.933 0 3.002.93 3.002 2.763v.43l-3.692.652c-4.328.765-6.523 2.616-6.523 5.498s2.316 4.83 5.901 4.83c1.83 0 3.519-.51 4.797-1.44l.015 1.143h3.085v-11.29c0-3.751-2.462-5.99-6.586-5.99h.001Zm3.002 9.957v1.513c0 1.124-1.292 2.705-4.164 2.705-2.12 0-2.435-.891-2.435-1.423 0-.473 0-1.578 3.755-2.275l2.844-.519v-.001Z"
    />
  </svg>
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>LangChain + Next.js Template</title>
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <meta
          name="description"
          content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
        />
        <meta property="og:title" content="LangChain + Next.js Template" />
        <meta
          property="og:description"
          content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
        />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="LangChain + Next.js Template" />
        <meta
          name="twitter:description"
          content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
        />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      <body className={publicSans.className}>
        <NuqsAdapter>
          <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh]">
            <div className="grid grid-cols-[1fr,auto] gap-2 p-4">
              <div className="flex gap-4 flex-col md:flex-row md:items-center">
                <a
                  href="https://js.langchain.com"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="flex items-center gap-2"
                >
                  <Logo />
                </a>
                <nav className="flex gap-1 flex-col md:flex-row">
                  <ActiveLink href="/">🏴‍☠️ Chat</ActiveLink>
                  <ActiveLink href="/structured_output">
                    🧱 Structured Output
                  </ActiveLink>
                  <ActiveLink href="/agents">🦜 Agents</ActiveLink>
                  <ActiveLink href="/retrieval">🐶 Retrieval</ActiveLink>
                  <ActiveLink href="/retrieval_agents">
                    🤖 Retrieval Agents
                  </ActiveLink>
                  <ActiveLink href="/ai_sdk">
                    🌊 React Server Components
                  </ActiveLink>
                  <ActiveLink href="/langgraph">🕸️ LangGraph</ActiveLink>
                </nav>
              </div>

              <div className="flex justify-center">
                <Button asChild variant="outline" size="default">
                  <a
                    href="https://github.com/langchain-ai/langchain-nextjs-template"
                    target="_blank"
                  >
                    <GithubIcon className="size-3" />
                    <span>Open in GitHub</span>
                  </a>
                </Button>
              </div>
            </div>
            <div className="bg-background mx-4 relative grid rounded-t-2xl border border-input border-b-0">
              <div className="absolute inset-0">{children}</div>
            </div>
          </div>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}

```
app/page.tsx
```.tsx
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function Home() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🤝
          <span className="ml-2">
            This template showcases a simple chatbot using{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/route.ts</code>.
          </span>
        </li>
        <li>
          🏴‍☠️
          <span className="ml-2">
            By default, the bot is pretending to be a pirate, but you can change
            the prompt to whatever you want!
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in <code>app/page.tsx</code>.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking e.g. <code>What is it like to be a pirate?</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="api/chat"
      emoji="🏴‍☠️"
      placeholder="I'm an LLM pretending to be a pirate! Ask me about the pirate life!"
      emptyStateComponent={InfoCard}
    />
  );
}

```
app/retrieval/page.tsx
```.tsx
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="hidden text-l md:block">
          🔗
          <span className="ml-2">
            This template showcases how to perform retrieval with a{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            chain and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🪜
          <span className="ml-2">The chain works in two steps:</span>
          <ul>
            <li className="ml-4">
              1️⃣
              <span className="ml-2">
                First, it rephrases the input question into a
                &quot;standalone&quot; question, dereferencing pronouns based on
                the chat history.
              </span>
            </li>
            <li className="ml-4">
              2️⃣
              <span className="ml-2">
                Then, it queries the retriever for documents similar to the
                dereferenced question and composes an answer.
              </span>
            </li>
          </ul>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/retrieval/route.ts</code>.
          </span>
        </li>
        <li>
          🐶
          <span className="ml-2">
            By default, the agent is pretending to be a talking puppy, but you
            can change the prompt to whatever you want!
          </span>
        </li>
        <li className="text-l">
          🎨
          <span className="ml-2">
            The main frontend logic is found in{" "}
            <code>app/retrieval/page.tsx</code>.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🔱
          <span className="ml-2">
            Before running this example on your own, you&apos;ll first need to
            set up a Supabase vector store. See the README for more details.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Upload some text, then try asking e.g.{" "}
            <code>What is a document loader?</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="api/chat/retrieval"
      emptyStateComponent={InfoCard}
      showIngestForm={true}
      placeholder={
        'I\'ve got a nose for finding the right documents! Ask, "What is a document loader?"'
      }
      emoji="🐶"
    />
  );
}

```
app/retrieval_agents/page.tsx
```.tsx
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="hidden text-l md:block">
          🤝
          <span className="ml-2">
            This template showcases a{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            retrieval chain and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🛠️
          <span className="ml-2">
            The agent has access to a vector store retriever as a tool as well
            as a memory. It&apos;s particularly well suited to meta-questions
            about the current conversation.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/retrieval_agents/route.ts</code>.
          </span>
        </li>
        <li>
          🤖
          <span className="ml-2">
            By default, the agent is pretending to be a robot, but you can
            change the prompt to whatever you want!
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in{" "}
            <code>app/retrieval_agents/page.tsx</code>.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🔱
          <span className="ml-2">
            Before running this example, you&apos;ll first need to set up a
            Supabase (or other) vector store. See the README for more details.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Upload some text, then try asking e.g.{" "}
            <code>What are some ways of doing retrieval in LangChain?</code>{" "}
            below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <ChatWindow
      endpoint="api/chat/retrieval_agents"
      emptyStateComponent={InfoCard}
      showIngestForm={true}
      showIntermediateStepsToggle={true}
      placeholder={
        'Beep boop! I\'m a robot retrieval-focused agent! Ask, "What are some ways of doing retrieval in LangChain.js?"'
      }
      emoji="🤖"
    />
  );
}

```
app/structured_output/page.tsx
```.tsx
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🧱
          <span className="ml-2">
            This template showcases how to output structured responses with a{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            chain and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li>
          ☎️
          <span className="ml-2">
            The chain formats the input schema and passes it into an OpenAI
            Functions model, then parses the output.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt, model, and schema logic for this use-case
            in <code>app/api/chat/structured_output/route.ts</code>.
          </span>
        </li>
        <li className="hidden text-l md:block">
          📊
          <span className="ml-2">
            By default, the chain returns an object with <code>tone</code>,{" "}
            <code>word_count</code>, <code>entity</code>,{" "}
            <code>chat_response</code>, and an optional{" "}
            <code>final_punctuation</code>, but you can change it to whatever
            you&apos;d like!
          </span>
        </li>
        <li className="hidden text-l md:block">
          💎
          <span className="ml-2">
            It uses a lightweight, convenient, and powerful{" "}
            <a href="https://zod.dev/" target="_blank">
              schema validation library called Zod
            </a>{" "}
            to define schemas, but you can initialize the chain with JSON schema
            too.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in{" "}
            <code>app/structured_output/page.tsx</code>.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try typing e.g. <code>What a beautiful day!</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="api/chat/structured_output"
      emptyStateComponent={InfoCard}
      placeholder={`No matter what you type here, I'll always return the same JSON object with the same structure!`}
      emoji="🧱"
    />
  );
}

```
components.json
```.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/utils",
    "lib": "@/utils",
    "hooks": "@/utils"
  },
  "iconLibrary": "lucide"
}

```
components/ChatMessageBubble.tsx
```.tsx
import { cn } from "@/utils/cn";
import type { Message } from "ai/react";

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
}) {
  return (
    <div
      className={cn(
        `rounded-[24px] max-w-[80%] mb-8 flex`,
        props.message.role === "user"
          ? "bg-secondary text-secondary-foreground px-4 py-2"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="mr-4 border bg-secondary -mt-2 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {props.aiEmoji}
        </div>
      )}

      <div className="whitespace-pre-wrap flex flex-col">
        <span>{props.message.content}</span>

        {props.sources && props.sources.length ? (
          <>
            <code className="mt-4 mr-auto bg-primary px-2 py-1 rounded">
              <h2>🔍 Sources:</h2>
            </code>
            <code className="mt-1 mr-2 bg-primary px-2 py-1 rounded text-xs">
              {props.sources?.map((source, i) => (
                <div className="mt-2" key={"source:" + i}>
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

```
components/ChatWindow.tsx
```.tsx
"use client";

import { type Message } from "ai";
import { useChat } from "ai/react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "./IntermediateStep";
import { Button } from "./ui/button";
import { ArrowDown, LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { UploadDocumentsForm } from "./UploadDocumentsForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { cn } from "@/utils/cn";

function ChatMessages(props: {
  messages: Message[];
  emptyStateComponent: ReactNode;
  sourcesForMessages: Record<string, any>;
  aiEmoji?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full">
      {props.messages.map((m, i) => {
        if (m.role === "system") {
          return <IntermediateStep key={m.id} message={m} />;
        }

        const sourceKey = (props.messages.length - 1 - i).toString();
        return (
          <ChatMessageBubble
            key={m.id}
            message={m}
            aiEmoji={props.aiEmoji}
            sources={props.sourcesForMessages[sourceKey]}
          />
        );
      })}
    </div>
  );
}

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const disabled = props.loading && props.onStop == null;
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (props.loading) {
          props.onStop?.();
        } else {
          props.onSubmit(e);
        }
      }}
      className={cn("flex w-full flex-col", props.className)}
    >
      <div className="border border-input bg-secondary rounded-lg flex flex-col gap-2 max-w-[768px] w-full mx-auto">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          className="border-none outline-none bg-transparent p-4"
        />

        <div className="flex justify-between ml-4 mr-2 mb-2">
          <div className="flex gap-3">{props.children}</div>

          <div className="flex gap-2 self-end">
            {props.actions}
            <Button type="submit" className="self-end" disabled={disabled}>
              {props.loading ? (
                <span role="status" className="flex justify-center">
                  <LoaderCircle className="animate-spin" />
                  <span className="sr-only">Loading...</span>
                </span>
              ) : (
                <span>Send</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();

  // scrollRef will also switch between overflow: unset to overflow: auto
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={cn("grid grid-rows-[1fr,auto]", props.className)}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

export function ChatLayout(props: { content: ReactNode; footer: ReactNode }) {
  return (
    <StickToBottom>
      <StickyToBottomContent
        className="absolute inset-0"
        contentClassName="py-8 px-2"
        content={props.content}
        footer={
          <div className="sticky bottom-8 px-2">
            <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
            {props.footer}
          </div>
        }
      />
    </StickToBottom>
  );
}

export function ChatWindow(props: {
  endpoint: string;
  emptyStateComponent: ReactNode;
  placeholder?: string;
  emoji?: string;
  showIngestForm?: boolean;
  showIntermediateStepsToggle?: boolean;
}) {
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(
    !!props.showIntermediateStepsToggle,
  );
  const [intermediateStepsLoading, setIntermediateStepsLoading] =
    useState(false);

  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>
  >({});

  const chat = useChat({
    api: props.endpoint,
    onResponse(response) {
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8"))
        : [];

      const messageIndexHeader = response.headers.get("x-message-index");
      if (sources.length && messageIndexHeader !== null) {
        setSourcesForMessages({
          ...sourcesForMessages,
          [messageIndexHeader]: sources,
        });
      }
    },
    streamMode: "text",
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  });

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chat.isLoading || intermediateStepsLoading) return;

    if (!showIntermediateSteps) {
      chat.handleSubmit(e);
      return;
    }

    // Some extra work to show intermediate steps properly
    setIntermediateStepsLoading(true);

    chat.setInput("");
    const messagesWithUserReply = chat.messages.concat({
      id: chat.messages.length.toString(),
      content: chat.input,
      role: "user",
    });
    chat.setMessages(messagesWithUserReply);

    const response = await fetch(props.endpoint, {
      method: "POST",
      body: JSON.stringify({
        messages: messagesWithUserReply,
        show_intermediate_steps: true,
      }),
    });
    const json = await response.json();
    setIntermediateStepsLoading(false);

    if (!response.ok) {
      toast.error(`Error while processing your request`, {
        description: json.error,
      });
      return;
    }

    const responseMessages: Message[] = json.messages;

    // Represent intermediate steps as system messages for display purposes
    // TODO: Add proper support for tool messages
    const toolCallMessages = responseMessages.filter(
      (responseMessage: Message) => {
        return (
          (responseMessage.role === "assistant" &&
            !!responseMessage.tool_calls?.length) ||
          responseMessage.role === "tool"
        );
      },
    );

    const intermediateStepMessages = [];
    for (let i = 0; i < toolCallMessages.length; i += 2) {
      const aiMessage = toolCallMessages[i];
      const toolMessage = toolCallMessages[i + 1];
      intermediateStepMessages.push({
        id: (messagesWithUserReply.length + i / 2).toString(),
        role: "system" as const,
        content: JSON.stringify({
          action: aiMessage.tool_calls?.[0],
          observation: toolMessage.content,
        }),
      });
    }
    const newMessages = messagesWithUserReply;
    for (const message of intermediateStepMessages) {
      newMessages.push(message);
      chat.setMessages([...newMessages]);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 1000),
      );
    }

    chat.setMessages([
      ...newMessages,
      {
        id: newMessages.length.toString(),
        content: responseMessages[responseMessages.length - 1].content,
        role: "assistant",
      },
    ]);
  }

  return (
    <ChatLayout
      content={
        chat.messages.length === 0 ? (
          <div>{props.emptyStateComponent}</div>
        ) : (
          <ChatMessages
            aiEmoji={props.emoji}
            messages={chat.messages}
            emptyStateComponent={props.emptyStateComponent}
            sourcesForMessages={sourcesForMessages}
          />
        )
      }
      footer={
        <ChatInput
          value={chat.input}
          onChange={chat.handleInputChange}
          onSubmit={sendMessage}
          loading={chat.isLoading || intermediateStepsLoading}
          placeholder={props.placeholder ?? "What's it like to be a pirate?"}
        >
          {props.showIngestForm && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="pl-2 pr-3 -ml-2"
                  disabled={chat.messages.length !== 0}
                >
                  <Paperclip className="size-4" />
                  <span>Upload document</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload document</DialogTitle>
                  <DialogDescription>
                    Upload a document to use for the chat.
                  </DialogDescription>
                </DialogHeader>
                <UploadDocumentsForm />
              </DialogContent>
            </Dialog>
          )}

          {props.showIntermediateStepsToggle && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="show_intermediate_steps"
                name="show_intermediate_steps"
                checked={showIntermediateSteps}
                disabled={chat.isLoading || intermediateStepsLoading}
                onCheckedChange={(e) => setShowIntermediateSteps(!!e)}
              />
              <label htmlFor="show_intermediate_steps" className="text-sm">
                Show intermediate steps
              </label>
            </div>
          )}
        </ChatInput>
      }
    />
  );
}

```
components/IntermediateStep.tsx
```.tsx
import { useState } from "react";
import type { Message } from "ai/react";
import { cn } from "@/utils/cn";
import { ChevronDown, ChevronUp } from "lucide-react";

export function IntermediateStep(props: { message: Message }) {
  const parsedInput = JSON.parse(props.message.content);
  const action = parsedInput.action;
  const observation = parsedInput.observation;
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mr-auto bg-secondary border border-input rounded p-3 max-w-[80%] mb-8 whitespace-pre-wrap flex flex-col">
      <button
        type="button"
        className={cn(
          "text-left flex items-center gap-1",
          expanded && "w-full",
        )}
        onClick={(e) => setExpanded(!expanded)}
      >
        <span>
          Step: <strong className="font-mono">{action.name}</strong>
        </span>
        <span className={cn(expanded && "hidden")}>
          <ChevronDown className="w-5 h-5" />
        </span>
        <span className={cn(!expanded && "hidden")}>
          <ChevronUp className="w-5 h-5" />
        </span>
      </button>
      <div
        className={cn(
          "overflow-hidden max-h-[0px] transition-[max-height] ease-in-out text-sm",
          expanded && "max-h-[360px]",
        )}
      >
        <div
          className={cn(
            "rounded",
            expanded ? "max-w-full" : "transition-[max-width] delay-100",
          )}
        >
          Input:{" "}
          <code className="max-h-[100px] overflow-auto">
            {JSON.stringify(action.args)}
          </code>
        </div>
        <div
          className={cn(
            "rounded",
            expanded ? "max-w-full" : "transition-[max-width] delay-100",
          )}
        >
          Output:{" "}
          <code className="max-h-[260px] overflow-auto">{observation}</code>
        </div>
      </div>
    </div>
  );
}

```
components/Navbar.tsx
```.tsx
"use client";

import { cn } from "@/utils/cn";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Link from "next/link";

export const ActiveLink = (props: { href: string; children: ReactNode }) => {
  const pathname = usePathname();
  return (
    <Link
      href={props.href}
      className={cn(
        "px-4 py-2 rounded-[18px] whitespace-nowrap flex items-center gap-2 text-sm transition-all",
        pathname === props.href && "bg-primary text-primary-foreground",
      )}
    >
      {props.children}
    </Link>
  );
};

```
components/UploadDocumentsForm.tsx
```.tsx
"use client";

import { useState, type FormEvent } from "react";
import DEFAULT_RETRIEVAL_TEXT from "@/data/DefaultRetrievalText";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export function UploadDocumentsForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [document, setDocument] = useState(DEFAULT_RETRIEVAL_TEXT);
  const ingest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const response = await fetch("/api/retrieval/ingest", {
      method: "POST",
      body: JSON.stringify({
        text: document,
      }),
    });
    if (response.status === 200) {
      setDocument("Uploaded!");
    } else {
      const json = await response.json();
      if (json.error) {
        setDocument(json.error);
      }
    }
    setIsLoading(false);
  };
  return (
    <form onSubmit={ingest} className="flex flex-col gap-4 w-full">
      <Textarea
        className="grow p-4 rounded bg-transparent min-h-[512px]"
        value={document}
        onChange={(e) => setDocument(e.target.value)}
      />
      <Button type="submit">
        <div
          role="status"
          className={`${isLoading ? "" : "hidden"} flex justify-center`}
        >
          <svg
            aria-hidden="true"
            className="w-6 h-6 text-white animate-spin dark:text-white fill-sky-800"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
          <span className="sr-only">Loading...</span>
        </div>
        <span className={isLoading ? "hidden" : ""}>Upload</span>
      </Button>
    </form>
  );
}

```
components/guide/GuideInfoBox.tsx
```.tsx
import { ReactNode } from "react";

export function GuideInfoBox(props: { children: ReactNode }) {
  return (
    <div className="max-w-[768px] w-full overflow-hidden flex-col gap-5 flex text-md my-16 mx-auto">
      <div className="text-4xl text-center">
        ▲ <span className="font-semibold">+</span> 🦜🔗
      </div>

      <div className="text-sm max-w-[600px] mx-auto text-center">
        {props.children}
      </div>
    </div>
  );
}

```
components/ui/button.tsx
```.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

```
components/ui/checkbox.tsx
```.tsx
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/utils/cn"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

```
components/ui/dialog.tsx
```.tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/utils/cn";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

```
components/ui/drawer.tsx
```.tsx
"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/utils/cn";

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};

```
components/ui/input.tsx
```.tsx
import * as React from "react";

import { cn } from "@/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

```
components/ui/popover.tsx
```.tsx
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/utils/cn";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };

```
components/ui/sonner.tsx
```.tsx
"use client";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg px-4 py-3",
          description: "group-[.toast]:text-muted-foreground -mt-0.5",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

```
components/ui/textarea.tsx
```.tsx
import * as React from "react"

import { cn } from "@/utils/cn"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

```
data/DefaultRetrievalText.ts
```.ts
export default `# QA and Chat over Documents

Chat and Question-Answering (QA) over \`data\` are popular LLM use-cases.

\`data\` can include many things, including:

* \`Unstructured data\` (e.g., PDFs)
* \`Structured data\` (e.g., SQL)
* \`Code\` (e.g., Python)

Below we will review Chat and QA on \`Unstructured data\`.

![intro.png](/img/qa_intro.png)

\`Unstructured data\` can be loaded from many sources.

Check out the [document loader integrations here](/docs/modules/data_connection/document_loaders/) to browse the set of supported loaders.

Each loader returns data as a LangChain \`Document\`.

\`Documents\` are turned into a Chat or QA app following the general steps below:

* \`Splitting\`: [Text splitters](/docs/modules/data_connection/document_transformers/) break \`Documents\` into splits of specified size
* \`Storage\`: Storage (e.g., often a [vectorstore](/docs/modules/data_connection/vectorstores/)) will house [and often embed](https://www.pinecone.io/learn/vector-embeddings/) the splits
* \`Retrieval\`: The app retrieves splits from storage (e.g., often [with similar embeddings](https://www.pinecone.io/learn/k-nearest-neighbor/) to the input question)
* \`Output\`: An [LLM](/docs/modules/model_io/models/llms/) produces an answer using a prompt that includes the question and the retrieved splits

![flow.jpeg](/img/qa_flow.jpeg)

## Quickstart

Let's load this [blog post](https://lilianweng.github.io/posts/2023-06-23-agent/) on agents as an example \`Document\`.

We'll have a QA app in a few lines of code.

First, set environment variables and install packages required for the guide:

\`\`\`shell
> yarn add cheerio
# Or load env vars in your preferred way:
> export OPENAI_API_KEY="..."
\`\`\`

## 1. Loading, Splitting, Storage

### 1.1 Getting started

Specify a \`Document\` loader.

\`\`\`typescript
// Document loader
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";

const loader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/"
);
const data = await loader.load();
\`\`\`

Split the \`Document\` into chunks for embedding and vector storage.


\`\`\`typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 0,
});

const splitDocs = await textSplitter.splitDocuments(data);
\`\`\`

Embed and store the splits in a vector database (for demo purposes we use an unoptimized, in-memory example but you can [browse integrations here](/docs/modules/data_connection/vectorstores/integrations/)):


\`\`\`typescript
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const embeddings = new OpenAIEmbeddings();

const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
\`\`\`

Here are the three pieces together:

![lc.png](/img/qa_data_load.png)

### 1.2 Going Deeper

#### 1.2.1 Integrations

\`Document Loaders\`

* Browse document loader integrations [here](/docs/modules/data_connection/document_loaders/).

* See further documentation on loaders [here](/docs/modules/data_connection/document_loaders/).

\`Document Transformers\`

* All can ingest loaded \`Documents\` and process them (e.g., split).

* See further documentation on transformers [here](/docs/modules/data_connection/document_transformers/).

\`Vectorstores\`

* Browse vectorstore integrations [here](/docs/modules/data_connection/vectorstores/integrations/).

* See further documentation on vectorstores [here](/docs/modules/data_connection/vectorstores/).

## 2. Retrieval

### 2.1 Getting started

Retrieve [relevant splits](https://www.pinecone.io/learn/what-is-similarity-search/) for any question using \`similarity_search\`.


\`\`\`typescript
const relevantDocs = await vectorStore.similaritySearch("What is task decomposition?");

console.log(relevantDocs.length);

// 4
\`\`\`


### 2.2 Going Deeper

#### 2.2.1 Retrieval

Vectorstores are commonly used for retrieval.

But, they are not the only option.

For example, SVMs (see thread [here](https://twitter.com/karpathy/status/1647025230546886658?s=20)) can also be used.

LangChain [has many retrievers and retrieval methods](/docs/modules/data_connection/retrievers/) including, but not limited to, vectorstores.

All retrievers implement some common methods, such as \`getRelevantDocuments()\`.


## 3. QA

### 3.1 Getting started

Distill the retrieved documents into an answer using an LLM (e.g., \`gpt-3.5-turbo\`) with \`RetrievalQA\` chain.


\`\`\`typescript
import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({ model: "gpt-3.5-turbo" });
const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever());

const response = await chain.call({
  query: "What is task decomposition?"
});
console.log(response);

/*
  {
    text: 'Task decomposition refers to the process of breaking down a larger task into smaller, more manageable subgoals. By decomposing a task, it becomes easier for an agent or system to handle complex tasks efficiently. Task decomposition can be done through various methods such as using prompting or task-specific instructions, or through human inputs. It helps in planning and organizing the steps required to complete a task effectively.'
  }
*/
\`\`\`

### 3.2 Going Deeper

#### 3.2.1 Integrations

\`LLMs\`

* Browse LLM integrations and further documentation [here](/docs/modules/model_io/models/).

#### 3.2.2 Customizing the prompt

The prompt in \`RetrievalQA\` chain can be customized as follows.


\`\`\`typescript
import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";

const model = new ChatOpenAI({ model: "gpt-3.5-turbo" });

const template = \`Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.
{context}
Question: {question}
Helpful Answer:\`;

const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever(), {
  prompt: PromptTemplate.fromTemplate(template),
});

const response = await chain.call({
  query: "What is task decomposition?"
});

console.log(response);

/*
  {
    text: 'Task decomposition is the process of breaking down a large task into smaller, more manageable subgoals. This allows for efficient handling of complex tasks and aids in planning and organizing the steps needed to achieve the overall goal. Thanks for asking!'
  }
*/
\`\`\`


#### 3.2.3 Returning source documents

The full set of retrieved documents used for answer distillation can be returned using \`return_source_documents=True\`.


\`\`\`typescript
import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({ model: "gpt-3.5-turbo" });

const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever(), {
  returnSourceDocuments: true
});

const response = await chain.call({
  query: "What is task decomposition?"
});

console.log(response.sourceDocuments[0]);

/*
Document {
  pageContent: 'Task decomposition can be done (1) by LLM with simple prompting like "Steps for XYZ.\\n1.", "What are the subgoals for achieving XYZ?", (2) by using task-specific instructions; e.g. "Write a story outline." for writing a novel, or (3) with human inputs.',
  metadata: [Object]
}
*/
\`\`\`


#### 3.2.4 Customizing retrieved docs in the LLM prompt

Retrieved documents can be fed to an LLM for answer distillation in a few different ways.

\`stuff\`, \`refine\`, and \`map-reduce\` chains for passing documents to an LLM prompt are well summarized [here](/docs/modules/chains/document/).

\`stuff\` is commonly used because it simply "stuffs" all retrieved documents into the prompt.

The [loadQAChain](/docs/modules/chains/document/) methods are easy ways to pass documents to an LLM using these various approaches.


\`\`\`typescript
import { loadQAStuffChain } from "langchain/chains";

const stuffChain = loadQAStuffChain(model);

const stuffResult = await stuffChain.call({
  input_documents: relevantDocs,
  question: "What is task decomposition
});

console.log(stuffResult);
/*
{
  text: 'Task decomposition is the process of breaking down a large task into smaller, more manageable subgoals or steps. This allows for efficient handling of complex tasks by focusing on one subgoal at a time. Task decomposition can be done through various methods such as using simple prompting, task-specific instructions, or human inputs.'
}
*/
\`\`\`

## 4. Chat

### 4.1 Getting started

To keep chat history, we use a variant of the previous chain called a \`ConversationalRetrievalQAChain\`.
First, specify a \`Memory buffer\` to track the conversation inputs / outputs.


\`\`\`typescript
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "langchain/chat_models/openai";

const memory = new BufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
});
\`\`\`

Next, we initialize and call the chain:

\`\`\`typescript
const model = new ChatOpenAI({ model: "gpt-3.5-turbo" });
const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorstore.asRetriever(), {
  memory
});

const result = await chain.call({
  question: "What are some of the main ideas in self-reflection?"
});
console.log(result);

/*
{
  text: 'Some main ideas in self-reflection include:\n' +
    '\n' +
    '1. Iterative Improvement: Self-reflection allows autonomous agents to improve by continuously refining past action decisions and correcting mistakes.\n' +
    '\n' +
    '2. Trial and Error: Self-reflection plays a crucial role in real-world tasks where trial and error are inevitable. It helps agents learn from failed trajectories and make adjustments for future actions.\n' +
    '\n' +
    '3. Constructive Criticism: Agents engage in constructive self-criticism of their big-picture behavior to identify areas for improvement.\n' +
    '\n' +
    '4. Decision and Strategy Refinement: Reflection on past decisions and strategies enables agents to refine their approach and make more informed choices.\n' +
    '\n' +
    '5. Efficiency and Optimization: Self-reflection encourages agents to be smart and efficient in their actions, aiming to complete tasks in the least number of steps.\n' +
    '\n' +
    'These ideas highlight the importance of self-reflection in enhancing performance and guiding future actions.'
}
*/
\`\`\`


The \`Memory buffer\` has context to resolve \`"it"\` ("self-reflection") in the below question.


\`\`\`typescript
const followupResult = await chain.call({
  question: "How does the Reflexion paper handle it?"
});
console.log(followupResult);

/*
{
  text: "The Reflexion paper introduces a framework that equips agents with dynamic memory and self-reflection capabilities to improve their reasoning skills. The approach involves showing the agent two-shot examples, where each example consists of a failed trajectory and an ideal reflection on how to guide future changes in the agent's plan. These reflections are then added to the agent's working memory as context for querying a language model. The agent uses this self-reflection information to make decisions on whether to start a new trial or continue with the current plan."
}
*/
\`\`\`


### 4.2 Going deeper

The [documentation](/docs/modules/chains/popular/chat_vector_db) on \`ConversationalRetrievalQAChain\` offers a few extensions, such as streaming and source documents.


# Conversational Retrieval Agents

This is an agent specifically optimized for doing retrieval when necessary while holding a conversation and being able
to answer questions based on previous dialogue in the conversation.

To start, we will set up the retriever we want to use, then turn it into a retriever tool. Next, we will use the high-level constructor for this type of agent.
Finally, we will walk through how to construct a conversational retrieval agent from components.

## The Retriever

To start, we need a retriever to use! The code here is mostly just example code. Feel free to use your own retriever and skip to the next section on creating a retriever tool.

\`\`\`typescript
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const loader = new TextLoader("state_of_the_union.txt");
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 0
});

const texts = await splitter.splitDocuments(docs);

const vectorStore = await FaissStore.fromDocuments(texts, new OpenAIEmbeddings());

const retriever = vectorStore.asRetriever();
\`\`\`

## Retriever Tool

Now we need to create a tool for our retriever. The main things we need to pass in are a \`name\` for the retriever as well as a \`description\`. These will both be used by the language model, so they should be informative.

\`\`\`typescript
import { createRetrieverTool } from "langchain/agents/toolkits";

const tool = createRetrieverTool(retriever, {
  name: "search_state_of_union",
  description: "Searches and returns documents regarding the state-of-the-union.",
});
\`\`\`

## Agent Constructor

Here, we will use the high level \`create_conversational_retrieval_agent\` API to construct the agent.
Notice that beside the list of tools, the only thing we need to pass in is a language model to use.

Under the hood, this agent is using the OpenAIFunctionsAgent, so we need to use an ChatOpenAI model.

\`\`\`typescript
import { createConversationalRetrievalAgent } from "langchain/agents/toolkits";
import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
  temperature: 0,
});

const executor = await createConversationalRetrievalAgent(model, [tool], {
  verbose: true,
});
\`\`\`

We can now try it out!

\`\`\`typescript
const result = await executor.call({
  input: "Hi, I'm Bob!"
});

console.log(result);

/*
  {
    output: 'Hello Bob! How can I assist you today?',
    intermediateSteps: []
  }
*/

const result2 = await executor.call({
  input: "What's my name?"
});

console.log(result2);

/*
  { output: 'Your name is Bob.', intermediateSteps: [] }
*/

const result3 = await executor.call({
  input: "What did the president say about Ketanji Brown Jackson in the most recent state of the union?"
});

console.log(result3);

/*
  {
    output: "In the most recent state of the union, President Biden mentioned Ketanji Brown Jackson. He nominated her as a Circuit Court of Appeals judge and described her as one of the nation's top legal minds who will continue Justice Breyer's legacy of excellence. He mentioned that she has received a broad range of support, including from the Fraternal Order of Police and former judges appointed by Democrats and Republicans.",
    intermediateSteps: [
      {...}
    ]
  }
*/

const result4 = await executor.call({
  input: "How long ago did he nominate her?"
});

console.log(result4);

/*
  {
    output: 'President Biden nominated Ketanji Brown Jackson four days before the most recent state of the union address.',
    intermediateSteps: []
  }
*/
\`\`\`

Note that for the final call, the agent used previously retrieved information to answer the query and did not need to call the tool again!

Here's a trace showing how the agent fetches documents to answer the question with the retrieval tool:

https://smith.langchain.com/public/1e2b1887-ca44-4210-913b-a69c1b8a8e7e/r

## Creating from components

What actually is going on underneath the hood? Let's take a look so we can understand how to modify things going forward.

### Memory

In this example, we want the agent to remember not only previous conversations, but also previous intermediate steps.
For that, we can use \`OpenAIAgentTokenBufferMemory\`. Note that if you want to change whether the agent remembers intermediate steps,
how the long the retained buffer is, or anything like that you should change this part.

\`\`\`typescript
import { OpenAIAgentTokenBufferMemory } from "langchain/agents/toolkits";

const memory = new OpenAIAgentTokenBufferMemory({
  llm: model,
  memoryKey: "chat_history",
  outputKey: "output"
});
\`\`\`

You should make sure \`memoryKey\` is set to \`"chat_history"\` and \`outputKey\` is set to \`"output"\` for the OpenAI functions agent.
This memory also has \`returnMessages\` set to \`true\` by default.

You can also load messages from prior conversations into this memory by initializing it with a pre-loaded chat history:

\`\`\`typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIAgentTokenBufferMemory } from "langchain/agents/toolkits";
import { HumanMessage, AIMessage } from "langchain/schema";
import { ChatMessageHistory } from "langchain/memory";

const previousMessages = [
  new HumanMessage("My name is Bob"),
  new AIMessage("Nice to meet you, Bob!"),
];

const chatHistory = new ChatMessageHistory(previousMessages);

const memory = new OpenAIAgentTokenBufferMemory({
  llm: new ChatOpenAI({}),
  memoryKey: "chat_history",
  outputKey: "output",
  chatHistory,
});
\`\`\`

### Agent executor

We can recreate the agent executor directly with the \`initializeAgentExecutorWithOptions\` method.
This allows us to customize the agent's system message by passing in a \`prefix\` into \`agentArgs\`.
Importantly, we must pass in \`return_intermediate_steps: true\` since we are recording that with our memory object.

\`\`\`typescript
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const executor = await initializeAgentExecutorWithOptions(tools, llm, {
  agentType: "openai-functions",
  memory,
  returnIntermediateSteps: true,
  agentArgs: {
    prefix:
      prefix ??
      \`Do your best to answer the questions. Feel free to use any tools available to look up relevant information, only if necessary.\`,
  },
});
\`\`\`
`;
```
next.config.js
```.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
module.exports = withBundleAnalyzer({})
```
package.json
```.json
{
  "name": "langchain-nextjs-template",
  "version": "0.0.0",
  "private": true,
  "packageManager": "yarn@3.5.1",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write \"app\""
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@langchain/community": "^0.3.25",
    "@langchain/core": "^0.3.31",
    "@langchain/langgraph": "^0.2.41",
    "@langchain/langgraph-sdk": "^0.0.45",
    "@langchain/openai": "^0.3.17",
    "@radix-ui/react-checkbox": "^1.1.3",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-popover": "^1.1.4",
    "@radix-ui/react-slot": "^1.1.1",
    "@supabase/supabase-js": "^2.32.0",
    "@types/node": "20.12.12",
    "@types/react": "18.3.2",
    "@types/react-dom": "18.3.0",
    "ai": "^3.1.12",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "langchain": "^0.3.11",
    "lucide-react": "^0.473.0",
    "next": "^15.1.5",
    "next-themes": "^0.4.4",
    "nuqs": "^2.3.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-toastify": "^9.1.3",
    "sonner": "^1.7.2",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "use-stick-to-bottom": "^1.0.44",
    "vaul": "^1.1.2",
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.23.2"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^13.4.19",
    "autoprefixer": "10.4.14",
    "eslint": "8.46.0",
    "eslint-config-next": "13.4.12",
    "postcss": "8.4.27",
    "prettier": "^3.4.2",
    "tailwindcss": "3.3.3",
    "typescript": "5.1.6"
  }
}

```
postcss.config.js
```.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```
tailwind.config.js
```.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

```
tsconfig.json
```.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```
utils/cn.ts
```.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

