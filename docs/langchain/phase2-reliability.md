Querying Perplexity AI using sonar-reasoning-pro for: How to implement robust error handling and state management in a LangChain.js application? Include examples of error classes, state transitions, and logging systems. Focus on TypeScript implementation with proper typing.
<think>
Okay, I need to figure out how to implement robust error handling and state management in a LangChain.js application using TypeScript. Let's start by looking at the search results provided.

From result [1], there's a mention of issues with type safety in LangChain TS, especially around parsing inputs and handling errors. The example shows that using JSON.parse can lead to unexpected types because it returns 'any', which TypeScript can't check. They built an auto-fixer but faced challenges with error handling functions not receiving original input. This suggests that custom error handling and proper type definitions are crucial.

Result [5] talks about tool error handling in LangChain.js. It shows an example of a ToolInputParsingException and using fallback chains. The example uses withFallbacks to handle errors by switching to a better chain. This indicates that fallback mechanisms and custom parsers are part of the solution.

Looking at result [9], the LangChain.js docs mention building error handling into chains to mitigate failures. They probably recommend specific patterns or middleware for error handling.

Result [10] discusses LCEL (LangChain Expression Language) which is declarative for building runnables. It might have features for error handling within the chain composition.

For state management, result [3] explains checkpointing and methods like getState and updateState. They mention rewinding or modifying state, which is useful for state management. The example uses a StateGraph and annotations for state, which could be relevant.

Result [6] from Restack outlines building a LangChain agent in TypeScript, emphasizing setup, LLM integration, and data handling. It might have best practices for structuring the application with TypeScript.

Now, putting this together:

Error Handling:
- Define custom error classes (like ToolInputParsingException) extending a base error class for consistency.
- Use try-catch blocks around tool invocations, checking error types.
- Implement fallback chains using withFallbacks to handle errors gracefully.
- Middleware for logging errors, possibly using LangChain's built-in features or custom logging.

State Management:
- Use StateGraph with annotated state variables, applying reducers for state transitions.
- Checkpointing to save and restore state, allowing rewinds or modifications.
- TypeScript interfaces to define state structure ensuring type safety.

Logging:
- Integrate logging within middleware or use streamLog method to capture logs during execution.
- Structured logging with details like timestamps, error types, and context.

Code examples should include defining custom errors, setting up fallback chains, state annotations with reducers, and logging implementations. Make sure to use TypeScript types for errors and state, and demonstrate how to handle parsing errors and state transitions.
</think>

To implement robust error handling and state management in LangChain.js with TypeScript:

**Error Handling**
```typescript
// Custom error hierarchy
class LangChainError extends Error {
  constructor(message: string, public context?: object) {
    super(message);
    this.name = 'LangChainError';
  }
}

class ToolInputError extends LangChainError {
  constructor(public toolName: string, public input: unknown) {
    super(`Invalid input for tool ${toolName}`);
    this.name = 'ToolInputError';
  }
}

// Error handling middleware
const errorHandler = async (input: any, next: Next) => {
  try {
    return await next(input);
  } catch (error) {
    if (error instanceof ToolInputError) {
      console.error(`Retrying tool ${error.toolName} with sanitized input`);
      return invokeToolWithFallback(error.toolName, sanitizeInput(error.input));
    }
    throw error;
  }
};

// Fallback chain implementation
const chain = RunnableSequence.from([
  toolParser,
  complexTool,
]).withFallbacks({
  fallbacks: [simplifiedToolChain],
  exceptionKey: 'error'
});
```

**State Management**
```typescript
// State definition with reducer
interface AgentState {
  conversationHistory: BaseMessage[];
  toolsUsed: string[];
  lastError?: LangChainError;
}

const StateAnnotation = Annotation.Root<AgentState>({
  conversationHistory: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next]
  }),
  toolsUsed: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next]
  })
});

// State checkpointing
const checkpointManager = new CheckpointManager();
await graph.updateState(
  { configurable: { thread_id: "conv_123" } },
  (state: AgentState) => ({
    ...state,
    lastError: undefined
  })
);
```

**Logging System**
```typescript
// Structured logging implementation
const logger = new ConsoleLogger({
  format: (log: LogEntry) => ({
    timestamp: new Date().toISOString(),
    ...log,
    state: JSON.stringify(log.state)
  })
});

// Stream logging integration
const logStream = await chain.streamLog(input);
for await (const logPatch of logStream) {
  logger.log({
    level: 'DEBUG',
    message: 'Processing step',
    metadata: logPatch
  });
}
```

Key practices:
1. Use Zod for input validation with strict schemas[1][5]
2. Implement retry policies with exponential backoff[9]
3. Use union types for error states (`type Result<T> = T | ErrorContainer`)[8]
4. Apply state reducers for immutable updates[3]
5. Enable source maps for error tracing[2]

This implementation provides type-safe error handling through custom classes[8], atomic state updates via reducers[3], and structured logging with context preservation[7][9].