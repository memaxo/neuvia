Querying Perplexity AI using sonar-reasoning-pro for: How to implement LLM response parsing with Zod in LangChain.js, focusing on proper error handling and retry logic? Include code examples for parsing structured JSON responses and implementing retry mechanisms.
<think>
Okay, let's tackle this query. The user wants to implement LLM response parsing with Zod in LangChain.js, focusing on error handling and retries. They also want code examples for structured JSON and retry mechanisms.

First, I'll look through the search results to find relevant information. Result [4] talks about using Zod with LangChain for structured data. It shows how to define a Zod schema and use it with a model via `withStructuredOutput`. That's a good starting point for parsing JSON responses.

Next, error handling and retries. Results [2], [3], and [6] mention retry mechanisms. In [2], there's an example of setting `max_retries` in the model initialization. Result [6] also shows setting `maxRetries` for OpenAIEmbeddings, which suggests that models in LangChain.js have a `maxRetries` option. That should be part of the retry logic.

For handling parsing errors, result [10] discusses using `RetryOutputParser` in Python, but the user is asking for LangChain.js. However, result [8] mentions `OutputFixingParser` in JavaScript, which can wrap another parser and use an LLM to fix errors. That's useful for when the initial parse fails.

Result [5] lists output parsers, including `Structured` which uses Zod schemas. Combining this with `OutputFixingParser` from [8] would handle parsing errors by retrying with the LLM's help.

Putting it all together: Define a Zod schema, create a structured parser, wrap it with `OutputFixingParser`, and set `maxRetries` on the model. Also, ensure that the model uses the parser in the chain.

Code examples should include importing necessary modules, defining the schema, setting up the model with retries, and using the parser. For retry logic beyond API errors, maybe use LangGraph's retry policies mentioned in [3], but the user might just need the basic model retries and output fixing.

So the steps are:
1. Define Zod schema.
2. Create structured parser.
3. Wrap with OutputFixingParser.
4. Configure model with maxRetries.
5. Use parser in the invocation.

Include code snippets for each part, making sure to show error handling and retry setup.
</think>

To implement LLM response parsing with Zod in LangChain.js while handling errors and retries:

**1. Structured JSON Parsing with Zod**
```typescript
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { OutputFixingParser } from "langchain/output_parsers";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

// Define Zod schema
const responseSchema = z.object({
  answer: z.array(z.string()).describe("List of generated answers"),
  confidence: z.number().min(0).max(10)
});

// Create parser with error recovery
const structuredParser = StructuredOutputParser.fromZodSchema(responseSchema);
const chatModel = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const outputFixingParser = OutputFixingParser.fromLLM(chatModel, structuredParser);

// Usage
const chain = prompt.pipe(chatModel).pipe(outputFixingParser);
const result = await chain.invoke("Question about AI safety");
```

**2. Retry Mechanisms**
```typescript
// Model-level retries for API errors
const model = new ChatOpenAI({
  maxRetries: 5,
  temperature: 0,
  model: "gpt-4"
});

// Custom retry policy for parsing attempts
import { RetryPolicy } from "@langchain/langgraph";

const parserRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  delay: 1000,
  backoffFactor: 2
};
```

**3. Full Implementation with Error Handling**
```typescript
async function getStructuredResponse(query: string) {
  try {
    return await chain.invoke(query);
  } catch (error) {
    if (error.name === 'RateLimitError') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return chain.invoke(query);
    }
    throw new Error(`Failed after retries: ${error.message}`);
  }
}

// Usage with error boundary
const response = await getStructuredResponse("Explain quantum computing")
  .catch(error => ({
    answer: ["Fallback response"],
    confidence: 0
  }));
```

Key components:
- Zod schema validation ensures structured output[4][8]
- OutputFixingParser automatically corrects formatting issues[8]
- Built-in exponential backoff for API errors[6]
- Custom retry policies for parsing attempts[3]

For rate-limited APIs, LangChain.js automatically implements exponential backoff up to 6 retries by default[6][7]. Combine this with OutputFixingParser for end-to-end reliability in production workflows[8][10].