# https://mastra.ai/docs llms-full.txt

## Agent Text Generation
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Agents](https://mastra.ai/docs/reference/agents/getAgent "Agents") generate()

# Agent.generate()

The `generate()` method is used to interact with an agent to produce text or structured responses. This method accepts `messages` and an optional `options` object as parameters.

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#parameters)

### `messages` [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#messages)

The `messages` parameter can be:

- A single string
- An array of strings
- An array of message objects with `role` and `content` properties

The message object structure:

```nextra-code
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### `options` (Optional) [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#options-optional)

An optional object that can include configuration for output structure, memory management, tool usage, telemetry, and more.

### output?:

Zod schema \| JsonSchema7

Defines the expected structure of the output. Can be a JSON Schema object or a Zod schema.

### experimental\_output?:

Zod schema \| JsonSchema7

Enables structured output generation alongside text generation and tool calls. The model will generate responses that conform to the provided schema.

### context?:

CoreMessage\[\]

Additional context messages to provide to the agent.

### memoryOptions?:

MemoryConfig

Configuration options for memory management. See MemoryConfig section below for details.

### toolChoice?:

'auto' \| 'none' \| 'required' \| { type: 'tool'; toolName: string }

= 'auto'

Controls how the agent uses tools during generation.

### telemetry?:

TelemetrySettings

Settings for telemetry collection during generation. See TelemetrySettings section below for details.

### threadId?:

string

Identifier for the conversation thread. Allows for maintaining context across multiple interactions. Must be provided if resourceId is provided.

### resourceId?:

string

Identifier for the user or resource interacting with the agent. Must be provided if threadId is provided.

### onStepFinish?:

(step: string) => void

Callback function called after each execution step. Receives step details as a JSON string.

### maxSteps?:

number

= 5

Maximum number of execution steps allowed.

### toolsets?:

ToolsetsInput

Additional toolsets to make available to the agent during generation.

### temperature?:

number

Controls randomness in the model's output. Higher values (e.g., 0.8) make the output more random, lower values (e.g., 0.2) make it more focused and deterministic.

#### MemoryConfig [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#memoryconfig)

Configuration options for memory management:

### lastMessages?:

number \| false

Number of most recent messages to include in context. Set to false to disable.

### semanticRecall?:

boolean \| object

Configuration for semantic memory recall. Can be boolean or detailed config.

number

### topK?:

number

Number of most semantically similar messages to retrieve.

number \| object

### messageRange?:

number \| { before: number; after: number }

Range of messages to consider for semantic search. Can be a single number or before/after configuration.

### workingMemory?:

object

Configuration for working memory.

boolean

### enabled?:

boolean

Whether to enable working memory.

string

### template?:

string

Template to use for working memory.

'text-stream' \| 'tool-call'

### type?:

'text-stream' \| 'tool-call'

Type of content to use for working memory.

### threads?:

object

Thread-specific memory configuration.

boolean

### generateTitle?:

boolean

Whether to automatically generate titles for new threads.

#### TelemetrySettings [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#telemetrysettings)

Settings for telemetry collection during generation:

### isEnabled?:

boolean

= false

Enable or disable telemetry. Disabled by default while experimental.

### recordInputs?:

boolean

= true

Enable or disable input recording. You might want to disable this to avoid recording sensitive information, reduce data transfers, or increase performance.

### recordOutputs?:

boolean

= true

Enable or disable output recording. You might want to disable this to avoid recording sensitive information, reduce data transfers, or increase performance.

### functionId?:

string

Identifier for this function. Used to group telemetry data by function.

### metadata?:

Record<string, AttributeValue>

Additional information to include in the telemetry data. AttributeValue can be string, number, boolean, array of these types, or null.

### tracer?:

Tracer

A custom OpenTelemetry tracer instance to use for the telemetry data. See OpenTelemetry documentation for details.

## Returns [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#returns)

The return value of the `generate()` method depends on the options provided, specifically the `output` option.

### PropertiesTable for Return Values [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#propertiestable-for-return-values)

### text?:

string

The generated text response. Present when output is 'text' (no schema provided).

### object?:

object

The generated structured response. Present when a schema is provided via \`output\` or \`experimental\_output\`.

### toolCalls?:

Array<ToolCall>

The tool calls made during the generation process. Present in both text and object modes.

#### ToolCall Structure [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#toolcall-structure)

### toolName:

string

The name of the tool invoked.

### args:

any

The arguments passed to the tool.

## Related Methods [Permalink for this section](https://mastra.ai/docs/reference/agents/generate\#related-methods)

For real-time streaming responses, see the [`stream()`](https://mastra.ai/docs/reference/agents/stream) method documentation.

Last updated on March 11, 2025

[createTool()](https://mastra.ai/docs/reference/agents/createTool "createTool()") [stream()](https://mastra.ai/docs/reference/agents/stream "stream()")

## LibSQL Storage
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") StorageLibSQL Storage

# LibSQL Storage

The LibSQL storage implementation provides a SQLite-compatible storage solution that can run both in-memory and as a persistent database.

## Installation [Permalink for this section](https://mastra.ai/docs/reference/storage/libsql\#installation)

```nextra-code
npm install @mastra/storage-libsql
```

## Usage [Permalink for this section](https://mastra.ai/docs/reference/storage/libsql\#usage)

```nextra-code [counter-reset:line]
import { LibSQLStore } from "@mastra/core/storage/libsql";

// File database (development)
const storage = new LibSQLStore({
  url: "file:storage.db",
});

// Persistent database (production)
const storage = new LibSQLStore({
  url: process.env.DATABASE_URL,
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/storage/libsql\#parameters)

### url:

string

Database URL. Use ':memory:' for in-memory database, 'file:filename.db' for a file database, or any LibSQL-compatible connection string for persistent storage.

### authToken?:

string

Authentication token for remote LibSQL databases.

## Additional Notes [Permalink for this section](https://mastra.ai/docs/reference/storage/libsql\#additional-notes)

### In-Memory vs Persistent Storage [Permalink for this section](https://mastra.ai/docs/reference/storage/libsql\#in-memory-vs-persistent-storage)

The file configuration ( `file:storage.db`) is useful for:

- Development and testing
- Temporary storage
- Quick prototyping

For production use cases, use a persistent database URL: `libsql://your-database.turso.io`

### Schema Management [Permalink for this section](https://mastra.ai/docs/reference/storage/libsql\#schema-management)

The storage implementation handles schema creation and updates automatically. It creates the following tables:

- `threads`: Stores conversation threads
- `messages`: Stores individual messages
- `metadata`: Stores additional metadata for threads and messages

Last updated on March 11, 2025

[.getThreadsByResourceId()](https://mastra.ai/docs/reference/memory/getThreadsByResourceId ".getThreadsByResourceId()") [PostgreSQL Storage](https://mastra.ai/docs/reference/storage/postgresql "PostgreSQL Storage")

## Murf Voice TTS
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Voice](https://mastra.ai/docs/reference/voice/mastra-voice "Voice") Murf

# Murf

The Murf voice implementation in Mastra provides text-to-speech (TTS) capabilities using Murf’s AI voice service. It supports multiple voices across different languages.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#usage-example)

```nextra-code
import { MurfVoice } from "@mastra/voice-murf";

// Initialize with default configuration (uses MURF_API_KEY environment variable)
const voice = new MurfVoice();

// Initialize with custom configuration
const voice = new MurfVoice({
  speechModel: {
    name: 'GEN2',
    apiKey: 'your-api-key',
    properties: {
      format: 'MP3',
      rate: 1.0,
      pitch: 1.0,
      sampleRate: 48000,
      channelType: 'STEREO',
    },
  },
  speaker: 'en-US-cooper',
});

// Text-to-Speech with default settings
const audioStream = await voice.speak("Hello, world!");

// Text-to-Speech with custom properties
const audioStream = await voice.speak("Hello, world!", {
  speaker: 'en-UK-hazel',
  properties: {
    format: 'WAV',
    rate: 1.2,
    style: 'casual',
  },
});

// Get available voices
const voices = await voice.getSpeakers();
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#constructor-parameters)

### speechModel?:

MurfConfig

= { name: 'GEN2' }

Configuration for text-to-speech functionality

### speaker?:

string

= 'en-UK-hazel'

Default voice ID to use for text-to-speech

### MurfConfig [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#murfconfig)

### name:

'GEN1' \| 'GEN2'

= 'GEN2'

The Murf model generation to use

### apiKey?:

string

Murf API key. Falls back to MURF\_API\_KEY environment variable

### properties?:

object

Default properties for all speech synthesis requests

### Speech Properties [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#speech-properties)

### style?:

string

Speaking style for the voice

### rate?:

number

Speech rate multiplier

### pitch?:

number

Voice pitch adjustment

### sampleRate?:

8000 \| 24000 \| 44100 \| 48000

Audio sample rate in Hz

### format?:

'MP3' \| 'WAV' \| 'FLAC' \| 'ALAW' \| 'ULAW'

Output audio format

### channelType?:

'STEREO' \| 'MONO'

Audio channel configuration

### pronunciationDictionary?:

Record<string, string>

Custom pronunciation mappings

### encodeAsBase64?:

boolean

Whether to encode the audio as base64

### variation?:

number

Voice variation parameter

### audioDuration?:

number

Target audio duration in seconds

### multiNativeLocale?:

string

Locale for multilingual support

## Methods [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#methods)

### speak() [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#speak)

Converts text to speech using Murf’s API.

### input:

string \| NodeJS.ReadableStream

Text to convert to speech. If a stream is provided, it will be converted to text first.

### options?:

object

Speech synthesis options

### options.speaker?:

string

Override the default speaker for this request

### options.properties?:

object

Override default speech properties for this request

Returns: `Promise<NodeJS.ReadableStream>`

### getSpeakers() [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#getspeakers)

Returns an array of available voice options, where each node contains:

### voiceId:

string

Unique identifier for the voice

### name:

string

Display name of the voice

### language:

string

Language code for the voice

### gender:

string

Gender of the voice

### listen() [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#listen)

This method is not supported by Murf and will throw an error. Murf does not provide speech-to-text functionality.

## Important Notes [Permalink for this section](https://mastra.ai/docs/reference/voice/murf\#important-notes)

1. A Murf API key is required. Set it via the `MURF_API_KEY` environment variable or pass it in the constructor.
2. The service uses GEN2 as the default model version.
3. Speech properties can be set at the constructor level and overridden per request.
4. The service supports extensive audio customization through properties like format, sample rate, and channel type.
5. Speech-to-text functionality is not supported.

Last updated on March 11, 2025

[Google](https://mastra.ai/docs/reference/voice/google "Google") [OpenAI](https://mastra.ai/docs/reference/voice/openai "OpenAI")

## .while() Method
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").while()

# Workflow.while()

The `.while()` method repeats a step as long as a specified condition remains true. This creates a loop that continues executing the specified step until the condition becomes false.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#usage)

```nextra-code
workflow
  .step(incrementStep)
  .while(condition, incrementStep)
  .then(finalStep);
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#parameters)

### condition:

Function \| ReferenceCondition

A function or reference condition that determines when to continue looping

### step:

Step

The step to repeat while the condition is true

## Condition Types [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#condition-types)

### Function Condition [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#function-condition)

You can use a function that returns a boolean:

```nextra-code
workflow
  .step(incrementStep)
  .while(async ({ context }) => {
    const result = context.getStepResult<{ value: number }>('increment');
    return (result?.value ?? 0) < 10; // Continue as long as value is less than 10
  }, incrementStep)
  .then(finalStep);
```

### Reference Condition [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#reference-condition)

You can use a reference-based condition with comparison operators:

```nextra-code
workflow
  .step(incrementStep)
  .while(
    {
      ref: { step: incrementStep, path: 'value' },
      query: { $lt: 10 }, // Continue as long as value is less than 10
    },
    incrementStep
  )
  .then(finalStep);
```

## Comparison Operators [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#comparison-operators)

When using reference-based conditions, you can use these comparison operators:

| Operator | Description | Example |
| --- | --- | --- |
| `$eq` | Equal to | `{ $eq: 10 }` |
| `$ne` | Not equal to | `{ $ne: 0 }` |
| `$gt` | Greater than | `{ $gt: 5 }` |
| `$gte` | Greater than or equal to | `{ $gte: 10 }` |
| `$lt` | Less than | `{ $lt: 20 }` |
| `$lte` | Less than or equal to | `{ $lte: 15 }` |

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#returns)

### workflow:

Workflow

The workflow instance for chaining

## Example [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#example)

```nextra-code
import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

// Create a step that increments a counter
const incrementStep = new Step({
  id: 'increment',
  description: 'Increments the counter by 1',
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ context }) => {
    // Get current value from previous execution or start at 0
    const currentValue =
      context.getStepResult<{ value: number }>('increment')?.value ||
      context.getStepResult<{ startValue: number }>('trigger')?.startValue ||
      0;

    // Increment the value
    const value = currentValue + 1;
    console.log(`Incrementing to ${value}`);

    return { value };
  },
});

// Create a final step
const finalStep = new Step({
  id: 'final',
  description: 'Final step after loop completes',
  execute: async ({ context }) => {
    const finalValue = context.getStepResult<{ value: number }>('increment')?.value;
    console.log(`Loop completed with final value: ${finalValue}`);
    return { finalValue };
  },
});

// Create the workflow
const counterWorkflow = new Workflow({
  name: 'counter-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
    targetValue: z.number(),
  }),
});

// Configure the workflow with a while loop
counterWorkflow
  .step(incrementStep)
  .while(
    async ({ context }) => {
      const targetValue = context.triggerData.targetValue;
      const currentValue = context.getStepResult<{ value: number }>('increment')?.value ?? 0;
      return currentValue < targetValue;
    },
    incrementStep
  )
  .then(finalStep)
  .commit();

// Execute the workflow
const run = counterWorkflow.createRun();
const result = await run.start({ triggerData: { startValue: 0, targetValue: 5 } });
// Will increment from 0 to 4, then stop and execute finalStep
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/while\#related)

- [.until()](https://mastra.ai/docs/reference/workflows/until) \- Loop until a condition becomes true
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow#loop-control-with-until-and-while)
- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)

Last updated on March 11, 2025

[.until()](https://mastra.ai/docs/reference/workflows/until ".until()") [.createRun()](https://mastra.ai/docs/reference/workflows/createRun ".createRun()")

## Mastra Deploy CLI
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [CLI](https://mastra.ai/docs/reference/cli/init "CLI") mastra deploy

# `mastra deploy` Reference

## `mastra deploy vercel` [Permalink for this section](https://mastra.ai/docs/reference/cli/deploy\#mastra-deploy-vercel)

Deploy your Mastra project to Vercel.

## `mastra deploy cloudflare` [Permalink for this section](https://mastra.ai/docs/reference/cli/deploy\#mastra-deploy-cloudflare)

Deploy your Mastra project to Cloudflare.

## `mastra deploy netlify` [Permalink for this section](https://mastra.ai/docs/reference/cli/deploy\#mastra-deploy-netlify)

Deploy your Mastra project to Netlify.

### Flags [Permalink for this section](https://mastra.ai/docs/reference/cli/deploy\#flags)

- `-d, --dir <dir>`: Path to your mastra folder

Last updated on March 11, 2025

[mastra dev](https://mastra.ai/docs/reference/cli/dev "mastra dev") [mastra build](https://mastra.ai/docs/reference/cli/build "mastra build")

## Workflow Until Method
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").until()

# Workflow.until()

The `.until()` method repeats a step until a specified condition becomes true. This creates a loop that continues executing the specified step until the condition is satisfied.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#usage)

```nextra-code
workflow
  .step(incrementStep)
  .until(condition, incrementStep)
  .then(finalStep);
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#parameters)

### condition:

Function \| ReferenceCondition

A function or reference condition that determines when to stop looping

### step:

Step

The step to repeat until the condition is met

## Condition Types [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#condition-types)

### Function Condition [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#function-condition)

You can use a function that returns a boolean:

```nextra-code
workflow
  .step(incrementStep)
  .until(async ({ context }) => {
    const result = context.getStepResult<{ value: number }>('increment');
    return (result?.value ?? 0) >= 10; // Stop when value reaches or exceeds 10
  }, incrementStep)
  .then(finalStep);
```

### Reference Condition [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#reference-condition)

You can use a reference-based condition with comparison operators:

```nextra-code
workflow
  .step(incrementStep)
  .until(
    {
      ref: { step: incrementStep, path: 'value' },
      query: { $gte: 10 }, // Stop when value is greater than or equal to 10
    },
    incrementStep
  )
  .then(finalStep);
```

## Comparison Operators [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#comparison-operators)

When using reference-based conditions, you can use these comparison operators:

| Operator | Description | Example |
| --- | --- | --- |
| `$eq` | Equal to | `{ $eq: 10 }` |
| `$ne` | Not equal to | `{ $ne: 0 }` |
| `$gt` | Greater than | `{ $gt: 5 }` |
| `$gte` | Greater than or equal to | `{ $gte: 10 }` |
| `$lt` | Less than | `{ $lt: 20 }` |
| `$lte` | Less than or equal to | `{ $lte: 15 }` |

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#returns)

### workflow:

Workflow

The workflow instance for chaining

## Example [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#example)

```nextra-code
import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

// Create a step that increments a counter
const incrementStep = new Step({
  id: 'increment',
  description: 'Increments the counter by 1',
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ context }) => {
    // Get current value from previous execution or start at 0
    const currentValue =
      context.getStepResult<{ value: number }>('increment')?.value ||
      context.getStepResult<{ startValue: number }>('trigger')?.startValue ||
      0;

    // Increment the value
    const value = currentValue + 1;
    console.log(`Incrementing to ${value}`);

    return { value };
  },
});

// Create a final step
const finalStep = new Step({
  id: 'final',
  description: 'Final step after loop completes',
  execute: async ({ context }) => {
    const finalValue = context.getStepResult<{ value: number }>('increment')?.value;
    console.log(`Loop completed with final value: ${finalValue}`);
    return { finalValue };
  },
});

// Create the workflow
const counterWorkflow = new Workflow({
  name: 'counter-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
    targetValue: z.number(),
  }),
});

// Configure the workflow with an until loop
counterWorkflow
  .step(incrementStep)
  .until(async ({ context }) => {
    const targetValue = context.triggerData.targetValue;
    const currentValue = context.getStepResult<{ value: number }>('increment')?.value ?? 0;
    return currentValue >= targetValue;
  }, incrementStep)
  .then(finalStep)
  .commit();

// Execute the workflow
const run = counterWorkflow.createRun();
const result = await run.start({ triggerData: { startValue: 0, targetValue: 5 } });
// Will increment from 0 to 5, then stop and execute finalStep
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/until\#related)

- [.while()](https://mastra.ai/docs/reference/workflows/while) \- Loop while a condition is true
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow#loop-control-with-until-and-while)
- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)

Last updated on March 11, 2025

[.then()](https://mastra.ai/docs/reference/workflows/then ".then()") [.while()](https://mastra.ai/docs/reference/workflows/while ".while()")

## Toxicity Metric
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Evals](https://mastra.ai/docs/reference/evals/answer-relevancy "Evals") Toxicity

# ToxicityMetric

The `ToxicityMetric` class evaluates whether an LLM’s output contains racist, biased, or toxic elements. It uses a judge-based system to analyze responses for various forms of toxicity including personal attacks, mockery, hate speech, dismissive statements, and threats.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#basic-usage)

```nextra-code
import { openai } from "@ai-sdk/openai";
import { ToxicityMetric } from "@mastra/evals/llm";

// Configure the model for evaluation
const model = openai("gpt-4o-mini");

const metric = new ToxicityMetric(model, {
  scale: 1, // Default scale is 0-1
});

const result = await metric.measure(
  "How is Sarah as a person?",
  "Sarah is a dedicated team member who always delivers quality work.",
);

console.log(result.score); // Score from 0-1 (0 = not toxic, 1 = toxic)
console.log(result.info.reason); // Explanation of the toxicity assessment
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#constructor-parameters)

### model:

LanguageModel

Configuration for the model used to evaluate toxicity

### options?:

ToxicityMetricOptions

= { scale: 1 }

Configuration options for the metric

### ToxicityMetricOptions [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#toxicitymetricoptions)

### scale?:

number

= 1

Maximum score value (default is 1)

## measure() Parameters [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#measure-parameters)

### input:

string

The original query or prompt

### output:

string

The LLM's response to evaluate

## Returns [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#returns)

### score:

number

Toxicity score (0 to scale, default 0-1)

### info:

object

Detailed toxicity info

string

### reason:

string

Detailed explanation of the toxicity assessment

## Scoring Details [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#scoring-details)

The metric evaluates toxicity through multiple aspects:

- Personal attacks
- Mockery or sarcasm
- Hate speech
- Dismissive statements
- Threats or intimidation

### Scoring Process [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#scoring-process)

1. Analyzes toxic elements:
   - Identifies personal attacks and mockery
   - Detects hate speech and threats
   - Evaluates dismissive statements
   - Assesses severity levels
2. Calculates toxicity score:
   - Weighs detected elements
   - Combines severity ratings
   - Normalizes to scale

Final score: `(toxicity_weighted_sum / max_toxicity) * scale`

### Score interpretation [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#score-interpretation)

(0 to scale, default 0-1)

- 0.8-1.0: Severe toxicity
- 0.4-0.7: Moderate toxicity
- 0.1-0.3: Mild toxicity
- 0.0: No toxic elements detected

## Example with Custom Configuration [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#example-with-custom-configuration)

```nextra-code
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

const metric = new ToxicityMetric(model, {
  scale: 10, // Use 0-10 scale instead of 0-1
});

const result = await metric.measure(
  "What do you think about the new team member?",
  "The new team member shows promise but needs significant improvement in basic skills.",
);
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/evals/toxicity\#related)

- [Tone Consistency Metric](https://mastra.ai/docs/reference/evals/tone-consistency)
- [Bias Metric](https://mastra.ai/docs/reference/evals/bias)

Last updated on March 11, 2025

[ToneConsistency](https://mastra.ai/docs/reference/evals/tone-consistency "ToneConsistency") [Mastra Voice](https://mastra.ai/docs/reference/voice/mastra-voice "Mastra Voice")

## Logger Instance Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Observability](https://mastra.ai/docs/reference/observability/providers "Observability") Logger

# Logger Instance

A Logger instance is created by `createLogger()` and provides methods to record events at various severity levels. Depending on the logger type, messages may be written to the console, file, or an external service.

## Example [Permalink for this section](https://mastra.ai/docs/reference/observability/logger\#example)

```nextra-code [counter-reset:line]
// Using a console logger
const logger = createLogger({ name: 'Mastra', level: 'info' });

logger.debug('Debug message'); // Won't be logged because level is INFO
logger.info({ message: 'User action occurred', destinationPath: 'user-actions', type: 'AGENT' }); // Logged
logger.error('An error occurred'); // Logged as ERROR
```

## Methods [Permalink for this section](https://mastra.ai/docs/reference/observability/logger\#methods)

### debug:

(message: BaseLogMessage \| string, ...args: any\[\]) => void \| Promise<void>

Write a DEBUG-level log. Only recorded if level ≤ DEBUG.

### info:

(message: BaseLogMessage \| string, ...args: any\[\]) => void \| Promise<void>

Write an INFO-level log. Only recorded if level ≤ INFO.

### warn:

(message: BaseLogMessage \| string, ...args: any\[\]) => void \| Promise<void>

Write a WARN-level log. Only recorded if level ≤ WARN.

### error:

(message: BaseLogMessage \| string, ...args: any\[\]) => void \| Promise<void>

Write an ERROR-level log. Only recorded if level ≤ ERROR.

### cleanup?:

() =\> Promise<void>

Cleanup resources held by the logger (e.g., network connections for Upstash). Not all loggers implement this.

**Note:** Some loggers require a `BaseLogMessage` object (with `message`, `destinationPath`, `type` fields). For instance, the `File` and `Upstash` loggers need structured messages.

Last updated on March 11, 2025

[Laminar](https://mastra.ai/docs/reference/observability/providers/laminar "Laminar") [OTelConfig](https://mastra.ai/docs/reference/observability/otel-config "OTelConfig")

## Workflow State Monitoring
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").watch()

# Workflow.watch()

The `.watch()` function subscribes to state changes in a Mastra workflow, allowing you to monitor execution progress and react to state updates.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/workflows/watch\#usage-example)

```nextra-code
import { Workflow } from "@mastra/core/workflows";

const workflow = new Workflow({
  name: "document-processor"
});

// Subscribe to state changes
const unsubscribe = workflow.watch((state) => {
  console.log('Current step:', state.currentStep);
  console.log('Step outputs:', state.stepOutputs);
});

// Run the workflow
await workflow.run({
  input: { text: "Process this document" }
});

// Stop watching
unsubscribe();
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/watch\#parameters)

### callback:

(state: WorkflowState) => void

Function called whenever the workflow state changes

### WorkflowState Properties [Permalink for this section](https://mastra.ai/docs/reference/workflows/watch\#workflowstate-properties)

### currentStep:

string

ID of the currently executing step

### stepOutputs:

Record<string, any>

Outputs from completed workflow steps

### status:

'running' \| 'completed' \| 'failed'

Current status of the workflow

### error?:

Error \| null

Error object if workflow failed

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/watch\#returns)

### unsubscribe:

() =\> void

Function to stop watching workflow state changes

## Additional Examples [Permalink for this section](https://mastra.ai/docs/reference/workflows/watch\#additional-examples)

Monitor specific step completion:

```nextra-code
workflow.watch((state) => {
  if (state.currentStep === 'processDocument') {
    console.log('Document processing output:', state.stepOutputs.processDocument);
  }
});
```

Error handling:

```nextra-code
workflow.watch((state) => {
  if (state.status === 'failed') {
    console.error('Workflow failed:', state.error);
    // Implement error recovery logic
  }
});
```

### Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/watch\#related)

- [Workflow Creation](https://mastra.ai/docs/reference/workflows/createRun)
- [Step Configuration](https://mastra.ai/docs/reference/workflows/step-class)

Last updated on March 11, 2025

[.commit()](https://mastra.ai/docs/reference/workflows/commit ".commit()") [Reference: Workflow.else() \| Conditional Branching \| Mastra Docs](https://mastra.ai/docs/reference/workflows/else "Reference: Workflow.else() | Conditional Branching | Mastra Docs")

## Mastra Application Deployer
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") DeployerDeployer

# Deployer

The Deployer handles the deployment of Mastra applications by packaging code, managing environment files, and serving applications using the Hono framework. Concrete implementations must define the deploy method for specific deployment targets.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#usage-example)

```nextra-code
import { Deployer } from "@mastra/deployer";

// Create a custom deployer by extending the abstract Deployer class
class CustomDeployer extends Deployer {
  constructor() {
    super({ name: 'custom-deployer' });
  }

  // Implement the abstract deploy method
  async deploy(outputDirectory: string): Promise<void> {
    // Prepare the output directory
    await this.prepare(outputDirectory);

    // Bundle the application
    await this._bundle('server.ts', 'mastra.ts', outputDirectory);

    // Custom deployment logic
    // ...
  }
}
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#parameters)

### Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#constructor-parameters)

### args:

object

Configuration options for the Deployer.

### args.name:

string

A unique name for the deployer instance.

### deploy Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#deploy-parameters)

### outputDirectory:

string

The directory where the bundled and deployment-ready application will be output.

## Methods [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#methods)

### getEnvFiles:

() =\> Promise<string\[\]>

Returns a list of environment files to be used during deployment. By default, it looks for '.env.production' and '.env' files.

### deploy:

(outputDirectory: string) => Promise<void>

Abstract method that must be implemented by subclasses. Handles the deployment process to the specified output directory.

## Inherited Methods from Bundler [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#inherited-methods-from-bundler)

The Deployer class inherits the following key methods from the Bundler class:

### prepare:

(outputDirectory: string) => Promise<void>

Prepares the output directory by cleaning it and creating necessary subdirectories.

### writeInstrumentationFile:

(outputDirectory: string) => Promise<void>

Writes an instrumentation file to the output directory for telemetry purposes.

### writePackageJson:

(outputDirectory: string, dependencies: Map<string, string>) => Promise<void>

Generates a package.json file in the output directory with the specified dependencies.

### \_bundle:

(serverFile: string, mastraEntryFile: string, outputDirectory: string, bundleLocation?: string) => Promise<void>

Bundles the application using the specified server and Mastra entry files.

## Core Concepts [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#core-concepts)

### Deployment Lifecycle [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#deployment-lifecycle)

The Deployer abstract class implements a structured deployment lifecycle:

1. **Initialization**: The deployer is initialized with a name and creates a Deps instance for dependency management.
2. **Environment Setup**: The `getEnvFiles` method identifies environment files (.env.production, .env) to be used during deployment.
3. **Preparation**: The `prepare` method (inherited from Bundler) cleans the output directory and creates necessary subdirectories.
4. **Bundling**: The `_bundle` method (inherited from Bundler) packages the application code and its dependencies.
5. **Deployment**: The abstract `deploy` method is implemented by subclasses to handle the actual deployment process.

### Environment File Management [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#environment-file-management)

The Deployer class includes built-in support for environment file management through the `getEnvFiles` method. This method:

- Looks for environment files in a predefined order (.env.production, .env)
- Uses the FileService to find the first existing file
- Returns an array of found environment files
- Returns an empty array if no environment files are found

```nextra-code
getEnvFiles(): Promise<string[]> {
  const possibleFiles = ['.env.production', '.env.local', '.env'];

  try {
    const fileService = new FileService();
    const envFile = fileService.getFirstExistingFile(possibleFiles);

    return Promise.resolve([envFile]);
  } catch {}

  return Promise.resolve([]);
}
```

### Bundling and Deployment Relationship [Permalink for this section](https://mastra.ai/docs/reference/deployer/deployer\#bundling-and-deployment-relationship)

The Deployer class extends the Bundler class, establishing a clear relationship between bundling and deployment:

1. **Bundling as a Prerequisite**: Bundling is a prerequisite step for deployment, where the application code is packaged into a deployable format.
2. **Shared Infrastructure**: Both bundling and deployment share common infrastructure like dependency management and file system operations.
3. **Specialized Deployment Logic**: While bundling focuses on code packaging, deployment adds environment-specific logic for deploying the bundled code.
4. **Extensibility**: The abstract `deploy` method allows for creating specialized deployers for different target environments.

Last updated on March 11, 2025

[Error Handling](https://mastra.ai/docs/reference/client-js/error-handling "Error Handling") [Cloudflare](https://mastra.ai/docs/reference/deployer/cloudflare "Cloudflare")

## Observability Providers
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") ObservabilityProvidersOverview

# Observability Providers

Observability providers include:

- [SigNoz](https://mastra.ai/docs/reference/observability/providers/signoz)
- [Braintrust](https://mastra.ai/docs/reference/observability/providers/braintrust)
- [Langfuse](https://mastra.ai/docs/reference/observability/providers/langfuse)
- [Langsmith](https://mastra.ai/docs/reference/observability/providers/langsmith)
- [New Relic](https://mastra.ai/docs/reference/observability/providers/new-relic)
- [Traceloop](https://mastra.ai/docs/reference/observability/providers/traceloop)
- [Laminar](https://mastra.ai/docs/reference/observability/providers/laminar)

Last updated on March 11, 2025

[Speechify](https://mastra.ai/docs/reference/voice/speechify "Speechify") [SigNoz](https://mastra.ai/docs/reference/observability/providers/signoz "SigNoz")

## Completeness Metric
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Evals](https://mastra.ai/docs/reference/evals/answer-relevancy "Evals") Completeness

# CompletenessMetric

The `CompletenessMetric` class evaluates how thoroughly an LLM’s output covers the key elements present in the input. It analyzes nouns, verbs, topics, and terms to determine coverage and provides a detailed completeness score.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#basic-usage)

```nextra-code
import { CompletenessMetric } from "@mastra/evals/nlp";

const metric = new CompletenessMetric();

const result = await metric.measure(
  "Explain how photosynthesis works in plants using sunlight, water, and carbon dioxide.",
  "Plants use sunlight to convert water and carbon dioxide into glucose through photosynthesis."
);

console.log(result.score); // Coverage score from 0-1
console.log(result.info); // Object containing detailed metrics about element coverage
```

## measure() Parameters [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#measure-parameters)

### input:

string

The original text containing key elements to be covered

### output:

string

The LLM's response to evaluate for completeness

## Returns [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#returns)

### score:

number

Completeness score (0-1) representing the proportion of input elements covered in the output

### info:

object

Object containing detailed metrics about element coverage

string\[\]

### inputElements:

string\[\]

Array of key elements extracted from the input

string\[\]

### outputElements:

string\[\]

Array of key elements found in the output

string\[\]

### missingElements:

string\[\]

Array of input elements not found in the output

object

### elementCounts:

object

Count of elements in input and output

## Element Extraction Details [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#element-extraction-details)

The metric extracts and analyzes several types of elements:

- Nouns: Key objects, concepts, and entities
- Verbs: Actions and states (converted to infinitive form)
- Topics: Main subjects and themes
- Terms: Individual significant words

The extraction process includes:

- Normalization of text (removing diacritics, converting to lowercase)
- Splitting camelCase words
- Handling of word boundaries
- Special handling of short words (3 characters or less)
- Deduplication of elements

## Scoring Details [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#scoring-details)

The metric evaluates completeness through linguistic element coverage analysis.

### Scoring Process [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#scoring-process)

1. Extracts key elements:
   - Nouns and named entities
   - Action verbs
   - Topic-specific terms
   - Normalized word forms
2. Calculates coverage of input elements:
   - Exact matches for short terms (≤3 chars)
   - Substantial overlap (>60%) for longer terms

Final score: `(covered_elements / total_input_elements) * scale`

### Score interpretation [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#score-interpretation)

(0 to scale, default 0-1)

- 1.0: Complete coverage - contains all input elements
- 0.7-0.9: High coverage - includes most key elements
- 0.4-0.6: Partial coverage - contains some key elements
- 0.1-0.3: Low coverage - missing most key elements
- 0.0: No coverage - output lacks all input elements

## Example with Analysis [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#example-with-analysis)

```nextra-code
import { CompletenessMetric } from "@mastra/evals/nlp";

const metric = new CompletenessMetric();

const result = await metric.measure(
  "The quick brown fox jumps over the lazy dog",
  "A brown fox jumped over a dog"
);

// Example output:
// {
//   score: 0.75,
//   info: {
//     inputElements: ["quick", "brown", "fox", "jump", "lazy", "dog"],
//     outputElements: ["brown", "fox", "jump", "dog"],
//     missingElements: ["quick", "lazy"],
//     elementCounts: { input: 6, output: 4 }
//   }
// }
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/evals/completeness\#related)

- [Answer Relevancy Metric](https://mastra.ai/docs/reference/evals/answer-relevancy)
- [Content Similarity Metric](https://mastra.ai/docs/reference/evals/content-similarity)
- [Textual Difference Metric](https://mastra.ai/docs/reference/evals/textual-difference)
- [Keyword Coverage Metric](https://mastra.ai/docs/reference/evals/keyword-coverage)

Last updated on March 11, 2025

[Bias](https://mastra.ai/docs/reference/evals/bias "Bias") [ContentSimilarity](https://mastra.ai/docs/reference/evals/content-similarity "ContentSimilarity")

## Mastra MCP Client
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Tools](https://mastra.ai/docs/reference/tools/document-chunker-tool "Tools") MastraMCPClient

# MastraMCPClient

The `MastraMCPClient` class provides a client implementation for interacting with Model Context Protocol (MCP) servers. It handles connection management, resource discovery, and tool execution through the MCP protocol.

## Constructor [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#constructor)

Creates a new instance of the MastraMCPClient.

```nextra-code
constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
}: {
    name: string;
    server: StdioServerParameters | SSEClientParameters;
    capabilities?: ClientCapabilities;
    version?: string;
})
```

### Parameters [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#parameters)

### name:

string

The name identifier for this client instance.

### version?:

string

= 1.0.0

The version of the client.

### server:

StdioServerParameters \| SSEClientParameters

Configuration parameters for either a stdio server connection or an SSE server connection.

### capabilities?:

ClientCapabilities

= {}

Optional capabilities configuration for the client.

## Methods [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#methods)

### connect() [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#connect)

Establishes a connection with the MCP server.

```nextra-code
async connect(): Promise<void>
```

### disconnect() [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#disconnect)

Closes the connection with the MCP server.

```nextra-code
async disconnect(): Promise<void>
```

### resources() [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#resources)

Retrieves the list of available resources from the server.

```nextra-code
async resources(): Promise<ListResourcesResult>
```

### tools() [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#tools)

Fetches and initializes available tools from the server, converting them into Mastra-compatible tool formats.

```nextra-code
async tools(): Promise<Record<string, Tool>>
```

Returns an object mapping tool names to their corresponding Mastra tool implementations.

## Examples [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#examples)

### Using with Mastra Agent [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#using-with-mastra-agent)

#### Example with Stdio Server [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#example-with-stdio-server)

```nextra-code
import { Agent } from "@mastra/core/agent";
import { MastraMCPClient } from "@mastra/mcp";
import { openai } from "@ai-sdk/openai";

// Initialize the MCP client using mcp/fetch as an example https://hub.docker.com/r/mcp/fetch
// Visit https://github.com/docker/mcp-servers for other reference docker mcp servers
const fetchClient = new MastraMCPClient({
  name: "fetch",
  server: {
    command: "docker",
    args: ["run", "-i", "--rm", "mcp/fetch"],
  },
});

// Create a Mastra Agent
const agent = new Agent({
  name: "Fetch agent",
  instructions:
    "You are able to fetch data from URLs on demand and discuss the response data with the user.",
  model: openai("gpt-4o-mini"),
});

try {
  // Connect to the MCP server
  await fetchClient.connect();

  // Gracefully handle process exits so the docker subprocess is cleaned up
  process.on("exit", () => {
    fetchClient.disconnect();
  });

  // Get available tools
  const tools = await fetchClient.tools();

  // Use the agent with the MCP tools
  const response = await agent.generate(
    "Tell me about mastra.ai/docs. Tell me generally what this page is and the content it includes.",
    {
      toolsets: {
        fetch: tools,
      },
    },
  );

  console.log("\n\n" + response.text);
} catch (error) {
  console.error("Error:", error);
} finally {
  // Always disconnect when done
  await fetchClient.disconnect();
}
```

#### Example with SSE Server [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#example-with-sse-server)

```nextra-code
// Initialize the MCP client using an SSE server
const sseClient = new MastraMCPClient({
  name: "sse-client",
  server: {
    url: new URL("https://your-mcp-server.com/sse"),
    // Optional fetch request configuration
    requestInit: {
      headers: {
        Authorization: "Bearer your-token",
      },
    },
  },
});

// The rest of the usage is identical to the stdio example
```

## Related Information [Permalink for this section](https://mastra.ai/docs/reference/tools/client\#related-information)

- For managing multiple MCP servers in your application, see the [MCPConfiguration documentation](https://mastra.ai/docs/reference/tools/configuration)
- For more details about the Model Context Protocol, see the [@modelcontextprotocol/sdk documentation](https://github.com/modelcontextprotocol/typescript-sdk).

Last updated on March 11, 2025

[createVectorQueryTool()](https://mastra.ai/docs/reference/tools/vector-query-tool "createVectorQueryTool()") [MCPConfiguration](https://mastra.ai/docs/reference/tools/mcp-configuration "MCPConfiguration")

## Document Chunking Function
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") RAG.chunk()

# Reference: .chunk()

The `.chunk()` function splits documents into smaller segments using various strategies and options.

## Example [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#example)

```nextra-code
import { Document } from '@mastra/core';

const doc = new Document(`
# Introduction
This is a sample document that we want to split into chunks.

## Section 1
Here is the first section with some content.

## Section 2
Here is another section with different content.
`);

// Basic chunking with defaults
const chunks = await doc.chunk();

// Markdown-specific chunking with header extraction
const chunksWithMetadata = await doc.chunk({
  strategy: 'markdown',
  headers: [['#', 'title'], ['##', 'section']],
  extract: {
    fields: [\
      { name: 'summary', description: 'A brief summary of the chunk content' },\
      { name: 'keywords', description: 'Key terms found in the chunk' }\
    ]
  }
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#parameters)

### strategy?:

'recursive' \| 'character' \| 'token' \| 'markdown' \| 'html' \| 'json' \| 'latex'

The chunking strategy to use. If not specified, defaults based on document type. Depending on the chunking strategy, there are additional optionals. Defaults: .md files → 'markdown', .html/.htm → 'html', .json → 'json', .tex → 'latex', others → 'recursive'

### size?:

number

= 512

Maximum size of each chunk

### overlap?:

number

= 50

Number of characters/tokens that overlap between chunks.

### separator?:

string

= \\n\\n

Character(s) to split on. Defaults to double newline for text content.

### isSeparatorRegex?:

boolean

= false

Whether the separator is a regex pattern

### keepSeparator?:

'start' \| 'end'

Whether to keep the separator at the start or end of chunks

### extract?:

ExtractParams

Metadata extraction configuration. See \[ExtractParams reference\](./extract-params) for details.

## Strategy-Specific Options [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#strategy-specific-options)

Strategy-specific options are passed as top-level parameters alongside the strategy parameter. For example:

```nextra-code [counter-reset:line]
// HTML strategy example
const chunks = await doc.chunk({
  strategy: 'html',
  headers: [['h1', 'title'], ['h2', 'subtitle']], // HTML-specific option
  sections: [['div.content', 'main']], // HTML-specific option
  size: 500 // general option
});

// Markdown strategy example
const chunks = await doc.chunk({
  strategy: 'markdown',
  headers: [['#', 'title'], ['##', 'section']], // Markdown-specific option
  stripHeaders: true, // Markdown-specific option
  overlap: 50 // general option
});

// Token strategy example
const chunks = await doc.chunk({
  strategy: 'token',
  encodingName: 'gpt2', // Token-specific option
  modelName: 'gpt-3.5-turbo', // Token-specific option
  size: 1000 // general option
});
```

The options documented below are passed directly at the top level of the configuration object, not nested within a separate options object.

### HTML [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#html)

### headers:

Array<\[string, string\]>

Array of \[selector, metadata key\] pairs for header-based splitting

### sections:

Array<\[string, string\]>

Array of \[selector, metadata key\] pairs for section-based splitting

### returnEachLine?:

boolean

Whether to return each line as a separate chunk

### Markdown [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#markdown)

### headers:

Array<\[string, string\]>

Array of \[header level, metadata key\] pairs

### stripHeaders?:

boolean

Whether to remove headers from the output

### returnEachLine?:

boolean

Whether to return each line as a separate chunk

### Token [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#token)

### encodingName?:

string

Name of the token encoding to use

### modelName?:

string

Name of the model for tokenization

### JSON [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#json)

### maxSize:

number

Maximum size of each chunk

### minSize?:

number

Minimum size of each chunk

### ensureAscii?:

boolean

Whether to ensure ASCII encoding

### convertLists?:

boolean

Whether to convert lists in the JSON

## Return Value [Permalink for this section](https://mastra.ai/docs/reference/rag/chunk\#return-value)

Returns a `MDocument` instance containing the chunked documents. Each chunk includes:

```nextra-code
interface DocumentNode {
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}
```

Last updated on March 11, 2025

[Upstash Storage](https://mastra.ai/docs/reference/storage/upstash "Upstash Storage") [.embed()](https://mastra.ai/docs/reference/rag/embeddings ".embed()")

## ElevenLabs Voice Implementation
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Voice](https://mastra.ai/docs/reference/voice/mastra-voice "Voice") ElevenLabs

# ElevenLabs

The ElevenLabs voice implementation in Mastra provides high-quality text-to-speech (TTS) and speech-to-text (STT) capabilities using the ElevenLabs API.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#usage-example)

```nextra-code
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

// Initialize with default configuration (uses ELEVENLABS_API_KEY environment variable)
const voice = new ElevenLabsVoice();

// Initialize with custom configuration
const voice = new ElevenLabsVoice({
  speechModel: {
    name: 'eleven_multilingual_v2',
    apiKey: 'your-api-key',
  },
  speaker: 'custom-speaker-id',
});

// Text-to-Speech
const audioStream = await voice.speak("Hello, world!");

// Get available speakers
const speakers = await voice.getSpeakers();
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#constructor-parameters)

### speechModel?:

ElevenLabsVoiceConfig

= { name: 'eleven\_multilingual\_v2' }

Configuration for text-to-speech functionality.

### speaker?:

string

= '9BWtsMINqrJLrRacOk9x' (Aria voice)

ID of the speaker to use for text-to-speech

### ElevenLabsVoiceConfig [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#elevenlabsvoiceconfig)

### name?:

ElevenLabsModel

= 'eleven\_multilingual\_v2'

The ElevenLabs model to use

### apiKey?:

string

ElevenLabs API key. Falls back to ELEVENLABS\_API\_KEY environment variable

## Methods [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#methods)

### speak() [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#speak)

Converts text to speech using the configured speech model and voice.

### input:

string \| NodeJS.ReadableStream

Text to convert to speech. If a stream is provided, it will be converted to text first.

### options?:

object

Additional options for speech synthesis

### options.speaker?:

string

Override the default speaker ID for this request

Returns: `Promise<NodeJS.ReadableStream>`

### getSpeakers() [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#getspeakers)

Returns an array of available voice options, where each node contains:

### voiceId:

string

Unique identifier for the voice

### name:

string

Display name of the voice

### language:

string

Language code for the voice

### gender:

string

Gender of the voice

### listen() [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#listen)

Converts audio input to text using ElevenLabs Speech-to-Text API.

### input:

NodeJS.ReadableStream

A readable stream containing the audio data to transcribe

### options?:

object

Configuration options for the transcription

The options object supports the following properties:

### language\_code?:

string

ISO language code (e.g., 'en', 'fr', 'es')

### tag\_audio\_events?:

boolean

Whether to tag audio events like \[MUSIC\], \[LAUGHTER\], etc.

### num\_speakers?:

number

Number of speakers to detect in the audio

### filetype?:

string

Audio file format (e.g., 'mp3', 'wav', 'ogg')

### timeoutInSeconds?:

number

Request timeout in seconds

### maxRetries?:

number

Maximum number of retry attempts

### abortSignal?:

AbortSignal

Signal to abort the request

Returns: `Promise<string>` \- A Promise that resolves to the transcribed text

## Important Notes [Permalink for this section](https://mastra.ai/docs/reference/voice/elevenlabs\#important-notes)

1. An ElevenLabs API key is required. Set it via the `ELEVENLABS_API_KEY` environment variable or pass it in the constructor.
2. The default speaker is set to Aria (ID: ‘9BWtsMINqrJLrRacOk9x’).
3. Speech-to-text functionality is not supported by ElevenLabs.
4. Available speakers can be retrieved using the `getSpeakers()` method, which returns detailed information about each voice including language and gender.

Last updated on March 11, 2025

[Deepgram](https://mastra.ai/docs/reference/voice/deepgram "Deepgram") [Google](https://mastra.ai/docs/reference/voice/google "Google")

## Mastra Installation Guide
[Docs](https://mastra.ai/docs "Docs") Getting StartedInstallation

# Installing Mastra Locally

To run Mastra, you need access to an LLM. Typically, you’ll want to get an API key from an LLM provider such as [OpenAI](https://platform.openai.com/), [Anthropic](https://console.anthropic.com/settings/keys), or [Google Gemini](https://ai.google.dev/gemini-api/docs). You can also run Mastra with a local LLM using [Ollama](https://ollama.ai/).

## Prerequisites [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#prerequisites)

- Node.js `v20.0` or higher
- Access to a [supported large language model (LLM)](https://mastra.ai/docs/reference/llm/providers-and-models)

## Automatic Installation [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#automatic-installation)

Getting Started With Mastra - YouTube

Mastra AI

1.24K subscribers

[Getting Started With Mastra](https://www.youtube.com/watch?v=spGlcTEjuXY)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=spGlcTEjuXY "Watch on YouTube")

### Create a New Project [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#create-a-new-project)

We recommend starting a new Mastra project using `create-mastra`, which will scaffold your project. To create
a project, run:

npxnpmyarnpnpm

```nextra-code
npx create-mastra@latest
```

On installation, you’ll be guided through the following prompts:

```nextra-code
What do you want to name your project? my-mastra-app
Choose components to install:
  ◯ Agents (recommended)
  ◯ Tools
  ◯ Workflows
Select default provider:
  ◯ OpenAI (recommended)
  ◯ Anthropic
  ◯ Groq
Would you like to include example code? No / Yes
```

After the prompts, `create-mastra` will set up your project directory with TypeScript, install dependencies, and configure your selected components and LLM provider.

### Set Up your API Key [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#set-up-your-api-key)

Add the API key for your configured LLM provider in your `.env` file.

.env

```nextra-code
OPENAI_API_KEY=<your-openai-key>
```

Extra Notes:

If you prefer to run the command with flags (non-interactive mode) and include the example code, you can use:

```nextra-code
npx create-mastra@latest --components agents,tools --llm openai --example
```

To configure and specify a timeout if installation takes too long use the timeout flag:

```nextra-code
npx create-mastra@latest --timeout
```

## Manual Installation [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#manual-installation)

If you prefer to set up your Mastra project manually, follow these steps:

### Create a New Project [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#create-a-new-project-1)

Create a project directory and navigate into it:

```nextra-code
mkdir hello-mastra
cd hello-mastra
```

Then, initialize a TypeScript project including the `@mastra/core` package:

npmpnpmyarnbun

```nextra-code
npm init -y
npm install typescript tsx @types/node mastra@alpha --save-dev
npm install @mastra/core@alpha zod
npx tsc --init
```

### Initialize TypeScript [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#initialize-typescript)

Create a `tsconfig.json` file in your project root with the following configuration:

```nextra-code
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": [\
    "src/**/*"\
  ],
  "exclude": [\
    "node_modules",\
    "dist",\
    ".mastra"\
  ]
}
```

This TypeScript configuration is optimized for Mastra projects, using modern module resolution and strict type checking.

### Set Up your API Key [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#set-up-your-api-key-1)

Create a `.env` file in your project root directory and add your API key:

.env

```nextra-code
OPENAI_API_KEY=<your-openai-key>
```

Replace your\_openai\_api\_key with your actual API key.

### Create a Tool [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#create-a-tool)

Create a `weather-tool` tool file:

```nextra-code
mkdir -p src/mastra/tools && touch src/mastra/tools/weather-tool.ts
```

Then, add the following code to `src/mastra/tools/weather-tool.ts`:

src/mastra/tools/weather-tool.ts

```nextra-code [counter-reset:line]
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});

const getWeather = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = await geocodingResponse.json();

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data: WeatherResponse = await response.json();

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Unknown";
}
```

### Create an Agent [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#create-an-agent)

Create a `weather` agent file:

```nextra-code
mkdir -p src/mastra/agents && touch src/mastra/agents/weather.ts
```

Then, add the following code to `src/mastra/agents/weather.ts`:

src/mastra/agents/weather.ts

```nextra-code [counter-reset:line]
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: `You are a helpful weather assistant that provides accurate weather information.

Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative

Use the weatherTool to fetch current weather data.`,
  model: openai("gpt-4o-mini"),
  tools: { weatherTool },
});
```

### Register Agent [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#register-agent)

Finally, create the Mastra entry point in `src/mastra/index.ts` and register agent:

src/mastra/index.ts

```nextra-code [counter-reset:line]
import { Mastra } from "@mastra/core";

import { weatherAgent } from "./agents/weather";

export const mastra = new Mastra({
  agents: { weatherAgent },
});
```

This registers your agent with Mastra so that `mastra dev` can discover and serve it.

## Existing Project Installation [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#existing-project-installation)

To add Mastra to an existing project, see our Local dev docs on [mastra\\
init](https://mastra.ai/docs/local-dev/creating-projects#adding-to-an-existing-project).

You can also checkout our framework specific docs e.g [Next.js](https://mastra.ai/docs/frameworks/01-next-js)

## Start the Mastra Server [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#start-the-mastra-server)

Mastra provides commands to serve your agents via REST endpoints

### Development Server [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#development-server)

Run the following command to start the Mastra server:

```nextra-code
npm run dev
```

If you have the mastra CLI installed, run:

```nextra-code
mastra dev
```

This command creates REST API endpoints for your agents.

### Test the Endpoint [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#test-the-endpoint)

You can test the agent’s endpoint using `curl` or `fetch`:

curlfetch

```nextra-code
curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
-H "Content-Type: application/json" \
-d '{"messages": ["What is the weather in London?"]}'
```

## Run from the command line [Permalink for this section](https://mastra.ai/docs/getting-started/installation\#run-from-the-command-line)

If you’d like to directly call agents from the command line, you can create a script to get an agent and call it:

src/index.ts

```nextra-code [counter-reset:line]
import { mastra } from "./mastra";

async function main() {
  const agent = await mastra.getAgent("weatherAgent");

  const result = await agent.generate("What is the weather in London?");

  console.log("Agent response:", result.text);
}

main();
```

Then, run the script to test that everything is set up correctly:

```nextra-code
npx tsx src/index.ts
```

This should output the agent’s response to your console.

* * *

Last updated on March 11, 2025

[Introduction](https://mastra.ai/docs "Introduction") [Project Structure](https://mastra.ai/docs/getting-started/project-structure "Project Structure")

## Mastra Integrations Guide
[Docs](https://mastra.ai/docs "Docs") [Local Dev](https://mastra.ai/docs/local-dev/creating-projects "Local Dev") Integrations

# Using Mastra Integrations

Integrations in Mastra are auto-generated, type-safe API clients for third-party services. They can be used as tools for agents or as steps in workflows.

## Installing an Integration [Permalink for this section](https://mastra.ai/docs/local-dev/integrations\#installing-an-integration)

Mastra’s default integrations are packaged as individually installable npm modules. You can add an integration to your project by installing it via npm and importing it into your Mastra configuration.

### Example: Adding the GitHub Integration [Permalink for this section](https://mastra.ai/docs/local-dev/integrations\#example-adding-the-github-integration)

1. **Install the Integration Package**

To install the GitHub integration, run:

```nextra-code
npm install @mastra/github
```

2. **Add the Integration to Your Project**

Create a new file for your integrations (e.g., `src/mastra/integrations/index.ts`) and import the integration:

src/mastra/integrations/index.ts

```nextra-code [counter-reset:line]
import { GithubIntegration } from '@mastra/github';

export const github = new GithubIntegration({
  config: {
    PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PAT!,
  },
});
```

Make sure to replace `process.env.GITHUB_PAT!` with your actual GitHub Personal Access Token or ensure that the environment variable is properly set.

3. **Use the Integration in Tools or Workflows**

You can now use the integration when defining tools for your agents or in workflows.

src/mastra/tools/index.ts

```nextra-code [counter-reset:line]
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { github } from '../integrations';

export const getMainBranchRef = createTool({
  id: 'getMainBranchRef',
  description: 'Fetch the main branch reference from a GitHub repository',
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
  }),
  outputSchema: z.object({
    ref: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const client = await github.getApiClient();

    const mainRef = await client.gitGetRef({
      path: {
        owner: context.owner,
        repo: context.repo,
        ref: 'heads/main',
      },
    });

    return { ref: mainRef.data?.ref };
  },
});
```

In the example above:

- We import the `github` integration.
- We define a tool called `getMainBranchRef` that uses the GitHub API client to fetch the reference of the main branch of a repository.
- The tool accepts `owner` and `repo` as inputs and returns the reference string.

## Using Integrations in Agents [Permalink for this section](https://mastra.ai/docs/local-dev/integrations\#using-integrations-in-agents)

Once you’ve defined tools that utilize integrations, you can include these tools in your agents.

src/mastra/agents/index.ts

```nextra-code [counter-reset:line]
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { getMainBranchRef } from '../tools';

export const codeReviewAgent = new Agent({
  name: 'Code Review Agent',
  instructions: 'An agent that reviews code repositories and provides feedback.',
  model: openai('gpt-4o-mini'),
  tools: {
    getMainBranchRef,
    // other tools...
  },
});
```

In this setup:

- We create an agent named `Code Review Agent`.
- We include the `getMainBranchRef` tool in the agent’s available tools.
- The agent can now use this tool to interact with GitHub repositories during conversations.

## Environment Configuration [Permalink for this section](https://mastra.ai/docs/local-dev/integrations\#environment-configuration)

Ensure that any required API keys or tokens for your integrations are properly set in your environment variables. For example, with the GitHub integration, you need to set your GitHub Personal Access Token:

```nextra-code
GITHUB_PAT=your_personal_access_token
```

Consider using a `.env` file or another secure method to manage sensitive credentials.

## Available Integrations [Permalink for this section](https://mastra.ai/docs/local-dev/integrations\#available-integrations)

Mastra provides several built-in integrations; primarily API-key based integrations that do not require OAuth. Some available integrations including Github, Stripe, Resend, Firecrawl, and more.

Check [Mastra’s codebase](https://github.com/mastra-ai/mastra/tree/main/integrations) or [npm packages](https://www.npmjs.com/search?q=%22%40mastra%22) for a full list of available integrations.

## Conclusion [Permalink for this section](https://mastra.ai/docs/local-dev/integrations\#conclusion)

Integrations in Mastra enable your AI agents and workflows to interact with external services seamlessly. By installing and configuring integrations, you can extend the capabilities of your application to include operations such as fetching data from APIs, sending messages, or managing resources in third-party systems.

Remember to consult the documentation of each integration for specific usage details and to adhere to best practices for security and type safety.

Last updated on March 11, 2025

[Mastra Dev](https://mastra.ai/docs/local-dev/mastra-dev "Mastra Dev") [Mastra Server](https://mastra.ai/docs/deployment/server "Mastra Server")

## Deepgram Voice Implementation
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Voice](https://mastra.ai/docs/reference/voice/mastra-voice "Voice") Deepgram

# Deepgram

The Deepgram voice implementation in Mastra provides text-to-speech (TTS) and speech-to-text (STT) capabilities using Deepgram’s API. It supports multiple voice models and languages, with configurable options for both speech synthesis and transcription.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#usage-example)

```nextra-code
import { DeepgramVoice } from "@mastra/voice-deepgram";

// Initialize with default configuration (uses DEEPGRAM_API_KEY environment variable)
const voice = new DeepgramVoice();

// Initialize with custom configuration
const voice = new DeepgramVoice({
  speechModel: {
    name: 'aura',
    apiKey: 'your-api-key',
  },
  listeningModel: {
    name: 'nova-2',
    apiKey: 'your-api-key',
  },
  speaker: 'asteria-en',
});

// Text-to-Speech
const audioStream = await voice.speak("Hello, world!");

// Speech-to-Text
const transcript = await voice.listen(audioStream);
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#constructor-parameters)

### speechModel?:

DeepgramVoiceConfig

= { name: 'aura' }

Configuration for text-to-speech functionality.

### listeningModel?:

DeepgramVoiceConfig

= { name: 'nova' }

Configuration for speech-to-text functionality.

### speaker?:

DeepgramVoiceId

= 'asteria-en'

Default voice to use for text-to-speech

### DeepgramVoiceConfig [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#deepgramvoiceconfig)

### name?:

DeepgramModel

The Deepgram model to use

### apiKey?:

string

Deepgram API key. Falls back to DEEPGRAM\_API\_KEY environment variable

### properties?:

Record<string, any>

Additional properties to pass to the Deepgram API

### language?:

string

Language code for the model

## Methods [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#methods)

### speak() [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#speak)

Converts text to speech using the configured speech model and voice.

### input:

string \| NodeJS.ReadableStream

Text to convert to speech. If a stream is provided, it will be converted to text first.

### options?:

object

Additional options for speech synthesis

### options.speaker?:

string

Override the default speaker for this request

Returns: `Promise<NodeJS.ReadableStream>`

### listen() [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#listen)

Converts speech to text using the configured listening model.

### audioStream:

NodeJS.ReadableStream

Audio stream to transcribe

### options?:

object

Additional options to pass to the Deepgram API

Returns: `Promise<string>`

### getSpeakers() [Permalink for this section](https://mastra.ai/docs/reference/voice/deepgram\#getspeakers)

Returns a list of available voice options.

### voiceId:

string

Unique identifier for the voice

Last updated on March 11, 2025

[Composite Voice](https://mastra.ai/docs/reference/voice/composite-voice "Composite Voice") [ElevenLabs](https://mastra.ai/docs/reference/voice/elevenlabs "ElevenLabs")

## Control Flow Workflows
[Docs](https://mastra.ai/docs "Docs") [Workflows](https://mastra.ai/docs/workflows/00-overview "Workflows") Control Flow

# Control Flow in Workflows: Branching, Merging, and Conditions

When you create a multi-step process, you may need to run steps in parallel, chain them sequentially, or follow different paths based on outcomes. This page describes how you can manage branching, merging, and conditions to construct workflows that meet your logic requirements. The code snippets show the key patterns for structuring complex control flow.

## Parallel Execution [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#parallel-execution)

You can run multiple steps at the same time if they don’t depend on each other. This approach can speed up your workflow when steps perform independent tasks. The code below shows how to add two steps in parallel:

```nextra-code
myWorkflow.step(fetchUserData).step(fetchOrderData);
```

See the [Parallel Steps](https://mastra.ai/examples/workflows/parallel-steps) example for more details.

## Sequential Execution [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#sequential-execution)

Sometimes you need to run steps in strict order to ensure outputs from one step become inputs for the next. Use .then() to link dependent operations. The code below shows how to chain steps sequentially:

```nextra-code
myWorkflow.step(fetchOrderData).then(validateData).then(processOrder);
```

See the [Sequential Steps](https://mastra.ai/examples/workflows/sequential-steps) example for more details.

## Branching and Merging Paths [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#branching-and-merging-paths)

When different outcomes require different paths, branching is helpful. You can also merge paths later once they complete. The code below shows how to branch after stepA and later converge on stepF:

```nextra-code
myWorkflow
  .step(stepA)
    .then(stepB)
    .then(stepD)
  .after(stepA)
    .step(stepC)
    .then(stepE)
  .after(stepD)
    .step(stepF);
    .step(stepE)
```

In this example:

- stepA leads to stepB, then to stepD.
- Separately, stepA also triggers stepC, which in turn leads to stepE.
- Separately, stepD also triggers stepF and stepE in parallel.

See the [Branching Paths](https://mastra.ai/examples/workflows/branching-paths) example for more details.

## Merging Multiple Branches [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#merging-multiple-branches)

Sometimes you need a step to execute only after multiple other steps have completed. Mastra provides a compound `.after([])` syntax that allows you to specify multiple dependencies for a step.

```nextra-code
myWorkflow
  .step(fetchUserData)
  .then(validateUserData)
  .step(fetchProductData)
  .then(validateProductData)
  // This step will only run after BOTH validateUserData AND validateProductData have completed
  .after([validateUserData, validateProductData])
  .step(processOrder)
```

In this example:

- `fetchUserData` and `fetchProductData` run in parallel branches
- Each branch has its own validation step
- The `processOrder` step only executes after both validation steps have completed successfully

This pattern is particularly useful for:

- Joining parallel execution paths
- Implementing synchronization points in your workflow
- Ensuring all required data is available before proceeding

You can also create complex dependency patterns by combining multiple `.after([])` calls:

```nextra-code
myWorkflow
  // First branch
  .step(stepA)
  .then(stepB)
  .then(stepC)

  // Second branch
  .step(stepD)
  .then(stepE)

  // Third branch
  .step(stepF)
  .then(stepG)

  // This step depends on the completion of multiple branches
  .after([stepC, stepE, stepG])
  .step(finalStep)
```

## Cyclical Dependencies and Loops [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#cyclical-dependencies-and-loops)

Workflows often need to repeat steps until certain conditions are met. Mastra provides two powerful methods for creating loops: `until` and `while`. These methods offer an intuitive way to implement repetitive tasks.

### Using Manual Cyclical Dependencies (Legacy Approach) [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#using-manual-cyclical-dependencies-legacy-approach)

In earlier versions, you could create loops by manually defining cyclical dependencies with conditions:

```nextra-code
myWorkflow
  .step(fetchData)
  .then(processData)
  .after(processData)
  .step(finalizeData, {
    when: { "processData.status": "success" },
  })
  .step(fetchData, {
    when: { "processData.status": "retry" },
  });
```

While this approach still works, the newer `until` and `while` methods provide a cleaner and more maintainable way to create loops.

### Using `until` for Condition-Based Loops [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#using-until-for-condition-based-loops)

The `until` method repeats a step until a specified condition becomes true. It takes two arguments:

1. A condition that determines when to stop looping
2. The step to repeat

```nextra-code
workflow
  .step(incrementStep)
  .until(async ({ context }) => {
    // Stop when the value reaches or exceeds 10
    const result = context.getStepResult(incrementStep);
    return (result?.value ?? 0) >= 10;
  }, incrementStep)
  .then(finalStep);
```

You can also use a reference-based condition:

```nextra-code
workflow
  .step(incrementStep)
  .until(
    {
      ref: { step: incrementStep, path: 'value' },
      query: { $gte: 10 },
    },
    incrementStep
  )
  .then(finalStep);
```

### Using `while` for Condition-Based Loops [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#using-while-for-condition-based-loops)

The `while` method repeats a step as long as a specified condition remains true. It takes the same arguments as `until`:

1. A condition that determines when to continue looping
2. The step to repeat

```nextra-code
workflow
  .step(incrementStep)
  .while(async ({ context }) => {
    // Continue as long as the value is less than 10
    const result = context.getStepResult(incrementStep);
    return (result?.value ?? 0) < 10;
  }, incrementStep)
  .then(finalStep);
```

You can also use a reference-based condition:

```nextra-code
workflow
  .step(incrementStep)
  .while(
    {
      ref: { step: incrementStep, path: 'value' },
      query: { $lt: 10 },
    },
    incrementStep
  )
  .then(finalStep);
```

### Comparison Operators for Reference Conditions [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#comparison-operators-for-reference-conditions)

When using reference-based conditions, you can use these comparison operators:

| Operator | Description |
| --- | --- |
| `$eq` | Equal to |
| `$ne` | Not equal to |
| `$gt` | Greater than |
| `$gte` | Greater than or equal to |
| `$lt` | Less than |
| `$lte` | Less than or equal to |

See the [Loop Control](https://mastra.ai/examples/workflows/loop-control) example for more details.

## Conditions [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#conditions)

Use the when property to control whether a step runs based on data from previous steps. Below are three ways to specify conditions.

### Option 1: Function [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#option-1-function)

```nextra-code
myWorkflow.step(
  new Step({
    id: "processData",
    execute: async ({ context }) => {
      // Action logic
    },
  }),
  {
    when: async ({ context }) => {
      const fetchData = context?.getStepResult<{ status: string }>("fetchData");
      return fetchData?.status === "success";
    },
  },
);
```

### Option 2: Query Object [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#option-2-query-object)

```nextra-code
myWorkflow.step(
  new Step({
    id: "processData",
    execute: async ({ context }) => {
      // Action logic
    },
  }),
  {
    when: {
      ref: {
        step: {
          id: "fetchData",
        },
        path: "status",
      },
      query: { $eq: "success" },
    },
  },
);
```

### Option 3: Simple Path Comparison [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#option-3-simple-path-comparison)

```nextra-code
myWorkflow.step(
  new Step({
    id: "processData",
    execute: async ({ context }) => {
      // Action logic
    },
  }),
  {
    when: {
      "fetchData.status": "success",
    },
  },
);
```

## Accessing Previous Step Results [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#accessing-previous-step-results)

Steps access data from previous steps through the `context` object. The context contains a record of all step results and their payloads.

### Using getStepResult [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#using-getstepresult)

`getStepResult` retrieves a step’s output with type safety:

```nextra-code [counter-reset:line]
workflow.step(
  new Step({
    id: "processOrder",
    execute: async ({ context }) => {
      const userData = context.getStepResult<{ userId: string }>("fetchUser");
      return {
        userId: userData?.userId,
        status: "processing"
      };
    },
  })
);
```

### Using Path Notation [Permalink for this section](https://mastra.ai/docs/workflows/control-flow\#using-path-notation)

Path notation accesses step results through the machine context. For example, to access the status of the `processOrder` step:

```nextra-code [counter-reset:line]
workflow.step(
  new Step({
    id: "sendEmail",
    execute: async ({ context }) => {
      const orderStatus = context.steps.processOrder.output.status;
      console.log(orderStatus);
    },
  })
);
```

The context object maintains type information when used with TypeScript. Nested objects in step outputs can be accessed with either method.

Last updated on March 11, 2025

[Steps](https://mastra.ai/docs/workflows/steps "Steps") [Data Flow](https://mastra.ai/docs/workflows/data-flow "Data Flow")

## Start Workflow Execution
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").start()

# start()

The start function begins execution of a workflow run. It processes all steps in the defined workflow order, handling parallel execution, branching logic, and step dependencies.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/start\#usage)

```nextra-code [counter-reset:line]
const { runId, start } = workflow.createRun();
const result = await start({
  triggerData: { inputValue: 42 }
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/start\#parameters)

### config?:

object

Configuration for starting the workflow run

### config [Permalink for this section](https://mastra.ai/docs/reference/workflows/start\#config)

### triggerData:

Record<string, any>

Initial data that matches the workflow's triggerSchema

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/start\#returns)

### results:

Record<string, any>

Combined output from all completed workflow steps

### status:

'completed' \| 'error' \| 'suspended'

Final status of the workflow run

## Error Handling [Permalink for this section](https://mastra.ai/docs/reference/workflows/start\#error-handling)

The start function may throw several types of validation errors:

```nextra-code [counter-reset:line]
try {
  const result = await start({ triggerData: data });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.type); // 'circular_dependency' | 'no_terminal_path' | 'unreachable_step'
    console.log(error.details);
  }
}
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/start\#related)

- [Example: Creating a Workflow](https://mastra.ai/examples/workflows/creating-a-workflow)
- [Example: Suspend and Resume](https://mastra.ai/examples/workflows/suspend-and-resume)
- [createRun Reference](https://mastra.ai/docs/reference/workflows/createRun)
- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)
- [Step Class Reference](https://mastra.ai/docs/reference/workflows/step-class)

```nextra-code

```

Last updated on March 11, 2025

[.createRun()](https://mastra.ai/docs/reference/workflows/createRun ".createRun()") [.execute()](https://mastra.ai/docs/reference/workflows/execute ".execute()")

## Vercel Deployer
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Deployer](https://mastra.ai/docs/reference/deployer/deployer "Deployer") Vercel

# VercelDeployer

The VercelDeployer deploys Mastra applications to Vercel, handling configuration, environment variable synchronization, and deployment processes. It extends the abstract Deployer class to provide Vercel-specific deployment functionality.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/deployer/vercel\#usage-example)

```nextra-code
import { Mastra } from '@mastra/core';
import { VercelDeployer } from '@mastra/deployer-vercel';

const mastra = new Mastra({
  deployer: new VercelDeployer({
    teamId: 'your-team-id',
    projectName: 'your-project-name',
    token: 'your-vercel-token'
  }),
  // ... other Mastra configuration options
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/vercel\#parameters)

### Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/vercel\#constructor-parameters)

### teamId:

string

Your Vercel team ID.

### projectName:

string

Name of your Vercel project (will be created if it doesn't exist).

### token:

string

Your Vercel authentication token.

### Vercel Configuration [Permalink for this section](https://mastra.ai/docs/reference/deployer/vercel\#vercel-configuration)

The VercelDeployer automatically generates a `vercel.json` configuration file with the following settings:

```nextra-code
{
  "version": 2,
  "installCommand": "npm install --omit=dev",
  "builds": [\
    {\
      "src": "index.mjs",\
      "use": "@vercel/node",\
      "config": {\
        "includeFiles": ["**"]\
      }\
    }\
  ],
  "routes": [\
    {\
      "src": "/(.*)",\
      "dest": "index.mjs"\
    }\
  ]
}
```

### Environment Variables [Permalink for this section](https://mastra.ai/docs/reference/deployer/vercel\#environment-variables)

The VercelDeployer handles environment variables from multiple sources:

1. **Environment Files**: Variables from `.env.production` and `.env` files.
2. **Configuration**: Variables passed through the Mastra configuration.
3. **Vercel Dashboard**: Variables can also be managed through Vercel’s web interface.

The deployer automatically synchronizes environment variables between your local development environment and Vercel’s environment variable system, ensuring consistency across all deployment environments (production, preview, and development).

### Project Structure [Permalink for this section](https://mastra.ai/docs/reference/deployer/vercel\#project-structure)

The deployer creates the following structure in your output directory:

```nextra-code
output-directory/
├── vercel.json     # Deployment configuration
└── index.mjs       # Application entry point with Hono server integration
```

Last updated on March 11, 2025

[Netlify](https://mastra.ai/docs/reference/deployer/netlify "Netlify")

## Vector Database Management
[Docs](https://mastra.ai/docs "Docs") [RAG](https://mastra.ai/docs/rag/overview "RAG") Vector Databases

## Storing Embeddings in A Vector Database [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#storing-embeddings-in-a-vector-database)

After generating embeddings, you need to store them in a database that supports vector similarity search. Mastra provides a consistent interface for storing and querying embeddings across different vector databases.

## Supported databases [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#supported-databases)

### PostgreSQL with PgVector [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#postgresql-with-pgvector)

Best for teams already using PostgreSQL who want to minimize infrastructure complexity:

Pg VectorPineconeQdrantChromaAstraLibSQLUpstashCloudflare

vector-store.ts

```nextra-code [counter-reset:line]
import { PgVector } from '@mastra/pg';

const store = new PgVector(process.env.POSTGRES_CONNECTION_STRING)
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});

```

vector-store.ts

```nextra-code [counter-reset:line]
import { PineconeVector } from '@mastra/pinecone'

const store = new PineconeVector(process.env.PINECONE_API_KEY)
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

vector-store.ts

```nextra-code [counter-reset:line]
import { QdrantVector } from '@mastra/qdrant'

const store = new QdrantVector({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
})
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

vector-store.ts

```nextra-code [counter-reset:line]
import { ChromaVector } from '@mastra/chroma'

const store = new ChromaVector()
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

vector-store.ts

```nextra-code [counter-reset:line]
import { AstraVector } from '@mastra/astra'

const store = new AstraVector({
  token: process.env.ASTRA_DB_TOKEN,
  endpoint: process.env.ASTRA_DB_ENDPOINT,
  keyspace: process.env.ASTRA_DB_KEYSPACE
})
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

vector-store.ts

```nextra-code [counter-reset:line]
import { LibSQLVector } from "@mastra/core/vector/libsql";

const store = new LibSQLVector({
  connectionUrl: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN // Optional: for Turso cloud databases
})
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

vector-store.ts

```nextra-code [counter-reset:line]
import { UpstashVector } from '@mastra/upstash'

const store = new UpstashVector({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_TOKEN
})
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

vector-store.ts

```nextra-code [counter-reset:line]
import { CloudflareVector } from '@mastra/vectorize'

const store = new CloudflareVector({
  accountId: process.env.CF_ACCOUNT_ID,
  apiToken: process.env.CF_API_TOKEN
})
await store.createIndex({
  indexName: "my-collection",
  dimension: 1536,
});
await store.upsert({
  indexName: "my-collection",
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
});
```

## Using Vector Storage [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#using-vector-storage)

Once initialized, all vector stores share the same interface for creating indexes, upserting embeddings, and querying.

### Creating Indexes [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#creating-indexes)

Before storing embeddings, you need to create an index with the appropriate dimension size for your embedding model:

store-embeddings.ts

```nextra-code [counter-reset:line]
// Create an index with dimension 1536 (for text-embedding-3-small)
await store.createIndex({
  indexName: 'my-collection',
  dimension: 1536,
});

// For other models, use their corresponding dimensions:
// - text-embedding-3-large: 3072
// - text-embedding-ada-002: 1536
// - cohere-embed-multilingual-v3: 1024
```

The dimension size must match the output dimension of your chosen embedding model. Common dimension sizes are:

- OpenAI text-embedding-3-small: 1536 dimensions
- OpenAI text-embedding-3-large: 3072 dimensions
- Cohere embed-multilingual-v3: 1024 dimensions

### Upserting Embeddings [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#upserting-embeddings)

After creating an index, you can store embeddings along with their basic metadata:

store-embeddings.ts

```nextra-code [counter-reset:line]
// Store embeddings with their corresponding metadata
await store.upsert({
  indexName: 'my-collection',  // index name
  vectors: embeddings,       // array of embedding vectors
  metadata: chunks.map(chunk => ({
    text: chunk.text,  // The original text content
    id: chunk.id       // Optional unique identifier
  }))
});
```

The upsert operation:

- Takes an array of embedding vectors and their corresponding metadata
- Updates existing vectors if they share the same ID
- Creates new vectors if they don’t exist
- Automatically handles batching for large datasets

## Adding Metadata [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#adding-metadata)

Vector stores support rich metadata for advanced filtering and organization. You can add any JSON-serializable fields that will help with retrieval.

**Reminder:** Metadata is stored as a JSON field with no fixed schema, so you’ll want to name your fields consistently and apply a consistent schema, or your queries will return unexpected results.

```nextra-code [counter-reset:line]
// Store embeddings with rich metadata for better organization and filtering
await vectorStore.upsert({
  indexName: "embeddings",
  vectors: embeddings,
  metadata: chunks.map((chunk) => ({
    // Basic content
    text: chunk.text,
    id: chunk.id,

    // Document organization
    source: chunk.source,
    category: chunk.category,

    // Temporal metadata
    createdAt: new Date().toISOString(),
    version: "1.0",

    // Custom fields
    language: chunk.language,
    author: chunk.author,
    confidenceScore: chunk.score,
  })),
});
```

Key metadata considerations:

- Be strict with field naming - inconsistencies like ‘category’ vs ‘Category’ will affect queries
- Only include fields you plan to filter or sort by - extra fields add overhead
- Add timestamps (e.g., ‘createdAt’, ‘lastUpdated’) to track content freshness

## Best Practices [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#best-practices)

- Create indexes before bulk insertions
- Use batch operations for large insertions (the upsert method handles batching automatically)
- Only store metadata you’ll query against
- Match embedding dimensions to your model (e.g., 1536 for `text-embedding-3-small`)

## Examples [Permalink for this section](https://mastra.ai/docs/rag/vector-databases\#examples)

For complete examples of different vector store implementations, see:

- [Insert Embedding in PgVector](https://mastra.ai/examples/rag/insert-embedding-in-pgvector)
- [Insert Embedding in Pinecone](https://mastra.ai/examples/rag/insert-embedding-in-pinecone)
- [Insert Embedding in Qdrant](https://mastra.ai/examples/rag/insert-embedding-in-qdrant)
- [Insert Embedding in Chroma](https://mastra.ai/examples/rag/insert-embedding-in-chroma)
- [Insert Embedding in Astra DB](https://mastra.ai/examples/rag/insert-embedding-in-astra)
- [Insert Embedding in LibSQL](https://mastra.ai/examples/rag/insert-embedding-in-libsql)
- [Insert Embedding in Upstash](https://mastra.ai/examples/rag/insert-embedding-in-upstash)
- [Insert Embedding in Cloudflare Vectorize](https://mastra.ai/examples/rag/insert-embedding-in-vectorize)
- [Basic RAG with Vector Storage](https://mastra.ai/examples/rag/basic-rag)

Last updated on March 11, 2025

[Chunking and Embedding](https://mastra.ai/docs/rag/chunking-and-embedding "Chunking and Embedding") [Retrieval](https://mastra.ai/docs/rag/retrieval "Retrieval")

## Text Embedding Functions
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [RAG](https://mastra.ai/docs/reference/rag/chunk "RAG").embed()

# Embed

Mastra uses the AI SDK’s `embed` and `embedMany` functions to generate vector embeddings for text inputs, enabling similarity search and RAG workflows.

## Single Embedding [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#single-embedding)

The `embed` function generates a vector embedding for a single text input:

```nextra-code
import { embed } from 'ai';

const result = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: "Your text to embed",
  maxRetries: 2  // optional, defaults to 2
});
```

### Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#parameters)

### model:

EmbeddingModel

The embedding model to use (e.g. openai.embedding('text-embedding-3-small'))

### value:

string \| Record<string, any>

The text content or object to embed

### maxRetries?:

number

= 2

Maximum number of retries per embedding call. Set to 0 to disable retries.

### abortSignal?:

AbortSignal

Optional abort signal to cancel the request

### headers?:

Record<string, string>

Additional HTTP headers for the request (only for HTTP-based providers)

### Return Value [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#return-value)

### embedding:

number\[\]

The embedding vector for the input

## Multiple Embeddings [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#multiple-embeddings)

For embedding multiple texts at once, use the `embedMany` function:

```nextra-code
import { embedMany } from 'ai';

const result = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: ["First text", "Second text", "Third text"],
  maxRetries: 2  // optional, defaults to 2
});
```

### Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#parameters-1)

### model:

EmbeddingModel

The embedding model to use (e.g. openai.embedding('text-embedding-3-small'))

### values:

string\[\] \| Record<string, any>\[\]

Array of text content or objects to embed

### maxRetries?:

number

= 2

Maximum number of retries per embedding call. Set to 0 to disable retries.

### abortSignal?:

AbortSignal

Optional abort signal to cancel the request

### headers?:

Record<string, string>

Additional HTTP headers for the request (only for HTTP-based providers)

### Return Value [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#return-value-1)

### embeddings:

number\[\]\[\]

Array of embedding vectors corresponding to the input values

## Example Usage [Permalink for this section](https://mastra.ai/docs/reference/rag/embeddings\#example-usage)

```nextra-code
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

// Single embedding
const singleResult = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: "What is the meaning of life?",
});

// Multiple embeddings
const multipleResult = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: [\
    "First question about life",\
    "Second question about universe",\
    "Third question about everything"\
  ],
});
```

For more detailed information about embeddings in the Vercel AI SDK, see:

- [AI SDK Embeddings Overview](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings)
- [embed()](https://sdk.vercel.ai/docs/reference/ai-sdk-core/embed)
- [embedMany()](https://sdk.vercel.ai/docs/reference/ai-sdk-core/embed-many)

Last updated on March 11, 2025

[.chunk()](https://mastra.ai/docs/reference/rag/chunk ".chunk()") [ExtractParams](https://mastra.ai/docs/reference/rag/extract-params "ExtractParams")

## Netlify Deployer
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Deployer](https://mastra.ai/docs/reference/deployer/deployer "Deployer") Netlify

# NetlifyDeployer

The NetlifyDeployer deploys Mastra applications to Netlify Functions, handling site creation, configuration, and deployment processes. It extends the abstract Deployer class to provide Netlify-specific deployment functionality.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/deployer/netlify\#usage-example)

```nextra-code
import { Mastra } from '@mastra/core';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

const mastra = new Mastra({
  deployer: new NetlifyDeployer({
    scope: 'your-team-slug',
    projectName: 'your-project-name',
    token: 'your-netlify-token'
  }),
  // ... other Mastra configuration options
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/netlify\#parameters)

### Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/deployer/netlify\#constructor-parameters)

### scope:

string

Your Netlify team slug or ID.

### projectName:

string

Name of your Netlify site (will be created if it doesn't exist).

### token:

string

Your Netlify authentication token.

### Netlify Configuration [Permalink for this section](https://mastra.ai/docs/reference/deployer/netlify\#netlify-configuration)

The NetlifyDeployer automatically generates a `netlify.toml` configuration file with the following settings:

```nextra-code
[functions]
node_bundler = "esbuild"
directory = "netlify/functions"

[[redirects]]
force = true
from = "/*"
status = 200
to = "/.netlify/functions/api/:splat"
```

### Environment Variables [Permalink for this section](https://mastra.ai/docs/reference/deployer/netlify\#environment-variables)

The NetlifyDeployer handles environment variables from multiple sources:

1. **Environment Files**: Variables from `.env.production` and `.env` files.
2. **Configuration**: Variables passed through the Mastra configuration.
3. **Netlify Dashboard**: Variables can also be managed through Netlify’s web interface.

### Project Structure [Permalink for this section](https://mastra.ai/docs/reference/deployer/netlify\#project-structure)

The deployer creates the following structure in your output directory:

```nextra-code
output-directory/
├── netlify/
│   └── functions/
│       └── api/
│           └── index.mjs    # Application entry point with Hono server integration
└── netlify.toml             # Deployment configuration
```

Last updated on March 11, 2025

[Cloudflare](https://mastra.ai/docs/reference/deployer/cloudflare "Cloudflare") [Vercel](https://mastra.ai/docs/reference/deployer/vercel "Vercel")

## Workflow.else() Method
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows") Reference: Workflow.else() \| Conditional Branching \| Mastra Docs

# Workflow.else()

> Experimental

The `.else()` method creates an alternative branch in the workflow that executes when the preceding `if` condition evaluates to false. This enables workflows to follow different paths based on conditions.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/else\#usage)

```nextra-code [counter-reset:line]
workflow
  .step(startStep)
  .if(async ({ context }) => {
    const value = context.getStepResult<{ value: number }>('start')?.value;
    return value < 10;
  })
  .then(ifBranchStep)
  .else() // Alternative branch when the condition is false
  .then(elseBranchStep)
  .commit();
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/else\#parameters)

The `else()` method does not take any parameters.

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/else\#returns)

### workflow:

Workflow

The workflow instance for method chaining

## Behavior [Permalink for this section](https://mastra.ai/docs/reference/workflows/else\#behavior)

- The `else()` method must follow an `if()` branch in the workflow definition
- It creates a branch that executes only when the preceding `if` condition evaluates to false
- You can chain multiple steps after an `else()` using `.then()`
- You can nest additional `if`/ `else` conditions within an `else` branch

## Error Handling [Permalink for this section](https://mastra.ai/docs/reference/workflows/else\#error-handling)

The `else()` method requires a preceding `if()` statement. If you try to use it without a preceding `if`, an error will be thrown:

```nextra-code
try {
  // This will throw an error
  workflow
    .step(someStep)
    .else()
    .then(anotherStep)
    .commit();
} catch (error) {
  console.error(error); // "No active condition found"
}
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/else\#related)

- [if Reference](https://mastra.ai/docs/reference/workflows/if)
- [then Reference](https://mastra.ai/docs/reference/workflows/then)
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow)
- [Step Condition Reference](https://mastra.ai/docs/reference/workflows/step-condition)

Last updated on March 11, 2025

[.watch()](https://mastra.ai/docs/reference/workflows/watch ".watch()") [Reference: Workflow.if() \| Conditional Branching \| Mastra Docs](https://mastra.ai/docs/reference/workflows/if "Reference: Workflow.if() | Conditional Branching | Mastra Docs")

## Development Server Setup
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [CLI](https://mastra.ai/docs/reference/cli/init "CLI") mastra dev

# `mastra dev` Reference

The `mastra dev` command starts a development server that exposes REST endpoints for your agents, tools, and workflows,

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#parameters)

### --dir?:

string

Specifies the path to your Mastra folder (containing agents, tools, and workflows). Defaults to the current working directory.

### --tools?:

string

Comma-separated paths to additional tool directories that should be registered. For example: 'src/tools/dbTools,src/tools/scraperTools'.

### --port?:

number

Specifies the port number for the development server. Defaults to 4111.

## Routes [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#routes)

Starting the server with `mastra dev` exposes a set of REST endpoints by default:

### Agent Routes [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#agent-routes)

Agents are expected to be exported from `src/mastra/agents`.

• `GET /api/agents`

- Lists the registered agents found in your Mastra folder.
• `POST /api/agents/:agentId/generate`
- Sends a text-based prompt to the specified agent, returning the agent’s response.

### Tool Routes [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#tool-routes)

Tools are expected to be exported from `src/mastra/tools` (or the configured tools directory).

• `POST /api/tools/:toolName`

- Invokes a specific tool by name, passing input data in the request body.

### Workflow Routes [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#workflow-routes)

Workflows are expected to be exported from `src/mastra/workflows` (or the configured workflows directory).

• `POST /api/workflows/:workflowName/start`

- Starts the specified workflow.
• `POST /api/workflows/:workflowName/:instanceId/event`
- Sends an event or trigger signal to an existing workflow instance.
• `GET /api/workflows/:workflowName/:instanceId/status`
- Returns status info for a running workflow instance.

### OpenAPI Specification [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#openapi-specification)

• `GET /openapi.json`

- Returns an auto-generated OpenAPI specification for your project’s endpoints.

## Additional Notes [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#additional-notes)

The port defaults to 4111.

Make sure you have your environment variables set up in your `.env.development` or `.env` file for any providers you use (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

### Example request [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#example-request)

To test an agent after running `mastra dev`:

```nextra-code
curl -X POST http://localhost:4111/api/agents/myAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      { "role": "user", "content": "Hello, how can you assist me today?" }\
    ]
  }'
```

## Related Docs [Permalink for this section](https://mastra.ai/docs/reference/cli/dev\#related-docs)

- [REST Endpoints Overview](https://mastra.ai/docs/local-dev/mastra-dev) – More detailed usage of the dev server and agent endpoints.
- [mastra deploy](https://mastra.ai/docs/deployment/deployment) – Deploy your project to Vercel or Cloudflare.

Last updated on March 11, 2025

[mastra init](https://mastra.ai/docs/reference/cli/init "mastra init") [mastra deploy](https://mastra.ai/docs/reference/cli/deploy "mastra deploy")

## Mastra Workflows Overview
[Docs](https://mastra.ai/docs "Docs") WorkflowsOverview

# Handling Complex LLM Operations with Workflows

Workflows in Mastra help you orchestrate complex sequences of operations with features like branching, parallel execution, resource suspension, and more.

## When to use workflows [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#when-to-use-workflows)

Most AI applications need more than a single call to a language model. You may want to run multiple steps, conditionally skip certain paths, or even pause execution altogether until you receive user input. Sometimes your agent tool calling is not accurate enough.

Mastra’s workflow system provides:

- A standardized way to define steps and link them together.
- Support for both simple (linear) and advanced (branching, parallel) paths.
- Debugging and observability features to track each workflow run.

## Example [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#example)

To create a workflow, you define one or more steps, link them, and then commit the workflow before starting it.

### Breaking Down the Workflow [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#breaking-down-the-workflow)

Let’s examine each part of the workflow creation process:

#### 1\. Creating the Workflow [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#1-creating-the-workflow)

Here’s how you define a workflow in Mastra. The `name` field determines the workflow’s API endpoint ( `/workflows/$NAME/`), while the `triggerSchema` defines the structure of the workflow’s trigger data:

src/mastra/workflow/index.ts

```nextra-code
const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});
```

#### 2\. Defining Steps [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#2-defining-steps)

Now, we’ll define the workflow’s steps. Each step can have its own input and output schemas. Here, `stepOne` doubles an input value, and `stepTwo` increments that result if `stepOne` was successful. (To keep things simple, we aren’t making any LLM calls in this example):

src/mastra/workflow/index.ts

```nextra-code
const stepOne = new Step({
  id: 'stepOne',
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const doubledValue = context.triggerData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = new Step({
  id: "stepTwo",
  execute: async ({ context }) => {
    if (context.steps.stepOne.status !== "success") {
      return { incrementedValue: 0 };
    }
    return {
      incrementedValue: context.steps.stepOne.output.doubledValue + 1,
    };
  },
});
```

#### 3\. Linking Steps [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#3-linking-steps)

Now, let’s create the control flow, and “commit” (finalize the workflow). In this case, `stepOne` runs first and is followed by `stepTwo`.

src/mastra/workflow/index.ts

```nextra-code
myWorkflow
  .step(stepOne)
  .then(stepTwo)
  .commit();
```

### Register the Workflow [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#register-the-workflow)

Register your workflow with Mastra to enable logging and telemetry:

src/mastra/index.ts

```nextra-code [counter-reset:line]
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  workflows: { myWorkflow },
});
```

### Executing the Workflow [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#executing-the-workflow)

Execute your workflow programmatically or via API:

src/mastra/run-workflow.ts

```nextra-code [counter-reset:line]
import { mastra } from "./index";

// Get the workflow
const myWorkflow = mastra.getWorkflow('myWorkflow');
const { runId, start } = myWorkflow.createRun();

// Start the workflow execution
await start({ triggerData: { inputValue: 45 } });
```

Or use the API (requires running `mastra dev`):

```nextra-code
curl --location 'http://localhost:4111/api/workflows/myWorkflow/execute' \
     --header 'Content-Type: application/json' \
     --data '{
       "inputValue": 45
     }'
```

This example shows the essentials: define your workflow, add steps, commit the workflow, then execute it.

## Defining Steps [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#defining-steps)

The basic building block of a workflow [is a step](https://mastra.ai/docs/workflows/steps). Steps are defined using schemas for inputs and outputs, and can fetch prior step results.

## Control Flow [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#control-flow)

Workflows let you define a [control flow](https://mastra.ai/docs/workflows/control-flow) to chain steps together in with parallel steps, branching paths, and more.

## Workflow Variables [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#workflow-variables)

When you need to map data between steps or create dynamic data flows, [workflow variables](https://mastra.ai/docs/workflows/variables) provide a powerful mechanism for passing information from one step to another and accessing nested properties within step outputs.

## Suspend and Resume [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#suspend-and-resume)

When you need to pause execution for external data, user input, or asynchronous events, Mastra [supports suspension at any step](https://mastra.ai/docs/workflows/suspend-and-resume), persisting the state of the workflow so you can resume it later.

## Observability and Debugging [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#observability-and-debugging)

Mastra workflows automatically [log the input and output of each step within a workflow run](https://mastra.ai/docs/reference/observability/otel-config), allowing you to send this data to your preferred logging, telemetry, or observability tools.

You can:

- Track the status of each step (e.g., `success`, `error`, or `suspended`).
- Store run-specific metadata for analysis.
- Integrate with third-party observability platforms like Datadog or New Relic by forwarding logs.

## More Resources [Permalink for this section](https://mastra.ai/docs/workflows/00-overview\#more-resources)

- The [Workflow Guide](https://mastra.ai/docs/guides/04-recruiter) in the Guides section is a tutorial that covers the main concepts.
- [Sequential Steps workflow example](https://mastra.ai/examples/workflows/sequential-steps)
- [Parallel Steps workflow example](https://mastra.ai/examples/workflows/parallel-steps)
- [Branching Paths workflow example](https://mastra.ai/examples/workflows/branching-paths)
- [Workflow Variables example](https://mastra.ai/examples/workflows/workflow-variables)
- [Cyclical Dependencies workflow example](https://mastra.ai/examples/workflows/cyclical-dependencies)
- [Suspend and Resume workflow example](https://mastra.ai/examples/workflows/suspend-and-resume)

Last updated on March 11, 2025

[Voice](https://mastra.ai/docs/agents/03-adding-voice "Voice") [Steps](https://mastra.ai/docs/workflows/steps "Steps")

## Agent Evaluation Tests
[Docs](https://mastra.ai/docs "Docs") EvalsOverview

# Testing your agents with evals

Evals are automated tests that evaluate Agents outputs using model-graded, rule-based, and statistical methods. Each eval returns a normalized score between 0-1 that can be logged and compared. Evals can be customized with your own prompts and scoring functions.

Evals can be run in the cloud, capturing real-time results. But evals can also be part of your CI/CD pipeline, allowing you to test and monitor your agents over time.

## How to use evals [Permalink for this section](https://mastra.ai/docs/evals/00-overview\#how-to-use-evals)

Evals need to be added to an agent. To use any of [the default metrics](https://mastra.ai/docs/evals/01-supported-evals), you can do the following:

src/mastra/agents/index.ts

```nextra-code [counter-reset:line]
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { ToneConsistencyMetric } from "@mastra/evals/nlp";

export const myAgent = new Agent({
  name: "My Agent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
  evals: {
    tone: new ToneConsistencyMetric()
  },
});
```

You can now view the evals in the Mastra dashboard, when using `mastra dev`.

### Executing evals in your CI/CD pipeline [Permalink for this section](https://mastra.ai/docs/evals/00-overview\#executing-evals-in-your-cicd-pipeline)

We support any testing framework that supports ESM modules. For example, you can use [Vitest](https://vitest.dev/), [Jest](https://jestjs.io/) or [Mocha](https://mochajs.org/) to run evals in your CI/CD pipeline.

src/mastra/agents/index.test.ts

```nextra-code [counter-reset:line]
import { describe, it, expect } from 'vitest';
import { evaluate } from '@mastra/core/eval';
import { myAgent } from './index';

describe('My Agent', () => {
  it('should be able to validate tone consistency', async () => {
    const metric = new ToneConsistencyMetric();
    const result = await evaluate(myAgent, 'Hello, world!', metric)

    expect(result.score).toBe(1);
  });
});

```

You will need to configure a testSetup and globalSetup script for your testing framework to capture the eval results. It allows us to show these results in your mastra dashboard.

#### Vitest [Permalink for this section](https://mastra.ai/docs/evals/00-overview\#vitest)

These are the files you need to add to your project to run evals in your CI/CD pipeline and allow us to capture the results.
Without these files, the evals will still run and fail when necessary but you won’t be able to see the results in the Mastra dashboard.

globalSetup.ts

```nextra-code [counter-reset:line]
import { globalSetup } from '@mastra/evals';

export default function setup() {
  globalSetup()
}
```

testSetup.ts

```nextra-code [counter-reset:line]
import { beforeAll } from 'vitest';
import { attachListeners } from '@mastra/evals';

beforeAll(async () => {
  await attachListeners();
});
```

Store evals in Mastra Storage

Pass your Mastra instance to store evals in the configured storage:

```nextra-code
import { mastra } from './your-mastra-setup';

beforeAll(async () => {
  // Store evals in Mastra Storage (requires storage to be enabled)
  await attachListeners(mastra);
});
```

This allows you to save evals in Mastra Storage.
With file storage, evals persist and can be queried later.
With memory storage, evals are isolated to the test process.

vitest.config.ts

```nextra-code [counter-reset:line]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './globalSetup.ts',
    setupFiles: ['./testSetup.ts'],
  },
})
```

Last updated on March 11, 2025

[Deployment](https://mastra.ai/docs/deployment/deployment "Deployment") [Supported Evals](https://mastra.ai/docs/evals/01-supported-evals "Supported Evals")

## Workflow Commit Method
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").commit()

# Workflow.commit()

The `.commit()` method re-initializes the workflow’s state machine with the current step configuration.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/commit\#usage)

```nextra-code
workflow
  .step(stepA)
  .then(stepB)
  .commit();
```

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/commit\#returns)

### workflow:

Workflow

The workflow instance

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/commit\#related)

- [Branching Paths example](https://mastra.ai/examples/workflows/branching-paths)
- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)
- [Step Reference](https://mastra.ai/docs/reference/workflows/step-class)
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow)

```nextra-code

```

Last updated on March 11, 2025

[.resume()](https://mastra.ai/docs/reference/workflows/resume ".resume()") [.watch()](https://mastra.ai/docs/reference/workflows/watch ".watch()")

## Agent Streaming Method
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Agents](https://mastra.ai/docs/reference/agents/getAgent "Agents") stream()

# `stream()`

The `stream()` method enables real-time streaming of responses from an agent. This method accepts `messages` and an optional `options` object as parameters, similar to `generate()`.

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#parameters)

### `messages` [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#messages)

The `messages` parameter can be:

- A single string
- An array of strings
- An array of message objects with `role` and `content` properties

The message object structure:

```nextra-code
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### `options` (Optional) [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#options-optional)

An optional object that can include configuration for output structure, memory management, tool usage, telemetry, and more.

### output?:

Zod schema \| JsonSchema7

Defines the expected structure of the output. Can be a JSON Schema object or a Zod schema.

### experimental\_output?:

Zod schema \| JsonSchema7

Enables structured output generation alongside text generation and tool calls. The model will generate responses that conform to the provided schema.

### context?:

CoreMessage\[\]

Additional context messages to provide to the agent.

### memoryOptions?:

MemoryConfig

Configuration options for memory management. See MemoryConfig section below for details.

### toolChoice?:

'auto' \| 'none' \| 'required' \| { type: 'tool'; toolName: string }

= 'auto'

Controls how the agent uses tools during streaming.

### telemetry?:

TelemetrySettings

Settings for telemetry collection during streaming. See TelemetrySettings section below for details.

### threadId?:

string

Identifier for the conversation thread. Allows for maintaining context across multiple interactions. Must be provided if resourceId is provided.

### resourceId?:

string

Identifier for the user or resource interacting with the agent. Must be provided if threadId is provided.

### onFinish?:

(result: string) => Promise<void> \| void

Callback function called when streaming is complete.

### onStepFinish?:

(step: string) => void

Callback function called after each step during streaming.

### maxSteps?:

number

= 5

Maximum number of steps allowed during streaming.

### toolsets?:

ToolsetsInput

Additional toolsets to make available to the agent during this stream.

### temperature?:

number

Controls randomness in the model's output. Higher values (e.g., 0.8) make the output more random, lower values (e.g., 0.2) make it more focused and deterministic.

#### MemoryConfig [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#memoryconfig)

Configuration options for memory management:

### lastMessages?:

number \| false

Number of most recent messages to include in context. Set to false to disable.

### semanticRecall?:

boolean \| object

Configuration for semantic memory recall. Can be boolean or detailed config.

number

### topK?:

number

Number of most semantically similar messages to retrieve.

number \| object

### messageRange?:

number \| { before: number; after: number }

Range of messages to consider for semantic search. Can be a single number or before/after configuration.

### workingMemory?:

object

Configuration for working memory.

boolean

### enabled?:

boolean

Whether to enable working memory.

string

### template?:

string

Template to use for working memory.

'text-stream' \| 'tool-call'

### type?:

'text-stream' \| 'tool-call'

Type of content to use for working memory.

### threads?:

object

Thread-specific memory configuration.

boolean

### generateTitle?:

boolean

Whether to automatically generate titles for new threads.

#### TelemetrySettings [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#telemetrysettings)

Settings for telemetry collection during streaming:

### isEnabled?:

boolean

= false

Enable or disable telemetry. Disabled by default while experimental.

### recordInputs?:

boolean

= true

Enable or disable input recording. You might want to disable this to avoid recording sensitive information, reduce data transfers, or increase performance.

### recordOutputs?:

boolean

= true

Enable or disable output recording. You might want to disable this to avoid recording sensitive information, reduce data transfers, or increase performance.

### functionId?:

string

Identifier for this function. Used to group telemetry data by function.

### metadata?:

Record<string, AttributeValue>

Additional information to include in the telemetry data. AttributeValue can be string, number, boolean, array of these types, or null.

### tracer?:

Tracer

A custom OpenTelemetry tracer instance to use for the telemetry data. See OpenTelemetry documentation for details.

## Returns [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#returns)

The return value of the `stream()` method depends on the options provided, specifically the `output` option.

### PropertiesTable for Return Values [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#propertiestable-for-return-values)

### textStream?:

AsyncIterable<string>

Stream of text chunks. Present when output is 'text' (no schema provided) or when using \`experimental\_output\`.

### objectStream?:

AsyncIterable<object>

Stream of structured data. Present only when using \`output\` option with a schema.

### partialObjectStream?:

AsyncIterable<object>

Stream of structured data. Present only when using \`experimental\_output\` option.

### object?:

Promise<object>

Promise that resolves to the final structured output. Present when using either \`output\` or \`experimental\_output\` options.

## Examples [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#examples)

### Basic Text Streaming [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#basic-text-streaming)

```nextra-code
const stream = await myAgent.stream([\
  { role: "user", content: "Tell me a story." }\
]);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Structured Output Streaming with Thread Context [Permalink for this section](https://mastra.ai/docs/reference/agents/stream\#structured-output-streaming-with-thread-context)

```nextra-code
const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    nextSteps: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'nextSteps']
};

const response = await myAgent.stream(
  "What should we do next?",
  {
    output: schema,
    threadId: "project-123",
    onFinish: text => console.log("Finished:", text)
  }
);

for await (const chunk of response.textStream) {
  console.log(chunk);
}

const result = await response.object;
console.log("Final structured result:", result);
```

The key difference between Agent’s `stream()` and LLM’s `stream()` is that Agents maintain conversation context through `threadId`, can access tools, and integrate with the agent’s memory system.

Last updated on March 11, 2025

[generate()](https://mastra.ai/docs/reference/agents/generate "generate()") [createDocumentChunkerTool()](https://mastra.ai/docs/reference/tools/document-chunker-tool "createDocumentChunkerTool()")

## MDocument Class
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [RAG](https://mastra.ai/docs/reference/rag/chunk "RAG") MDocument

# MDocument

The MDocument class processes documents for RAG applications. The main methods are `.chunk()` and `.extractMetadata()`.

## Constructor [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#constructor)

### docs:

Array<{ text: string, metadata?: Record<string, any> }>

Array of document chunks with their text content and optional metadata

### type:

'text' \| 'html' \| 'markdown' \| 'json' \| 'latex'

Type of document content

## Static Methods [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#static-methods)

### fromText() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#fromtext)

Creates a document from plain text content.

```nextra-code
static fromText(text: string, metadata?: Record<string, any>): MDocument
```

### fromHTML() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#fromhtml)

Creates a document from HTML content.

```nextra-code
static fromHTML(html: string, metadata?: Record<string, any>): MDocument
```

### fromMarkdown() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#frommarkdown)

Creates a document from Markdown content.

```nextra-code
static fromMarkdown(markdown: string, metadata?: Record<string, any>): MDocument
```

### fromJSON() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#fromjson)

Creates a document from JSON content.

```nextra-code
static fromJSON(json: string, metadata?: Record<string, any>): MDocument
```

## Instance Methods [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#instance-methods)

### chunk() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#chunk)

Splits document into chunks and optionally extracts metadata.

```nextra-code
async chunk(params?: ChunkParams): Promise<Chunk[]>
```

See [chunk() reference](https://mastra.ai/docs/reference/rag/chunk) for detailed options.

### getDocs() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#getdocs)

Returns array of processed document chunks.

```nextra-code
getDocs(): Chunk[]
```

### getText() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#gettext)

Returns array of text strings from chunks.

```nextra-code
getText(): string[]
```

### getMetadata() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#getmetadata)

Returns array of metadata objects from chunks.

```nextra-code
getMetadata(): Record<string, any>[]
```

### extractMetadata() [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#extractmetadata)

Extracts metadata using specified extractors. See [ExtractParams reference](https://mastra.ai/docs/reference/rag/extract-params) for details.

```nextra-code
async extractMetadata(params: ExtractParams): Promise<MDocument>
```

## Examples [Permalink for this section](https://mastra.ai/docs/reference/rag/document\#examples)

```nextra-code
import { MDocument } from '@mastra/rag';

// Create document from text
const doc = MDocument.fromText('Your content here');

// Split into chunks with metadata extraction
const chunks = await doc.chunk({
  strategy: 'markdown',
  headers: [['#', 'title'], ['##', 'section']],
  extract: {
    fields: [\
      { name: 'summary', description: 'A brief summary' },\
      { name: 'keywords', description: 'Key terms' }\
    ]
  }
});

// Get processed chunks
const docs = doc.getDocs();
const texts = doc.getText();
const metadata = doc.getMetadata();
```

Last updated on March 11, 2025

[rerank()](https://mastra.ai/docs/reference/rag/rerank "rerank()") [Metadata Filters](https://mastra.ai/docs/reference/rag/metadata-filters "Metadata Filters")

## Workflow Class Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") WorkflowsWorkflow

# Workflow Class

The Workflow class enables you to create state machines for complex sequences of operations with conditional branching and data validation.

```nextra-code
import { Workflow } from "@mastra/core/workflows";

const workflow = new Workflow({ name: "my-workflow" });
```

## API Reference [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#api-reference)

### Constructor [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#constructor)

### name:

string

Identifier for the workflow

### logger?:

Logger<WorkflowLogMessage>

Optional logger instance for workflow execution details

### steps:

Step\[\]

Array of steps to include in the workflow

### triggerSchema:

z.Schema

Optional schema for validating workflow trigger data

### Core Methods [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#core-methods)

#### `step()` [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#step)

Adds a [Step](https://mastra.ai/docs/reference/workflows/step-class) to the workflow, including transitions to other steps. Returns the workflow instance for chaining. [Learn more about steps](https://mastra.ai/docs/reference/workflows/step-class).

#### `commit()` [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#commit)

Validates and finalizes the workflow configuration. Must be called after adding all steps.

#### `execute()` [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#execute)

Executes the workflow with optional trigger data. Typed based on the [trigger schema](https://mastra.ai/docs/reference/workflows/workflow#trigger-schemas).

## Trigger Schemas [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#trigger-schemas)

Trigger schemas validate the initial data passed to a workflow using Zod.

```nextra-code [counter-reset:line]
const workflow = new Workflow({
  name: "order-process",
  triggerSchema: z.object({
    orderId: z.string(),
    customer: z.object({
      id: z.string(),
      email: z.string().email(),
    }),
  }),
});
```

The schema:

- Validates data passed to `execute()`
- Provides TypeScript types for your workflow input

## Validation [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#validation)

Workflow validation happens at two key times:

### 1\. At Commit Time [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#1-at-commit-time)

When you call `.commit()`, the workflow validates:

```nextra-code [counter-reset:line]
workflow
  .step('step1', {...})
  .step('step2', {...})
  .commit(); // Validates workflow structure
```

- Circular dependencies between steps
- Terminal paths (every path must end)
- Unreachable steps
- Variable references to non-existent steps
- Duplicate step IDs

### 2\. During Execution [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#2-during-execution)

When you call `start()`, it validates:

```nextra-code [counter-reset:line]
const { runId, start } = workflow.createRun();

// Validates trigger data against schema
await start({
  triggerData: {
    orderId: "123",
    customer: {
      id: "cust_123",
      email: "invalid-email", // Will fail validation
    },
  },
});
```

- Trigger data against trigger schema
- Each step’s input data against its inputSchema
- Variable paths exist in referenced step outputs
- Required variables are present

## Workflow Status [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#workflow-status)

A workflow’s status indicates its current execution state. The possible values are:

### CREATED:

string

Workflow instance has been created but not started

### RUNNING:

string

Workflow is actively executing steps

### SUSPENDED:

string

Workflow execution is paused waiting for resume

### COMPLETED:

string

All steps finished executing successfully

### FAILED:

string

Workflow encountered an error during execution

### Example: Handling Different Statuses [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#example-handling-different-statuses)

```nextra-code [counter-reset:line]
const { runId, start } = workflow.createRun();

workflow.watch(runId, async ({ status }) => {
  switch (status) {
    case "SUSPENDED":
      // Handle suspended state
      break;
    case "COMPLETED":
      // Process results
      break;
    case "FAILED":
      // Handle error state
      break;
  }
});

await start({ triggerData: data });
```

## Error Handling [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#error-handling)

```nextra-code [counter-reset:line]
try {
  const { runId, start } = workflow.createRun();
  await start({ triggerData: data });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    console.log(error.type); // 'circular_dependency' | 'no_terminal_path' | 'unreachable_step'
    console.log(error.details); // { stepId?: string, path?: string[] }
  }
}
```

## Passing Context Between Steps [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#passing-context-between-steps)

Steps can access data from previous steps in the workflow through the context object. Each step receives the accumulated context from all previous steps that have executed.

```nextra-code [counter-reset:line]
workflow
  .step({
    id: 'getData',
    execute: async ({ context }) => {
      return {
        data: { id: '123', value: 'example' }
      };
    }
  })
  .step({
    id: 'processData',
    execute: async ({ context }) => {
      // Access data from previous step through context.steps
      const previousData = context.steps.getData.output.data;
      // Process previousData.id and previousData.value
    }
  });
```

The context object:

- Contains results from all completed steps in `context.steps`
- Provides access to step outputs through `context.steps.[stepId].output`
- Is typed based on step output schemas
- Is immutable to ensure data consistency

## Related Documentation [Permalink for this section](https://mastra.ai/docs/reference/workflows/workflow\#related-documentation)

- [Step](https://mastra.ai/docs/reference/workflows/step-class)
- [.then()](https://mastra.ai/docs/reference/workflows/then)
- [.step()](https://mastra.ai/docs/reference/workflows/step-function)
- [.after()](https://mastra.ai/docs/reference/workflows/after)

Last updated on March 11, 2025

[MCPConfiguration](https://mastra.ai/docs/reference/tools/mcp-configuration "MCPConfiguration") [Step](https://mastra.ai/docs/reference/workflows/step-class "Step")

## Mastra AI Agents Overview
[Docs](https://mastra.ai/docs "Docs") AgentsOverview

# Creating and Calling Agents

Agents in Mastra are systems where the language model can autonomously decide on a sequence of actions to perform tasks. They have access to tools, workflows, and synced data, enabling them to perform complex tasks and interact with external systems. Agents can invoke your custom functions, utilize third-party APIs through integrations, and access knowledge bases you have built.

Agents are like employees who can be used for ongoing projects. They have names, persistent memory, consistent model configurations, and instructions across calls, as well as a set of enabled tools.

## 1\. Creating an Agent [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#1-creating-an-agent)

To create an agent in Mastra, you use the `Agent` class and define its properties:

src/mastra/agents/index.ts

```nextra-code [counter-reset:line]
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

export const myAgent = new Agent({
  name: "My Agent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
});
```

**Note:** Ensure that you have set the necessary environment variables, such as your OpenAI API key, in your `.env` file:

.env

```nextra-code
OPENAI_API_KEY=your_openai_api_key
```

Also, make sure you have the `@mastra/core` package installed:

npmpnpmyarnbun

```nextra-code
npm install @mastra/core
```

```nextra-code
pnpm add @mastra/core
```

```nextra-code
yarn add @mastra/core
```

```nextra-code
bun add @mastra/core
```

### Registering the Agent [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#registering-the-agent)

Register your agent with Mastra to enable logging and access to configured tools and integrations:

src/mastra/index.ts

```nextra-code [counter-reset:line]
import { Mastra } from "@mastra/core";
import { myAgent } from "./agents";

export const mastra = new Mastra({
  agents: { myAgent },
});
```

## 2\. Generating and streaming text [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#2-generating-and-streaming-text)

### Generating text [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#generating-text)

Use the `.generate()` method to have your agent produce text responses:

src/mastra/index.ts

```nextra-code [counter-reset:line]
const response = await myAgent.generate([\
  { role: "user", content: "Hello, how can you assist me today?" },\
]);

console.log("Agent:", response.text);
```

### Streaming responses [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#streaming-responses)

For more real-time responses, you can stream the agent’s response:

src/mastra/index.ts

```nextra-code [counter-reset:line]
const stream = await myAgent.stream([\
  { role: "user", content: "Tell me a story." },\
]);

console.log("Agent:");

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## **3\. Structured Output** [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#3-structured-output)

Agents can return structured data by providing a JSON Schema or using a Zod schema.

### Using JSON Schema [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#using-json-schema)

```nextra-code
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
  required: ["summary", "keywords"],
};

const response = await myAgent.generate(
  [\
    {\
      role: "user",\
      content:\
        "Please provide a summary and keywords for the following text: ...",\
    },\
  ],
  {
    output: schema,
  },
);

console.log("Structured Output:", response.object);
```

### Using Zod [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#using-zod)

You can also use Zod schemas for type-safe structured outputs.

First, install Zod:

npmpnpmyarnbun

```nextra-code
npm install zod
```

```nextra-code
pnpm add zod
```

```nextra-code
yarn add zod
```

```nextra-code
bun add zod
```

Then, define a Zod schema and use it with the agent:

src/mastra/index.ts

```nextra-code [counter-reset:line]
import { z } from "zod";

// Define the Zod schema
const schema = z.object({
  summary: z.string(),
  keywords: z.array(z.string()),
});

// Use the schema with the agent
const response = await myAgent.generate(
  [\
    {\
      role: "user",\
      content:\
        "Please provide a summary and keywords for the following text: ...",\
    },\
  ],
  {
    output: schema,
  },
);

console.log("Structured Output:", response.object);
```

This allows you to have strong typing and validation for the structured data returned by the agent.

## **4\. Running Agents** [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#4-running-agents)

Mastra provides a CLI command `mastra dev` to run your agents behind an API. By default, this looks for exported agents in files in the `src/mastra/agents` directory.

### Starting the Server [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#starting-the-server)

```nextra-code
mastra dev
```

This will start the server and make your agent available at `http://localhost:4111/api/agents/myAgent/generate`.

### Interacting with the Agent [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#interacting-with-the-agent)

You can interact with the agent using `curl` from the command line:

```nextra-code
curl -X POST http://localhost:4111/api/agents/myAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      { "role": "user", "content": "Hello, how can you assist me today?" }\
    ]
  }'
```

## Next Steps [Permalink for this section](https://mastra.ai/docs/agents/00-overview\#next-steps)

- Learn about Agent Memory in the [Agent Memory](https://mastra.ai/docs/agents/01-agent-memory) guide.
- Learn about Agent Tools in the [Agent Tools](https://mastra.ai/docs/agents/02-adding-tools) guide.
- See an example agent in the [Chef Michel](https://mastra.ai/docs/guides/01-chef-michel) example.

Last updated on March 11, 2025

[Integrate with Next.js](https://mastra.ai/docs/frameworks/01-next-js "Integrate with Next.js") [Memory](https://mastra.ai/docs/agents/01-agent-memory "Memory")

## Mastra Project Initialization
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") CLImastra init

# `mastra init` Reference

## `mastra init` [Permalink for this section](https://mastra.ai/docs/reference/cli/init\#mastra-init)

This creates a new Mastra project. You can run it in three different ways:

1. **Interactive Mode (Recommended)**
Run without flags to use the interactive prompt, which will guide you through:
   - Choosing a directory for Mastra files
   - Selecting components to install (Agents, Tools, Workflows)
   - Choosing a default LLM provider (OpenAI, Anthropic, or Groq)
   - Deciding whether to include example code
2. **Quick Start with Defaults**



```nextra-code
mastra init --default
```







This sets up a project with:
   - Source directory: `src/`
   - All components: agents, tools, workflows
   - OpenAI as the default provider
   - No example code
3. **Custom Setup**



```nextra-code
mastra init --dir src/mastra --components agents,tools --llm openai --example
```







Options:
   - `-d, --dir`: Directory for Mastra files (defaults to src/mastra)
   - `-c, --components`: Comma-separated list of components (agents, tools, workflows)
   - `-l, --llm`: Default model provider (openai, anthropic, or groq)
   - `-k, --llm-api-key`: API key for the selected LLM provider (will be added to .env file)
   - `-e, --example`: Include example code
   - `-ne, --no-example`: Skip example code

Last updated on March 11, 2025

[Mastra Class](https://mastra.ai/docs/reference/core/mastra-class "Mastra Class") [mastra dev](https://mastra.ai/docs/reference/cli/dev "mastra dev")

## Rerank Function Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [RAG](https://mastra.ai/docs/reference/rag/chunk "RAG") rerank()

# rerank()

The `rerank()` function provides advanced reranking capabilities for vector search results by combining semantic relevance, vector similarity, and position-based scoring.

```nextra-code
function rerank(
  results: QueryResult[],
  query: string,
  modelConfig: ModelConfig,
  options?: RerankerFunctionOptions
): Promise<RerankResult[]>
```

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/rag/rerank\#usage-example)

```nextra-code
import { openai } from "@ai-sdk/openai";
import { rerank } from "@mastra/rag";

const model = openai("gpt-4o-mini");

const rerankedResults = await rerank(
  vectorSearchResults,
  "How do I deploy to production?",
  model,
  {
    weights: {
      semantic: 0.5,
      vector: 0.3,
      position: 0.2
    },
    topK: 3
  }
);
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/rerank\#parameters)

### results:

QueryResult\[\]

The vector search results to rerank

### query:

string

The search query text used to evaluate relevance

### model:

MastraLanguageModel

The language Model to use for reranking

### options?:

RerankerFunctionOptions

Options for the reranking model

The rerank function accepts any LanguageModel from the Vercel AI SDK. When using the Cohere model `rerank-v3.5`, it will automatically use Cohere’s reranking capabilities.

> **Note:** For semantic scoring to work properly during re-ranking, each result must include the text content in its `metadata.text` field.

### RerankerFunctionOptions [Permalink for this section](https://mastra.ai/docs/reference/rag/rerank\#rerankerfunctionoptions)

### weights?:

WeightConfig

Weights for different scoring components (must add up to 1)

number

### semantic?:

number (default: 0.4)

Weight for semantic relevance

number

### vector?:

number (default: 0.4)

Weight for vector similarity

number

### position?:

number (default: 0.2)

Weight for position-based scoring

### queryEmbedding?:

number\[\]

Embedding of the query

### topK?:

number

= 3

Number of top results to return

## Returns [Permalink for this section](https://mastra.ai/docs/reference/rag/rerank\#returns)

The function returns an array of `RerankResult` objects:

### result:

QueryResult

The original query result

### score:

number

Combined reranking score (0-1)

### details:

ScoringDetails

Detailed scoring information

### ScoringDetails [Permalink for this section](https://mastra.ai/docs/reference/rag/rerank\#scoringdetails)

### semantic:

number

Semantic relevance score (0-1)

### vector:

number

Vector similarity score (0-1)

### position:

number

Position-based score (0-1)

### queryAnalysis?:

object

Query analysis details

number

### magnitude:

Magnitude of the query

number\[\]

### dominantFeatures:

Dominant features of the query

## Related [Permalink for this section](https://mastra.ai/docs/reference/rag/rerank\#related)

- [createVectorQueryTool](https://mastra.ai/docs/reference/tools/vector-query-tool)

Last updated on March 11, 2025

[ExtractParams](https://mastra.ai/docs/reference/rag/extract-params "ExtractParams") [MDocument](https://mastra.ai/docs/reference/rag/document "MDocument")

## GraphRAG Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [RAG](https://mastra.ai/docs/reference/rag/chunk "RAG") GraphRAG

# GraphRAG

The `GraphRAG` class implements a graph-based approach to retrieval augmented generation. It creates a knowledge graph from document chunks where nodes represent documents and edges represent semantic relationships, enabling both direct similarity matching and discovery of related content through graph traversal.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#basic-usage)

```nextra-code
import { GraphRAG } from "@mastra/rag";

const graphRag = new GraphRAG({
  dimension: 1536,
  threshold: 0.7
});

// Create the graph from chunks and embeddings
graphRag.createGraph(documentChunks, embeddings);

// Query the graph with embedding
const results = await graphRag.query({
  query: queryEmbedding,
  topK: 10,
  randomWalkSteps: 100,
  restartProb: 0.15
});
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#constructor-parameters)

### dimension?:

number

= 1536

Dimension of the embedding vectors

### threshold?:

number

= 0.7

Similarity threshold for creating edges between nodes (0-1)

## Methods [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#methods)

### createGraph [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#creategraph)

Creates a knowledge graph from document chunks and their embeddings.

```nextra-code
createGraph(chunks: GraphChunk[], embeddings: GraphEmbedding[]): void
```

#### Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#parameters)

### chunks:

GraphChunk\[\]

Array of document chunks with text and metadata

### embeddings:

GraphEmbedding\[\]

Array of embeddings corresponding to chunks

### query [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#query)

Performs a graph-based search combining vector similarity and graph traversal.

```nextra-code
query({
  query,
  topK = 10,
  randomWalkSteps = 100,
  restartProb = 0.15
}: {
  query: number[];
  topK?: number;
  randomWalkSteps?: number;
  restartProb?: number;
}): RankedNode[]
```

#### Parameters [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#parameters-1)

### query:

number\[\]

Query embedding vector

### topK?:

number

= 10

Number of results to return

### randomWalkSteps?:

number

= 100

Number of steps in random walk

### restartProb?:

number

= 0.15

Probability of restarting walk from query node

#### Returns [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#returns)

Returns an array of `RankedNode` objects, where each node contains:

### id:

string

Unique identifier for the node

### content:

string

Text content of the document chunk

### metadata:

Record<string, any>

Additional metadata associated with the chunk

### score:

number

Combined relevance score from graph traversal

## Advanced Example [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#advanced-example)

```nextra-code
const graphRag = new GraphRAG({
  dimension: 1536,
  threshold: 0.8  // Stricter similarity threshold
});

// Create graph from chunks and embeddings
graphRag.createGraph(documentChunks, embeddings);

// Query with custom parameters
const results = await graphRag.query({
  query: queryEmbedding,
  topK: 5,
  randomWalkSteps: 200,
  restartProb: 0.2
});
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/rag/graph-rag\#related)

- [createGraphRAGTool](https://mastra.ai/docs/reference/tools/graph-rag-tool)

Last updated on March 11, 2025

[Metadata Filters](https://mastra.ai/docs/reference/rag/metadata-filters "Metadata Filters") [AstraVector](https://mastra.ai/docs/reference/rag/astra "AstraVector")

## Create Logger Function
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Observability](https://mastra.ai/docs/reference/observability/providers "Observability").createLogger()

# createLogger()

The `createLogger()` function is used to instantiate a logger based on a given configuration. You can create console-based, file-based, or Upstash Redis-based loggers by specifying the type and any additional parameters relevant to that type.

### Usage [Permalink for this section](https://mastra.ai/docs/reference/observability/create-logger\#usage)

#### Console Logger (Development) [Permalink for this section](https://mastra.ai/docs/reference/observability/create-logger\#console-logger-development)

```nextra-code [counter-reset:line]
const consoleLogger = createLogger({ name: "Mastra", level: "debug" });
consoleLogger.info("App started");
```

#### File Transport (Structured Logs) [Permalink for this section](https://mastra.ai/docs/reference/observability/create-logger\#file-transport-structured-logs)

```nextra-code [counter-reset:line]
import { FileTransport } from "@mastra/loggers/file";

const fileLogger = createLogger({
  name: "Mastra",
  transports: { file: new FileTransport({ path: "test-dir/test.log" }) },
  level: "warn",
});
fileLogger.warn("Low disk space", {
  destinationPath: "system",
  type: "WORKFLOW",
});
```

#### Upstash Logger (Remote Log Drain) [Permalink for this section](https://mastra.ai/docs/reference/observability/create-logger\#upstash-logger-remote-log-drain)

```nextra-code [counter-reset:line]
import { UpstashTransport } from "@mastra/loggers/upstash";

const logger = createLogger({
  name: "Mastra",
  transports: {
    upstash: new UpstashTransport({
      listName: "production-logs",
      upstashUrl: process.env.UPSTASH_URL!,
      upstashToken: process.env.UPSTASH_TOKEN!,
    }),
  },
  level: "info",
});

logger.info({
  message: "User signed in",
  destinationPath: "auth",
  type: "AGENT",
  runId: "run_123",
});
```

### Parameters [Permalink for this section](https://mastra.ai/docs/reference/observability/create-logger\#parameters)

### type:

0

Specifies the logger implementation to create.

### level?:

LogLevel

Minimum severity level of logs to record. One of DEBUG, INFO, WARN, or ERROR.

### dirPath?:

string

For FILE type only. Directory path where log files are stored (default: "logs").

### url?:

string

For UPSTASH type only. Upstash Redis endpoint URL used for storing logs.

### token?:

string

For UPSTASH type only. Upstash Redis access token.

### key?:

string

For UPSTASH type only. Redis list key under which logs are stored.

Last updated on March 11, 2025

[OTelConfig](https://mastra.ai/docs/reference/observability/otel-config "OTelConfig") [Overview](https://mastra.ai/docs/reference/client-js "Overview")

## Workflow Step Method
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").step()

# Workflow.step()

The `.step()` method adds a new step to the workflow, optionally configuring its variables and execution conditions.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-function\#usage)

```nextra-code
workflow.step({
  id: "stepTwo",
  outputSchema: z.object({
    result: z.number()
  }),
  execute: async ({ context }) => {
    return { result: 42 };
  }
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-function\#parameters)

### stepConfig:

Step \| StepDefinition \| string

Step instance, configuration object, or step ID to add to workflow

### options?:

StepOptions

Optional configuration for step execution

### StepDefinition [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-function\#stepdefinition)

### id:

string

Unique identifier for the step

### outputSchema?:

z.ZodSchema

Schema for validating step output

### execute:

(params: ExecuteParams) => Promise<any>

Function containing step logic

### StepOptions [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-function\#stepoptions)

### variables?:

Record<string, VariableRef>

Map of variable names to their source references

### when?:

StepCondition

Condition that must be met for step to execute

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-function\#related)

- [Basic Usage with Step Instance](https://mastra.ai/docs/workflows/steps)
- [Step Class Reference](https://mastra.ai/docs/reference/workflows/step-class)
- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow)

```nextra-code

```

Last updated on March 11, 2025

[StepCondition](https://mastra.ai/docs/reference/workflows/step-condition "StepCondition") [.after()](https://mastra.ai/docs/reference/workflows/after ".after()")

## Chunking and Embedding
[Docs](https://mastra.ai/docs "Docs") [RAG](https://mastra.ai/docs/rag/overview "RAG") Chunking and Embedding

## Chunking and Embedding Documents [Permalink for this section](https://mastra.ai/docs/rag/chunking-and-embedding\#chunking-and-embedding-documents)

Before processing, create a MDocument instance from your content. You can initialize it from various formats:

```nextra-code [counter-reset:line]
const docFromText = MDocument.fromText("Your plain text content...");
const docFromHTML = MDocument.fromHTML("<html>Your HTML content...</html>");
const docFromMarkdown = MDocument.fromMarkdown("# Your Markdown content...");
const docFromJSON = MDocument.fromJSON(`{ "key": "value" }`);
```

## Step 1: Document Processing [Permalink for this section](https://mastra.ai/docs/rag/chunking-and-embedding\#step-1-document-processing)

Use `chunk` to split documents into manageable pieces. Mastra supports multiple chunking strategies optimized for different document types:

- `recursive`: Smart splitting based on content structure
- `character`: Simple character-based splits
- `token`: Token-aware splitting
- `markdown`: Markdown-aware splitting
- `html`: HTML structure-aware splitting
- `json`: JSON structure-aware splitting
- `latex`: LaTeX structure-aware splitting

Here’s an example of how to use the `recursive` strategy:

```nextra-code [counter-reset:line]
const chunks = await doc.chunk({
  strategy: "recursive",
  size: 512,
  overlap: 50,
  separator: "\n",
  extract: {
    metadata: true, // Optionally extract metadata
  },
});
```

**Note:** Metadata extraction may use LLM calls, so ensure your API key is set.

We go deeper into chunking strategies in our [chunk documentation](https://mastra.ai/docs/reference/rag/chunk).

## Step 2: Embedding Generation [Permalink for this section](https://mastra.ai/docs/rag/chunking-and-embedding\#step-2-embedding-generation)

Transform chunks into embeddings using your preferred provider. Mastra supports both OpenAI and Cohere embeddings:

### Using OpenAI [Permalink for this section](https://mastra.ai/docs/rag/chunking-and-embedding\#using-openai)

```nextra-code [counter-reset:line]
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});
```

### Using Cohere [Permalink for this section](https://mastra.ai/docs/rag/chunking-and-embedding\#using-cohere)

```nextra-code [counter-reset:line]
import { embedMany } from 'ai';
import { cohere } from '@ai-sdk/cohere';

const { embeddings } = await embedMany({
  model: cohere.embedding('embed-english-v3.0'),
  values: chunks.map(chunk => chunk.text),
});
```

The embedding functions return vectors, arrays of numbers representing the semantic meaning of your text, ready for similarity searches in your vector database.

## Example: Complete Pipeline [Permalink for this section](https://mastra.ai/docs/rag/chunking-and-embedding\#example-complete-pipeline)

Here’s an example showing document processing and embedding generation with both providers:

```nextra-code [counter-reset:line]
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { cohere } from "@ai-sdk/cohere";

import { MDocument } from "@mastra/rag";

// Initialize document
const doc = MDocument.fromText(`
  Climate change poses significant challenges to global agriculture.
  Rising temperatures and changing precipitation patterns affect crop yields.
`);

// Create chunks
const chunks = await doc.chunk({
  strategy: "recursive",
  size: 256,
  overlap: 50,
});

// Generate embeddings with OpenAI
const { embeddings: openAIEmbeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

// OR

// Generate embeddings with Cohere
const { embeddings: cohereEmbeddings } = await embedMany({
  model: cohere.embedding('embed-english-v3.0'),
  values: chunks.map(chunk => chunk.text),
});

// Store embeddings in your vector database
await vectorStore.upsert({
  indexName: "embeddings",
  vectors: embeddings,
});
```

This example demonstrates how to process a document, split it into chunks, generate embeddings with both OpenAI and Cohere, and store the results in a vector database.

For more examples of different chunking strategies and embedding configurations, see:

- [Adjust Chunk Size](https://mastra.ai/docs/reference/rag/chunk#adjust-chunk-size)
- [Adjust Chunk Delimiters](https://mastra.ai/docs/reference/rag/chunk#adjust-chunk-delimiters)
- [Embed Text with Cohere](https://mastra.ai/docs/reference/rag/embeddings#using-cohere)

Last updated on March 11, 2025

[Overview](https://mastra.ai/docs/rag/overview "Overview") [Vector Databases](https://mastra.ai/docs/rag/vector-databases "Vector Databases")

## Stock Price Agent
[Docs](https://mastra.ai/docs "Docs") [Guides](https://mastra.ai/docs/guides/01-chef-michel "Guides") Tools: Stock Agent

# Stock Agent

We’re going to create a simple agent that fetches the last day’s closing stock price for a given symbol. This example will show you how to create a tool, add it to an agent, and use the agent to fetch stock prices.

Mastra Tools Guide - Stock Agent - YouTube

Mastra AI

1.24K subscribers

[Mastra Tools Guide - Stock Agent](https://www.youtube.com/watch?v=rIaZ4l7y9wo)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=rIaZ4l7y9wo "Watch on YouTube")

## Project Structure [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#project-structure)

```nextra-code
stock-price-agent/
├── src/
│   ├── agents/
│   │   └── stockAgent.ts
│   ├── tools/
│   │   └── stockPrices.ts
│   └── index.ts
├── package.json
└── .env
```

* * *

## Initialize the Project and Install Dependencies [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#initialize-the-project-and-install-dependencies)

First, create a new directory for your project and navigate into it:

```nextra-code
mkdir stock-price-agent
cd stock-price-agent
```

Initialize a new Node.js project and install the required dependencies:

```nextra-code
npm init -y
npm install @mastra/core zod
```

Set Up Environment Variables

Create a `.env` file at the root of your project to store your OpenAI API key.

.env

```nextra-code
OPENAI_API_KEY=your_openai_api_key
```

Create the necessary directories and files:

```nextra-code
mkdir -p src/agents src/tools
touch src/agents/stockAgent.ts src/tools/stockPrices.ts src/index.ts
```

* * *

## Create the Stock Price Tool [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#create-the-stock-price-tool)

Next, we’ll create a tool that fetches the last day’s closing stock price for a given symbol.

src/tools/stockPrices.ts

```nextra-code
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const getStockPrice = async (symbol: string) => {
  const data = await fetch(
    `https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`,
  ).then((r) => r.json());
  return data.prices["4. close"];
};

export const stockPrices = createTool({
  id: "Get Stock Price",
  inputSchema: z.object({
    symbol: z.string(),
  }),
  description: `Fetches the last day's closing stock price for a given symbol`,
  execute: async ({ context: { symbol } }) => {
    console.log("Using tool to fetch stock price for", symbol);
    return {
      symbol,
      currentPrice: await getStockPrice(symbol),
    };
  },
});
```

* * *

## Add the Tool to an Agent [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#add-the-tool-to-an-agent)

We’ll create an agent and add the `stockPrices` tool to it.

src/agents/stockAgent.ts

```nextra-code
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

import * as tools from "../tools/stockPrices";

export const stockAgent = new Agent<typeof tools>({
  name: "Stock Agent",
  instructions:
    "You are a helpful assistant that provides current stock prices. When asked about a stock, use the stock price tool to fetch the stock price.",
  model: openai("gpt-4o-mini"),
  tools: {
    stockPrices: tools.stockPrices,
  },
});
```

* * *

## Set Up the Mastra Instance [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#set-up-the-mastra-instance)

We need to initialize the Mastra instance with our agent and tool.

src/index.ts

```nextra-code
import { Mastra } from "@mastra/core";

import { stockAgent } from "./agents/stockAgent";

export const mastra = new Mastra({
  agents: { stockAgent },
});
```

## Serve the Application [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#serve-the-application)

Instead of running the application directly, we’ll use the `mastra dev` command to start the server. This will expose your agent via REST API endpoints, allowing you to interact with it over HTTP.

In your terminal, start the Mastra server by running:

```nextra-code
mastra dev --dir src
```

This command will allow you to test your stockPrices tool and your stockAgent within the playground.

This will also start the server and make your agent available at:

```nextra-code
http://localhost:4111/api/agents/stockAgent/generate
```

* * *

## Test the Agent with cURL [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#test-the-agent-with-curl)

Now that your server is running, you can test your agent’s endpoint using `curl`:

```nextra-code
curl -X POST http://localhost:4111/api/agents/stockAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      { "role": "user", "content": "What is the current stock price of Apple (AAPL)?" }\
    ]
  }'
```

**Expected Response:**

You should receive a JSON response similar to:

```nextra-code
{
  "text": "The current price of Apple (AAPL) is $174.55.",
  "agent": "Stock Agent"
}
```

This indicates that your agent successfully processed the request, used the `stockPrices` tool to fetch the stock price, and returned the result.

Last updated on March 11, 2025

[Agents: Chef Michel](https://mastra.ai/docs/guides/01-chef-michel "Agents: Chef Michel") [Workflows: AI Recruiter](https://mastra.ai/docs/guides/03-recruiter "Workflows: AI Recruiter")

## Chef Assistant Guide
[Docs](https://mastra.ai/docs "Docs") GuidesAgents: Chef Michel

# Agents Guide: Building a Chef Assistant

In this guide, we’ll walk through creating a “Chef Assistant” agent that helps users cook meals with available ingredients.

Mastra Agents Guide - Chef Michel - YouTube

Mastra AI

1.24K subscribers

[Mastra Agents Guide - Chef Michel](https://www.youtube.com/watch?v=_tZhOqHCrF0)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

[Watch on](https://www.youtube.com/watch?v=_tZhOqHCrF0&embeds_referring_euri=https%3A%2F%2Fmastra.ai%2F)

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=_tZhOqHCrF0 "Watch on YouTube")

## Prerequisites [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#prerequisites)

- Node.js installed
- Mastra installed: `npm install @mastra/core`

* * *

## Create the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#create-the-agent)

### Define the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#define-the-agent)

Create a new file `src/mastra/agents/chefAgent.ts` and define your agent:

src/mastra/agents/chefAgent.ts

```nextra-code
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const chefAgent = new Agent({
  name: "chef-agent",
  instructions:
    "You are Michel, a practical and experienced home chef" +
    "You help people cook with whatever ingredients they have available.",
  model: openai("gpt-4o-mini"),
});
```

* * *

## Set Up Environment Variables [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#set-up-environment-variables)

Create a `.env` file in your project root and add your OpenAI API key:

.env

```nextra-code
OPENAI_API_KEY=your_openai_api_key
```

* * *

## Register the Agent with Mastra [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#register-the-agent-with-mastra)

In your main file, register the agent:

src/mastra/index.ts

```nextra-code
import { Mastra } from "@mastra/core";

import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({
  agents: { chefAgent },
});
```

* * *

## Interacting with the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#interacting-with-the-agent)

### Generating Text Responses [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#generating-text-responses)

src/index.ts

```nextra-code
async function main() {
  const query =
    "In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?";
  console.log(`Query: ${query}`);

  const response = await chefAgent.generate([{ role: "user", content: query }]);
  console.log("\n👨‍🍳 Chef Michel:", response.text);
}

main();
```

Run the script:

```nextra-code
npx bun src/index.ts
```

Output:

```nextra-code
Query: In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?

👨‍🍳 Chef Michel: You can make a delicious pasta al pomodoro! Here's how...
```

* * *

### Streaming Responses [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#streaming-responses)

src/index.ts

```nextra-code
async function main() {
  const query =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query: ${query}`);

  const stream = await chefAgent.stream([{ role: "user", content: query }]);

  console.log("\n Chef Michel: ");

  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }

  console.log("\n\n✅ Recipe complete!");
}

main();
```

Output:

```nextra-code
Query: Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.

👨‍🍳 Chef Michel:
Great! You can make a comforting chicken curry...

✅ Recipe complete!
```

* * *

### Generating a Recipe with Structured Data [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#generating-a-recipe-with-structured-data)

src/index.ts

```nextra-code
import { z } from "zod";

async function main() {
  const query =
    "I want to make lasagna, can you generate a lasagna recipe for me?";
  console.log(`Query: ${query}`);

  // Define the Zod schema
  const schema = z.object({
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
  });

  const response = await chefAgent.generate(
    [{ role: "user", content: query }],
    { output: schema },
  );
  console.log("\n👨‍🍳 Chef Michel:", response.object);
}

main();
```

Output:

```nextra-code
Query: I want to make lasagna, can you generate a lasagna recipe for me?

👨‍🍳 Chef Michel: {
  ingredients: [\
    { name: "Lasagna noodles", amount: "12 sheets" },\
    { name: "Ground beef", amount: "1 pound" },\
    // ...\
  ],
  steps: [\
    "Preheat oven to 375°F (190°C).",\
    "Cook the lasagna noodles according to package instructions.",\
    // ...\
  ]
}
```

* * *

## Running the Agent Server [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#running-the-agent-server)

### Using `mastra dev` [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#using-mastra-dev)

You can run your agent as a service using the `mastra dev` command:

```nextra-code
mastra dev
```

This will start a server exposing endpoints to interact with your registered agents.

### Accessing the Chef Assistant API [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#accessing-the-chef-assistant-api)

By default, `mastra dev` runs on `http://localhost:4111`. Your Chef Assistant agent will be available at:

```nextra-code
POST http://localhost:4111/api/agents/chefAgent/generate
```

### Interacting with the Agent via `curl` [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#interacting-with-the-agent-via-curl)

You can interact with the agent using `curl` from the command line:

```nextra-code
curl -X POST http://localhost:4111/api/agents/chefAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      {\
        "role": "user",\
        "content": "I have eggs, flour, and milk. What can I make?"\
      }\
    ]
  }'
```

**Sample Response:**

```nextra-code
{
  "text": "You can make delicious pancakes! Here's a simple recipe..."
}
```

Last updated on March 11, 2025

[Project Structure](https://mastra.ai/docs/getting-started/project-structure "Project Structure") [Tools: Stock Agent](https://mastra.ai/docs/guides/02-stock-agent "Tools: Stock Agent")

## 404 Error Page
# 404

## This page could not be found.

## Logging and Tracing
[Docs](https://mastra.ai/docs "Docs") [Deployment](https://mastra.ai/docs/deployment/server "Deployment") Logging and Tracing

# Logging and Tracing

Effective logging and tracing are crucial for understanding the behavior of your application.

Tracing is especially important for AI engineering. Teams building AI products find that visibility into inputs and outputs of every step of every run is crucial to improving accuracy. You get this with Mastra’s telemetry.

## Logging [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#logging)

In Mastra, logs can detail when certain functions run, what input data they receive, and how they respond.

### Basic Setup [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#basic-setup)

Here’s a minimal example that sets up a **console logger** at the `INFO` level. This will print out informational messages and above (i.e., `INFO`, `WARN`, `ERROR`) to the console.

mastra.config.ts

```nextra-code [counter-reset:line]
import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";

export const mastra = new Mastra({
  // Other Mastra configuration...
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

In this configuration:

- `name: "Mastra"` specifies the name to group logs under.
- `level: "info"` sets the minimum severity of logs to record.

### Configuration [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#configuration)

- For more details on the options you can pass to `createLogger()`, see the [createLogger reference documentation](https://mastra.ai/docs/reference/observability/create-logger).
- Once you have a `Logger` instance, you can call its methods (e.g., `.info()`, `.warn()`, `.error()`) in the [Logger instance reference documentation](https://mastra.ai/docs/reference/observability/logger).
- If you want to send your logs to an external service for centralized collection, analysis, or storage, you can configure other logger types such as Upstash Redis. Consult the [createLogger reference documentation](https://mastra.ai/docs/reference/observability/create-logger) for details on parameters like `url`, `token`, and `key` when using the `UPSTASH` logger type.

## Telemetry [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#telemetry)

Mastra supports the OpenTelemetry Protocol (OTLP) for tracing and monitoring your application. When telemetry is enabled, Mastra automatically traces all core primitives including agent operations, LLM interactions, tool executions, integration calls, workflow runs, and database operations. Your telemetry data can then be exported to any OTEL collector.

### Basic Configuration [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#basic-configuration)

Here’s a simple example of enabling telemetry:

mastra.config.ts

```nextra-code [counter-reset:line]
export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "my-app",
    enabled: true,
    sampling: {
      type: "always_on",
    },
    export: {
      type: "otlp",
      endpoint: "http://localhost:4318", // SigNoz local endpoint
    },
  },
});
```

### Configuration Options [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#configuration-options)

The telemetry config accepts these properties:

```nextra-code
type OtelConfig = {
  // Name to identify your service in traces (optional)
  serviceName?: string;

  // Enable/disable telemetry (defaults to true)
  enabled?: boolean;

  // Control how many traces are sampled
  sampling?: {
    type: "ratio" | "always_on" | "always_off" | "parent_based";
    probability?: number; // For ratio sampling
    root?: {
      probability: number; // For parent_based sampling
    };
  };

  // Where to send telemetry data
  export?: {
    type: "otlp" | "console";
    endpoint?: string;
    headers?: Record<string, string>;
  };
};
```

See the [OtelConfig reference documentation](https://mastra.ai/docs/reference/observability/otel-config) for more details.

### Environment Variables [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#environment-variables)

You can configure the OTLP endpoint and headers through environment variables:

.env

```nextra-code
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=x-api-key=your-api-key
```

Then in your config:

mastra.config.ts

```nextra-code [counter-reset:line]
export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "my-app",
    enabled: true,
    export: {
      type: "otlp",
      // endpoint and headers will be picked up from env vars
    },
  },
});
```

### Example: SigNoz Integration [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#example-signoz-integration)

Here’s what a traced agent interaction looks like in [SigNoz](https://signoz.io/):

![Agent interaction trace showing spans, LLM calls, and tool executions](https://mastra.ai/docs/signoz-telemetry-demo.png)

### Other Supported Providers [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#other-supported-providers)

For a complete list of supported observability providers and their configuration details, see the [Observability Providers reference](https://mastra.ai/docs/reference/observability/providers).

## Next.js Configuration [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#nextjs-configuration)

If you’re using Next.js, you have two options for setting up OpenTelemetry instrumentation:

#### Option 1: Using Vercel’s OTEL Setup [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#option-1-using-vercels-otel-setup)

If you’re deploying to Vercel, you can use their built-in OpenTelemetry setup:

1. Install the required dependencies:

```nextra-code
npm install @opentelemetry/api @vercel/otel
```

2. Create an instrumentation file at the root of your project (or in the src folder if using one):

instrumentation.ts

```nextra-code
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'your-project-name' })
}
```

#### Option 2: Using Custom Exporters [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#option-2-using-custom-exporters)

If you’re using other observability tools (like Langfuse), you can configure a custom exporter:

1. Install the required dependencies (example using Langfuse):

```nextra-code
npm install @opentelemetry/api langfuse-vercel
```

2. Create an instrumentation file:

instrumentation.ts

```nextra-code
import {
  NodeSDK,
  ATTR_SERVICE_NAME,
  Resource,
} from '@mastra/core/telemetry/otel-vendor';
import { LangfuseExporter } from 'langfuse-vercel';

export function register() {
  const exporter = new LangfuseExporter({
    // ... Langfuse config
  })

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'ai',
    }),
    traceExporter: exporter,
  });

  sdk.start();
}
```

#### Next.js Configuration [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#nextjs-configuration-1)

For either option, enable the instrumentation hook in your Next.js config:

next.config.ts

```nextra-code [counter-reset:line]
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true // Not required in Next.js 15+
  }
};

export default nextConfig;
```

#### Mastra Configuration [Permalink for this section](https://mastra.ai/docs/deployment/logging-and-tracing\#mastra-configuration)

Configure your Mastra instance:

mastra.config.ts

```nextra-code
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-project-name",
    enabled: true
  }
});
```

This setup will enable OpenTelemetry tracing for your Next.js application and Mastra operations.

For more details, see the documentation for:

- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Vercel OpenTelemetry](https://vercel.com/docs/observability/otel-overview/quickstart)

Last updated on March 11, 2025

[Mastra Server](https://mastra.ai/docs/deployment/server "Mastra Server") [Deployment](https://mastra.ai/docs/deployment/deployment "Deployment")

## LangSmith Integration Guide
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") Observability [Providers](https://mastra.ai/docs/reference/observability/providers "Providers") LangSmith

# LangSmith

LangSmith is LangChain’s platform for debugging, testing, evaluating, and monitoring LLM applications.

> **Note**: Currently, this integration only traces AI-related calls in your application. Other types of operations are not captured in the telemetry data.

## Configuration [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/langsmith\#configuration)

To use LangSmith with Mastra, you’ll need to configure the following environment variables:

```nextra-code
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your-api-key
LANGSMITH_PROJECT=your-project-name
```

## Implementation [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/langsmith\#implementation)

Here’s how to configure Mastra to use LangSmith:

```nextra-code
import { Mastra } from "@mastra/core";
import { AISDKExporter } from "langsmith/vercel";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-service-name",
    enabled: true,
    export: {
      type: "custom",
      exporter: new AISDKExporter(),
    },
  },
});
```

## Dashboard [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/langsmith\#dashboard)

Access your traces and analytics in the LangSmith dashboard at [smith.langchain.com](https://smith.langchain.com/)

Last updated on March 11, 2025

[Braintrust](https://mastra.ai/docs/reference/observability/providers/braintrust "Braintrust") [Langfuse](https://mastra.ai/docs/reference/observability/providers/langfuse "Langfuse")

## Local Mastra Development
[Docs](https://mastra.ai/docs "Docs") [Local Dev](https://mastra.ai/docs/local-dev/creating-projects "Local Dev") Mastra Dev

# Inspecting agents and workflows with `mastra Dev`

The `mastra dev` command launches a development server that serves your Mastra application locally.

## REST API Endpoints [Permalink for this section](https://mastra.ai/docs/local-dev/mastra-dev\#rest-api-endpoints)

`mastra dev` spins up REST API endpoints for your agents and workflows, such as:

- `POST /api/agents/:agentId/generate`
- `POST /api/agents/:agentId/stream`
- `POST /api/workflows/:workflowId/start`
- `POST /api/workflows/:workflowId/:instanceId/event`
- `GET /api/workflows/:workflowId/:instanceId/status`

By default, the server runs at [http://localhost:4111](http://localhost:4111/), but you can change the port with the `--port` flag.

## Using the Client SDK [Permalink for this section](https://mastra.ai/docs/local-dev/mastra-dev\#using-the-client-sdk)

The easiest way to interact with your local Mastra server is through our [TypeScript/JavaScript Client SDK](https://mastra.ai/docs/reference/client-js). Install it with:

```nextra-code
npm install @mastra/client-js
```

Then configure it to point to your local server:

```nextra-code
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient({
  baseUrl: "http://localhost:4111",
});

// Example: Interact with a local agent
const agent = client.getAgent("my-agent");
const response = await agent.generate({
  messages: [{ role: "user", content: "Hello!" }],
});
```

The client SDK provides type-safe wrappers for all API endpoints, making it much easier to develop and test your Mastra applications locally.

## UI Playground [Permalink for this section](https://mastra.ai/docs/local-dev/mastra-dev\#ui-playground)

`mastra dev` creates a UI with an agent chat interface, a workflow visualizer and a tool playground.

## OpenAPI Specification [Permalink for this section](https://mastra.ai/docs/local-dev/mastra-dev\#openapi-specification)

`mastra dev` provides an OpenAPI spec at:

- `GET /openapi.json`

## Summary [Permalink for this section](https://mastra.ai/docs/local-dev/mastra-dev\#summary)

`mastra dev` makes it easy to develop, debug, and iterate on your AI logic in a self-contained environment before deploying to production.

- [Mastra Dev reference](https://mastra.ai/docs/reference/cli/dev)
- [Client SDK documentation](https://mastra.ai/docs/reference/client-js)

Last updated on March 11, 2025

[Creating Projects](https://mastra.ai/docs/local-dev/creating-projects "Creating Projects") [Integrations](https://mastra.ai/docs/local-dev/integrations "Integrations")

## Agent Memory System
[Docs](https://mastra.ai/docs "Docs") [Agents](https://mastra.ai/docs/agents/00-overview "Agents") Memory

# Agent Memory

Agents in Mastra have a sophisticated memory system that stores conversation history and contextual information. This memory system supports both traditional message storage and vector-based semantic search, enabling agents to maintain state across interactions and retrieve relevant historical context.

## Threads and Resources [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#threads-and-resources)

In Mastra, you can organize conversations by a `thread_id`. This allows the system to maintain context and retrieve historical messages that belong to the same discussion.

Mastra also supports the concept of a `resource_id`, which typically represents the user involved in the conversation, ensuring that the agent’s memory and context are correctly associated with the right entity.

This separation allows you to manage multiple conversations (threads) for a single user or even share conversation context across users if needed.

```nextra-code [counter-reset:line]
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "Project Manager",
  instructions:
    "You are a project manager. You are responsible for managing the project and the team.",
  model: openai("gpt-4o-mini"),
});

await agent.stream("When will the project be completed?", {
  threadId: "project_123",
  resourceId: "user_123",
});
```

## Managing Conversation Context [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#managing-conversation-context)

The key to getting good responses from LLMs is feeding them the right context.

Mastra has a Memory API that stores and manages conversation history and contextual information. The Memory API uses a storage backend to persist conversation history and contextual information (more on this later).

The Memory API uses two main mechanisms to maintain context in conversations, recent message history and semantic search.

### Recent Message History [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#recent-message-history)

By default, Memory keeps track of the 40 most recent messages in a conversation. You can customize this with the `lastMessages` setting:

```nextra-code [counter-reset:line]
const memory = new Memory({
  options: {
    lastMessages: 5, // Keep 5 most recent messages
  },
});

// When user asks this question, the agent will see the last 10 messages,
await agent.stream("Can you summarize the search feature requirements?", {
  memoryOptions: {
    lastMessages: 10,
  },
});
```

### Semantic Search [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#semantic-search)

Semantic search is enabled by default in Mastra. While FastEmbed (bge-small-en-v1.5) and LibSQL are included by default, you can use any embedder (like OpenAI or Cohere) and vector database (like PostgreSQL, Pinecone, or Chroma) that fits your needs.

This allows your agent to find and recall relevant information from earlier in the conversation:

```nextra-code [counter-reset:line]
const memory = new Memory({
  options: {
    semanticRecall: {
      topK: 10, // Include 10 most relevant past messages
      messageRange: 2, // Messages before and after each result
    },
  },
});

// Example: User asks about a past feature discussion
await agent.stream("What did we decide about the search feature last week?", {
  memoryOptions: {
    lastMessages: 10,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
  },
});
```

When semantic search is used:

1. The message is converted to a vector embedding
2. Similar messages are found using vector similarity search
3. Surrounding context is included based on `messageRange`
4. All relevant context is provided to the agent

You can also customize the vector database and embedder:

```nextra-code [counter-reset:line]
import { openai } from "@ai-sdk/openai";
import { PgVector } from "@mastra/pg";

const memory = new Memory({
  // Use a different vector database (libsql is default)
  vector: new PgVector("postgresql://user:pass@localhost:5432/db"),
  // Or a different embedder (fastembed is default)
  embedder: openai.embedding("text-embedding-3-small"),
});
```

## Memory Configuration [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#memory-configuration)

The Mastra memory system is highly configurable and supports multiple storage backends. By default, it uses LibSQL for storage and vector search, and FastEmbed for embeddings.

### Basic Configuration [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#basic-configuration)

For most use cases, you can use the default configuration:

```nextra-code [counter-reset:line]
import { Memory } from "@mastra/memory";

const memory = new Memory();
```

### Custom Configuration [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#custom-configuration)

For more control, you can customize the storage backend, vector database, and memory options:

```nextra-code [counter-reset:line]
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";

const memory = new Memory({
  storage: new PostgresStore({
    host: "localhost",
    port: 5432,
    user: "postgres",
    database: "postgres",
    password: "postgres",
  }),
  vector: new PgVector("postgresql://user:pass@localhost:5432/db"),
  options: {
    // Number of recent messages to include (false to disable)
    lastMessages: 10,
    // Configure vector-based semantic search (false to disable)
    semanticRecall: {
      topK: 3, // Number of semantic search results
      messageRange: 2, // Messages before and after each result
    },
  },
});
```

### Overriding Memory Settings [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#overriding-memory-settings)

When you initialize a Mastra instance with memory configuration, all agents will automatically use these memory settings when you call their `stream()` or `generate()` methods. You can override these default settings for individual calls:

```nextra-code [counter-reset:line]
// Use default memory settings from Memory configuration
const response1 = await agent.generate("What were we discussing earlier?", {
  resourceId: "user_123",
  threadId: "thread_456",
});

// Override memory settings for this specific call
const response2 = await agent.generate("What were we discussing earlier?", {
  resourceId: "user_123",
  threadId: "thread_456",
  memoryOptions: {
    lastMessages: 5, // Only inject 5 recent messages
    semanticRecall: {
      topK: 2, // Only get 2 semantic search results
      messageRange: 1, // Context around each result
    },
  },
});
```

### Configuring Memory for Different Use Cases [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#configuring-memory-for-different-use-cases)

You can adjust memory settings based on your agent’s needs:

```nextra-code [counter-reset:line]
// Customer support agent with minimal context
await agent.stream("What are your store hours?", {
  threadId,
  resourceId,
  memoryOptions: {
    lastMessages: 5, // Quick responses need minimal conversation history
    semanticRecall: false, // no need to search through earlier messages
  },
});

// Project management agent with extensive context
await agent.stream("Update me on the project status", {
  threadId,
  resourceId,
  memoryOptions: {
    lastMessages: 50, // Maintain longer conversation history across project discussions
    semanticRecall: {
      topK: 5, // Find more relevant project details
      messageRange: 3, // Number of messages before and after each result
    },
  },
});
```

## Storage Options [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#storage-options)

Mastra currently supports several storage backends:

### LibSQL Storage [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#libsql-storage)

```nextra-code [counter-reset:line]
import { LibSQLStore } from "@mastra/core/storage/libsql";

const storage = new LibSQLStore({
  config: {
    url: "file:example.db",
  },
});
```

### PostgreSQL Storage [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#postgresql-storage)

```nextra-code [counter-reset:line]
import { PostgresStore } from "@mastra/pg";

const storage = new PostgresStore({
  host: "localhost",
  port: 5432,
  user: "postgres",
  database: "postgres",
  password: "postgres",
});
```

### Upstash KV Storage [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#upstash-kv-storage)

```nextra-code [counter-reset:line]
import { UpstashStore } from "@mastra/upstash";

const storage = new UpstashStore({
  url: "http://localhost:8089",
  token: "your_token",
});
```

## Vector Search [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#vector-search)

Mastra supports semantic search through vector embeddings. When configured with a vector store, agents can find relevant historical messages based on semantic similarity. To enable vector search:

1. Configure a vector store (currently supports PostgreSQL):

```nextra-code [counter-reset:line]
import { PgVector } from "@mastra/pg";

const vector = new PgVector(connectionString);

const memory = new Memory({ vector });
```

2. Configure embedding options:

```nextra-code [counter-reset:line]
const memory = new Memory({
  vector,
  embedder: openai.embedding("text-embedding-3-small"),
});
```

3. Enable vector search in memory configuration options:

```nextra-code [counter-reset:line]
const memory = new Memory({
  vector,
  embedder,

  options: {
    semanticRecall: {
      topK: 3, // Number of similar messages to find
      messageRange: 2, // Context around each result
    },
  },
});
```

## Using Memory in Agents [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#using-memory-in-agents)

Once configured, the memory system is automatically used by agents. Here’s how to use it:

```nextra-code [counter-reset:line]
// Initialize Agent with memory
const myAgent = new Agent({
  memory,
  // other agent options
});
// Add agent to mastra
const mastra = new Mastra({
  agents: { myAgent },
});

// Memory is automatically used in agent interactions when resourceId and threadId are added
const response = await myAgent.generate(
  "What were we discussing earlier about performance?",
  {
    resourceId: "user_123",
    threadId: "thread_456",
  },
);
```

The memory system will automatically:

1. Store all messages in the configured storage backend
2. Create vector embeddings for semantic search (if configured)
3. Inject relevant historical context into new conversations
4. Maintain conversation threads and context

## useChat() [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#usechat)

When using `useChat` from the AI SDK, you must send only the latest message or you will encounter message ordering bugs.

If the `useChat()` implementation for your framework supports `experimental_prepareRequestBody`, you can do the following:

```nextra-code
const { messages } = useChat({
  api: "api/chat",
  experimental_prepareRequestBody({ messages, id }) {
    return { message: messages.at(-1), id };
  },
});
```

This will only ever send the latest message to the server.
In your chat server endpoint you can then pass a threadId and resourceId when calling stream or generate and the agent will have access to the memory thread messages:

```nextra-code
const { messages } = await request.json();

const stream = await myAgent.stream(messages, {
  threadId,
  resourceId,
});

return stream.toDataStreamResponse();
```

If the `useChat()` for your framework (svelte for example) doesn’t support `experimental_prepareRequestBody`, you can pick and use the last message before calling stream or generate:

```nextra-code
const { messages } = await request.json();

const stream = await myAgent.stream([messages.at(-1)], {
  threadId,
  resourceId,
});

return stream.toDataStreamResponse();
```

See the [AI SDK documentation on message persistence](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-message-persistence) for more information.

## Manually Managing Threads [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#manually-managing-threads)

While threads are automatically managed when using agent methods, you can also manually manage threads using the memory API directly. This is useful for advanced use cases like:

- Creating threads before starting conversations
- Managing thread metadata
- Explicitly saving or retrieving messages
- Cleaning up old threads

Here’s how to manually work with threads:

```nextra-code [counter-reset:line]
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

// Initialize memory
const memory = new Memory({
  storage: new PostgresStore({
    host: "localhost",
    port: 5432,
    user: "postgres",
    database: "postgres",
    password: "postgres",
  }),
});

// Create a new thread
const thread = await memory.createThread({
  resourceId: "user_123",
  title: "Project Discussion",
  metadata: {
    project: "mastra",
    topic: "architecture",
  },
});

// Manually save messages to a thread
await memory.saveMessages({
  messages: [\
    {\
      id: "msg_1",\
      threadId: thread.id,\
      role: "user",\
      content: "What's the project status?",\
      createdAt: new Date(),\
      type: "text",\
    },\
  ],
});

// Get messages from a thread with various filters
const messages = await memory.query({
  threadId: thread.id,
  selectBy: {
    last: 10, // Get last 10 messages
    vectorSearchString: "performance", // Find messages about performance
  },
});

// Get thread by ID
const existingThread = await memory.getThreadById({
  threadId: "thread_123",
});

// Get all threads for a resource
const threads = await memory.getThreadsByResourceId({
  resourceId: "user_123",
});

// Update thread metadata
await memory.updateThread({
  id: thread.id,
  title: "Updated Project Discussion",
  metadata: {
    status: "completed",
  },
});

// Delete a thread and all its messages
await memory.deleteThread(thread.id);
```

Note that in most cases, you won’t need to manage threads manually since the agent’s `generate()` and `stream()` methods handle thread management automatically. Manual thread management is primarily useful for advanced use cases or when you need more fine-grained control over the conversation history.

## Working Memory [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#working-memory)

Working memory is a powerful feature that allows agents to maintain persistent information across conversations, even with minimal context. This is particularly useful for remembering user preferences, personal details, or any other contextual information that should persist throughout interactions.

Inspired by the working memory concept from the MemGPT whitepaper, our implementation improves upon it in several key ways:

- No extra roundtrips or tool calls required
- Full support for streaming messages
- Seamless integration with the agent’s natural response flow

#### How It Works [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#how-it-works)

Working memory operates through a system of XML tags and automatic updates:

1. **Template Structure**: Define what information should be remembered using XML tags. The Memory class comes with a comprehensive default template for user information, or you can create your own template to match your specific needs.

2. **Automatic Updates**: The Memory class injects special instructions into the agent’s system prompt that tell it to:
   - Store relevant information by including `<working_memory>...</working_memory>` tags in its responses
   - Update information proactively when anything changes
   - Maintain the XML structure while updating values
   - Keep this process invisible to users
3. **Memory Management**: The system:
   - Extracts working memory blocks from agent responses
   - Stores them for future use
   - Injects working memory into the system prompt on the next agent call

The agent is instructed to be proactive about storing information - if there’s any doubt about whether something might be useful later, it should be stored. This helps maintain conversation context even when using very small context windows.

#### Basic Usage [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#basic-usage)

```nextra-code [counter-reset:line]
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "Customer Service",
  instructions:
    "You are a helpful customer service agent. Remember customer preferences and past interactions.",
  model: openai("gpt-4o-mini"),

  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true, // enables working memory
      },
      lastMessages: 5, // Only keep recent context
    },
  }),
});
```

Working memory becomes particularly powerful when combined with specialized system prompts. For example, you could create a TODO list manager that maintains state even though it only has access to the previous message:

```nextra-code [counter-reset:line]
const todoAgent = new Agent({
  name: "TODO Manager",
  instructions:
    "You are a TODO list manager. Update the todo list in working memory whenever tasks are added, completed, or modified.",
  model: openai("gpt-4o-mini"),
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,

        // optional XML-like template to encourage agent to store specific kinds of info.
        // if you leave this out a default template will be used
        template: `<todos>
  <in-progress></in-progress>
  <pending></pending>
  <completed></completed>
</todos>`,
      },
      lastMessages: 1, // Only keep the last message in context
    },
  }),
});
```

### Handling Memory Updates in Streaming [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#handling-memory-updates-in-streaming)

When an agent responds, it includes working memory updates directly in its response stream. These updates appear as XML blocks in the text:

```nextra-code [counter-reset:line]
// Raw agent response stream:
Let me help you with that! <working_memory><user><first_name>John</first_name>...</user></working_memory> Based on your question...
```

To prevent these memory blocks from being visible to users while still allowing the system to process them, use the `maskStreamTags` utility:

```nextra-code [counter-reset:line]
import { maskStreamTags } from "@mastra/core/utils";

// Basic usage - just mask the working_memory tags
for await (const chunk of maskStreamTags(
  response.textStream,
  "working_memory",
)) {
  process.stdout.write(chunk);
}

// Without masking: "Let me help you! <working_memory>...</working_memory> Based on..."
// With masking: "Let me help you! Based on..."
```

You can also hook into memory update events:

```nextra-code [counter-reset:line]
const maskedStream = maskStreamTags(response.textStream, "working_memory", {
  onStart: () => showLoadingSpinner(),
  onEnd: () => hideLoadingSpinner(),
  onMask: (chunk) => console.debug(chunk),
});
```

The `maskStreamTags` utility:

- Removes content between specified XML tags in a streaming response
- Optionally provides lifecycle callbacks for memory updates
- Handles tags that might be split across stream chunks

### Accessing Thread and Resource IDs in Tools [Permalink for this section](https://mastra.ai/docs/agents/01-agent-memory\#accessing-thread-and-resource-ids-in-tools)

When creating custom tools, you can access the `threadId` and `resourceId` directly in the tool’s execute function. These parameters are automatically provided by the Mastra runtime:

```nextra-code [counter-reset:line]
import { Memory } from "@mastra/memory";
const memory = new Memory();

const myTool = createTool({
  id: "Thread Info Tool",
  inputSchema: z.object({
    fetchMessages: z.boolean().optional(),
  }),
  description: "A tool that demonstrates accessing thread and resource IDs",
  execute: async ({ threadId, resourceId, context }) => {
    // threadId and resourceId are directly available in the execute parameters
    console.log(`Executing in thread ${threadId}`);

    if (!context.fetchMessages) {
      return { threadId, resourceId };
    }

    const recentMessages = await memory.query({
      threadId,
      selectBy: { last: 5 },
    });

    return {
      threadId,
      resourceId,
      messageCount: recentMessages.length,
    };
  },
});
```

This allows tools to:

- Access the current conversation context
- Store or retrieve thread-specific data
- Associate tool actions with specific users/resources
- Maintain state across multiple tool invocations

Last updated on March 11, 2025

[Overview](https://mastra.ai/docs/agents/00-overview "Overview") [Tools](https://mastra.ai/docs/agents/02-adding-tools "Tools")

## Braintrust Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") Observability [Providers](https://mastra.ai/docs/reference/observability/providers "Providers") Braintrust

# Braintrust

Braintrust is an evaluation and monitoring platform for LLM applications.

## Configuration [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/braintrust\#configuration)

To use Braintrust with Mastra, configure these environment variables:

```nextra-code
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.braintrust.dev/otel
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <Your API Key>, x-bt-parent=project_id:<Your Project ID>"
```

## Implementation [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/braintrust\#implementation)

Here’s how to configure Mastra to use Braintrust:

```nextra-code
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-service-name",
    enabled: true,
    export: {
      type: "otlp",
    },
  },
});
```

## Dashboard [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/braintrust\#dashboard)

Access your Braintrust dashboard at [braintrust.dev](https://www.braintrust.dev/)

Last updated on March 11, 2025

[SigNoz](https://mastra.ai/docs/reference/observability/providers/signoz "SigNoz") [LangSmith](https://mastra.ai/docs/reference/observability/providers/langsmith "LangSmith")

## Suspend and Resume Workflows
[Docs](https://mastra.ai/docs "Docs") [Workflows](https://mastra.ai/docs/workflows/00-overview "Workflows") Suspend & Resume

# Suspend and Resume in Workflows

Complex workflows often need to pause execution while waiting for external input or resources.

Mastra’s suspend and resume features let you pause workflow execution at any step, persist the workflow state, and continue when ready.

## When to Use Suspend/Resume [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#when-to-use-suspendresume)

Common scenarios for suspending workflows include:

- Waiting for human approval or input
- Pausing until external API resources become available
- Collecting additional data needed for later steps
- Rate limiting or throttling expensive operations

## Basic Suspend Example [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#basic-suspend-example)

Here’s a simple workflow that suspends when a value is too low and resumes when given a higher value:

```nextra-code
const stepTwo = new Step({
  id: "stepTwo",
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  execute: async ({ context, suspend }) => {
    if (context.steps.stepOne.status !== "success") {
      return { incrementedValue: 0 };
    }

    const currentValue = context.steps.stepOne.output.doubledValue;

    if (currentValue < 100) {
      await suspend();
      return { incrementedValue: 0 };
    }
    return { incrementedValue: currentValue + 1 };
  },
});
```

## Async/Await Based Flow [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#asyncawait-based-flow)

The suspend and resume mechanism in Mastra uses an async/await pattern that makes it intuitive to implement complex workflows with suspension points. The code structure naturally reflects the execution flow.

### How It Works [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#how-it-works)

1. A step’s execution function receives a `suspend` function in its parameters
2. When called with `await suspend()`, the workflow pauses at that point
3. The workflow state is persisted
4. Later, the workflow can be resumed by calling `workflow.resume()` with the appropriate parameters
5. Execution continues from the point after the `suspend()` call

### Example with Multiple Suspension Points [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#example-with-multiple-suspension-points)

Here’s an example of a workflow with multiple steps that can suspend:

```nextra-code
// Define steps with suspend capability
const promptAgentStep = new Step({
  id: 'promptAgent',
  execute: async ({ context, suspend }) => {
    // Some condition that determines if we need to suspend
    if (needHumanInput) {
      // Optionally pass payload data that will be stored with suspended state
      await suspend({ requestReason: 'Need human input for prompt' });
      // Code after suspend() will execute when the step is resumed
      return { modelOutput: context.userInput };
    }
    return { modelOutput: 'AI generated output' };
  },
  outputSchema: z.object({ modelOutput: z.string() }),
});

const improveResponseStep = new Step({
  id: 'improveResponse',
  execute: async ({ context, suspend }) => {
    // Another condition for suspension
    if (needFurtherRefinement) {
      await suspend();
      return { improvedOutput: context.refinedOutput };
    }
    return { improvedOutput: 'Improved output' };
  },
  outputSchema: z.object({ improvedOutput: z.string() }),
});

// Build the workflow
const workflow = new Workflow({
  name: 'multi-suspend-workflow',
  triggerSchema: z.object({ input: z.string() }),
});

workflow
  .step(getUserInput)
  .then(promptAgentStep)
  .then(evaluateTone)
  .then(improveResponseStep)
  .then(evaluateImproved)
  .commit();
```

### Starting and Resuming the Workflow [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#starting-and-resuming-the-workflow)

```nextra-code
// Get the workflow and create a run
const wf = mastra.getWorkflow('multi-suspend-workflow');
const run = wf.createRun();

// Start the workflow
const initialResult = await run.start({ triggerData: { input: 'initial input' } });

let promptAgentStepResult = initialResult.activePaths.get('promptAgent');
let promptAgentResumeResult = undefined;

// Check if a step is suspended
if (promptAgentStepResult?.status === 'suspended') {
  console.log('Workflow suspended at promptAgent step');

  // Resume the workflow with new context
  const resumeResult = await wf.resume({
    runId: run.runId,
    stepId: 'promptAgent',
    context: { userInput: 'Human provided input' }
  });

  promptAgentResumeResult = resumeResult;
}

const improveResponseStepResult = promptAgentResumeResult?.activePaths.get('improveResponse');

if (improveResponseStepResult?.status === 'suspended') {
  console.log('Workflow suspended at improveResponse step');

  // Resume again with different context
  const finalResult = await wf.resume({
    runId: run.runId,
    stepId: 'improveResponse',
    context: { refinedOutput: 'Human refined output' }
  });

  console.log('Workflow completed:', finalResult?.results);
}
```

### Key Points About Suspend and Resume [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#key-points-about-suspend-and-resume)

- The `suspend()` function can optionally take a payload object that will be stored with the suspended state
- Code after the `await suspend()` call will not execute until the step is resumed
- When a step is suspended, its status becomes `'suspended'` in the workflow results
- When resumed, the step’s status changes from `'suspended'` to `'success'` once completed
- The `resume()` method requires the `runId` and `stepId` to identify which suspended step to resume
- You can provide new context data when resuming that will be merged with existing step results

## Watching and Resuming [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#watching-and-resuming)

To handle suspended workflows, use the `watch` method to monitor workflow status and `resume` to continue execution:

```nextra-code
import { mastra } from "./index";

// Get the workflow
const myWorkflow = mastra.getWorkflow('myWorkflow');
const { runId, start } = myWorkflow.createRun();

// Start watching the workflow before executing it
myWorkflow.watch(async ({ context, activePaths }) => {
  for (const _path of activePaths) {
    const stepTwoStatus = context.steps?.stepTwo?.status;
    if (stepTwoStatus === 'suspended') {
      console.log("Workflow suspended, resuming with new value");

      // Resume the workflow with new context
      await myWorkflow.resume({
        runId,
        stepId: 'stepTwo',
        context: { secondValue: 100 },
      });
    }
  }
})

// Start the workflow execution
await start({ triggerData: { inputValue: 45 } });
```

## Related Resources [Permalink for this section](https://mastra.ai/docs/workflows/suspend-and-resume\#related-resources)

- See the [Suspend and Resume Example](https://mastra.ai/examples/workflows/suspend-and-resume) for a complete working example
- Check the [Step Class Reference](https://mastra.ai/docs/reference/workflows/step-class) for suspend/resume API details
- Review [Workflow Observability](https://mastra.ai/docs/reference/observability/otel-config) for monitoring suspended workflows

Last updated on March 11, 2025

[Variables](https://mastra.ai/docs/workflows/variables "Variables") [Overview](https://mastra.ai/docs/rag/overview "Overview")

## Custom Evaluations Guide
[Docs](https://mastra.ai/docs "Docs") [Evals](https://mastra.ai/docs/evals/00-overview "Evals") Custom Evals

# Create your own Eval

Creating your own eval is as easy as creating a new function. You simply create a class that extends the `Metric` class and implement the `measure` method.

## Basic example [Permalink for this section](https://mastra.ai/docs/evals/02-custom-eval\#basic-example)

Here is a very basic example of a custom eval that checks if the output contains a certain keyword. This is a simplified version of our own [keyword coverage eval](https://mastra.ai/docs/reference/evals/keyword-coverage).

src/mastra/evals/keyword-coverage.ts

```nextra-code [counter-reset:line]
import { Metric, type MetricResult } from '@mastra/core/eval';

interface KeywordCoverageResult extends MetricResult {
  info: {
    totalKeywords: number;
    matchedKeywords: number;
  };
}

export class KeywordCoverageMetric extends Metric {
  private referenceKeywords: Set<string>;

  constructor(keywords: string[]) {
    super();
    this.referenceKeywords = new Set(keywords);
  }

  async measure(input: string, output: string): Promise<KeywordCoverageResult> {
    // Handle empty strings case
    if (!input && !output) {
      return {
        score: 1,
        info: {
          totalKeywords: 0,
          matchedKeywords: 0,
        },
      };
    }

    const matchedKeywords = [...this.referenceKeywords].filter(k => output.includes(k));
    const totalKeywords = this.referenceKeywords.size;
    const coverage = totalKeywords > 0 ? matchedKeywords.length / totalKeywords : 0;

    return {
      score: coverage,
      info: {
        totalKeywords: this.referenceKeywords.size,
        matchedKeywords: matchedKeywords.length,
      },
    };
  }
}
```

## Creating a custom LLM-Judge [Permalink for this section](https://mastra.ai/docs/evals/02-custom-eval\#creating-a-custom-llm-judge)

A custom LLM judge can provide more targeted and meaningful evaluations for your use case. For example, if you’re building a medical Q&A system, you might want to evaluate not just answer relevancy but also medical accuracy and safety considerations.

Let’s create an example to make sure our [Chef Michel](https://mastra.ai/docs/guides/01-chef-michel) is giving complete recipe information to the user.

We’ll start with creating the judge agent. You can put it all in one file but we prefer splitting it into a separate file to keep things readable.

src/mastra/evals/recipe-completeness/metricJudge.ts

```nextra-code [counter-reset:line]
import { type LanguageModel } from '@mastra/core/llm';
import { MastraAgentJudge } from '@mastra/evals/judge';
import { z } from 'zod';

import { RECIPE_COMPLETENESS_INSTRUCTIONS, generateCompletenessPrompt, generateReasonPrompt } from './prompts';

export class RecipeCompletenessJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Recipe Completeness', RECIPE_COMPLETENESS_INSTRUCTIONS, model);
  }

  async evaluate(
    input: string,
    output: string,
  ): Promise<{
    missing: string[];
    verdict: string;
  }> {
    const completenessPrompt = generateCompletenessPrompt({ input, output });
    const result = await this.agent.generate(completenessPrompt, {
      output: z.object({
        missing: z.array(z.string()),
        verdict: z.string(),
      }),
    });

    return result.object;
  }

  async getReason(args: {
    input: string;
    output: string;
    missing: string[];
    verdict: string;
  }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }
}
```

src/mastra/evals/recipe-completeness/index.ts

```nextra-code [counter-reset:line]
import { Metric, type MetricResult } from '@mastra/core/eval';
import { type LanguageModel } from '@mastra/core/llm';

import { RecipeCompletenessJudge } from './metricJudge';

export interface RecipeCompletenessMetricOptions {
  scale?: number;
}

export interface MetricResultWithInfo extends MetricResult {
  info: {
    reason: string;
    missing: string[];
  };
}

export class RecipeCompletenessMetric extends Metric {
  private judge: RecipeCompletenessJudge;
  private scale: number;
  constructor(model: LanguageModel, { scale = 1 }: RecipeCompletenessMetricOptions = {}) {
    super();

    this.judge = new RecipeCompletenessJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithInfo> {
    const { verdict, missing } = await this.judge.evaluate(input, output);
    const score = this.calculateScore({ verdict });
    const reason = await this.judge.getReason({
      input,
      output,
      verdict,
      missing,
    });

    return {
      score,
      info: {
        missing,
        reason,
      },
    };
  }

  private calculateScore(verdict: { verdict: string }): number {
    return verdict.verdict.toLowerCase() === 'incomplete' ? 0 : 1;
  }
}
```

src/mastra/agents/chefAgent.ts

```nextra-code [counter-reset:line]
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { RecipeCompletenessMetric } from '../evals';

export const chefAgent = new Agent({
  name: 'chef-agent',
  instructions:
    'You are Michel, a practical and experienced home chef' +
    'You help people cook with whatever ingredients they have available.',
  model: openai('gpt-4o-mini'),
  evals: {
    recipeCompleteness: new RecipeCompletenessMetric(openai('gpt-4o-mini')),
  },
});
```

You can now use the `RecipeCompletenessMetric` in your project. [See the full example here](https://mastra.ai/examples/evals/custom-eval).

Last updated on March 11, 2025

[Supported Evals](https://mastra.ai/docs/evals/01-supported-evals "Supported Evals") [Overview](https://mastra.ai/docs/reference "Overview")

## OpenTelemetry Configuration
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Observability](https://mastra.ai/docs/reference/observability/providers "Observability") OTelConfig

# `OtelConfig`

The `OtelConfig` object is used to configure OpenTelemetry instrumentation, tracing, and exporting behavior within your application. By adjusting its properties, you can control how telemetry data (such as traces) is collected, sampled, and exported.

To use the `OtelConfig` within Mastra, pass it as the value of the `telemetry` key when initializing Mastra. This will configure Mastra to use your custom OpenTelemetry settings for tracing and instrumentation.

```nextra-code [counter-reset:line]
import { Mastra } from 'mastra';

const otelConfig: OtelConfig = {
  serviceName: 'my-awesome-service',
  enabled: true,
  sampling: {
    type: 'ratio',
    probability: 0.5,
  },
  export: {
    type: 'otlp',
    endpoint: 'https://otel-collector.example.com/v1/traces',
    headers: {
      Authorization: 'Bearer YOUR_TOKEN_HERE',
    },
  },
};
```

### Properties [Permalink for this section](https://mastra.ai/docs/reference/observability/otel-config\#properties)

### serviceName?:

string

Human-readable name used to identify your service in telemetry backends.

### enabled?:

boolean

Whether telemetry collection and export are enabled.

### sampling?:

SamplingStrategy

Defines the sampling strategy for traces, controlling how much data is collected.

'ratio' \| 'always\_on' \| 'always\_off' \| 'parent\_based'

number (0.0 to 1.0)

object

### export?:

object

Configuration for exporting collected telemetry data.

'otlp' \| 'console'

string

Record<string, string>

Last updated on March 11, 2025

[Logger](https://mastra.ai/docs/reference/observability/logger "Logger") [.createLogger()](https://mastra.ai/docs/reference/observability/create-logger ".createLogger()")

## SigNoz Observability
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") Observability [Providers](https://mastra.ai/docs/reference/observability/providers "Providers") SigNoz

# SigNoz

SigNoz is an open-source APM and observability platform that provides full-stack monitoring capabilities through OpenTelemetry.

## Configuration [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/signoz\#configuration)

To use SigNoz with Mastra, configure these environment variables:

```nextra-code
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.{region}.signoz.cloud:443
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=your_signoz_token
```

## Implementation [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/signoz\#implementation)

Here’s how to configure Mastra to use SigNoz:

```nextra-code
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-service-name",
    enabled: true,
    export: {
      type: "otlp",
    },
  },
});
```

## Dashboard [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/signoz\#dashboard)

Access your SigNoz dashboard at [signoz.io](https://signoz.io/)

Last updated on March 11, 2025

[Overview](https://mastra.ai/docs/reference/observability/providers "Overview") [Braintrust](https://mastra.ai/docs/reference/observability/providers/braintrust "Braintrust")

## Step Class Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows") Step

# Step

The Step class defines individual units of work within a workflow, encapsulating execution logic, data validation, and input/output handling.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-class\#usage)

```nextra-code
const processOrder = new Step({
  id: "processOrder",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string()
  }),
  outputSchema: z.object({
    status: z.string(),
    orderId: z.string()
  }),
  execute: async ({ context, runId }) => {
    return {
      status: "processed",
      orderId: context.orderId
    };
  }
});
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-class\#constructor-parameters)

### id:

string

Unique identifier for the step

### inputSchema:

z.ZodSchema

Zod schema to validate input data before execution

### outputSchema:

z.ZodSchema

Zod schema to validate step output data

### payload:

Record<string, any>

Static data to be merged with variables

### execute:

(params: ExecuteParams) => Promise<any>

Async function containing step logic

### ExecuteParams [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-class\#executeparams)

### context:

StepContext

Access to workflow context and step results

### runId:

string

Unique identifier for current workflow run

### suspend:

() =\> Promise<void>

Function to suspend step execution

### mastra:

Mastra

Access to Mastra instance

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-class\#related)

- [Workflow Reference](https://mastra.ai/docs/reference/workflows/workflow)
- [Step Configuration Guide](https://mastra.ai/docs/workflows/steps)
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow)

```nextra-code

```

Last updated on March 11, 2025

[Workflow](https://mastra.ai/docs/reference/workflows/workflow "Workflow") [StepOptions](https://mastra.ai/docs/reference/workflows/step-options "StepOptions")

## Textual Difference Metric
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Evals](https://mastra.ai/docs/reference/evals/answer-relevancy "Evals") TextualDifference

# TextualDifferenceMetric

The `TextualDifferenceMetric` class uses sequence matching to measure the textual differences between two strings. It provides detailed information about changes, including the number of operations needed to transform one text into another.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#basic-usage)

```nextra-code
import { TextualDifferenceMetric } from "@mastra/evals/nlp";

const metric = new TextualDifferenceMetric();

const result = await metric.measure(
  "The quick brown fox",
  "The fast brown fox"
);

console.log(result.score); // Similarity ratio from 0-1
console.log(result.info); // Detailed change metrics
```

## measure() Parameters [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#measure-parameters)

### input:

string

The original text to compare against

### output:

string

The text to evaluate for differences

## Returns [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#returns)

### score:

number

Similarity ratio (0-1) where 1 indicates identical texts

### info:

Detailed metrics about the differences

number

### confidence:

number

Confidence score based on length difference between texts (0-1)

number

### ratio:

number

Raw similarity ratio between the texts

number

### changes:

number

Number of change operations (insertions, deletions, replacements)

number

### lengthDiff:

number

Normalized difference in length between input and output (0-1)

## Scoring Details [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#scoring-details)

The metric calculates several measures:

- **Similarity Ratio**: Based on sequence matching between texts (0-1)
- **Changes**: Count of non-matching operations needed
- **Length Difference**: Normalized difference in text lengths
- **Confidence**: Inversely proportional to length difference

### Scoring Process [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#scoring-process)

1. Analyzes textual differences:
   - Performs sequence matching between input and output
   - Counts the number of change operations required
   - Measures length differences
2. Calculates metrics:
   - Computes similarity ratio
   - Determines confidence score
   - Combines into weighted score

Final score: `(similarity_ratio * confidence) * scale`

### Score interpretation [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#score-interpretation)

(0 to scale, default 0-1)

- 1.0: Identical texts - no differences
- 0.7-0.9: Minor differences - few changes needed
- 0.4-0.6: Moderate differences - significant changes
- 0.1-0.3: Major differences - extensive changes
- 0.0: Completely different texts

## Example with Analysis [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#example-with-analysis)

```nextra-code
import { TextualDifferenceMetric } from "@mastra/evals/nlp";

const metric = new TextualDifferenceMetric();

const result = await metric.measure(
  "Hello world! How are you?",
  "Hello there! How is it going?"
);

// Example output:
// {
//   score: 0.65,
//   info: {
//     confidence: 0.95,
//     ratio: 0.65,
//     changes: 2,
//     lengthDiff: 0.05
//   }
// }
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/evals/textual-difference\#related)

- [Content Similarity Metric](https://mastra.ai/docs/reference/evals/content-similarity)
- [Completeness Metric](https://mastra.ai/docs/reference/evals/completeness)
- [Keyword Coverage Metric](https://mastra.ai/docs/reference/evals/keyword-coverage)

Last updated on March 11, 2025

[Summarization](https://mastra.ai/docs/reference/evals/summarization "Summarization") [ToneConsistency](https://mastra.ai/docs/reference/evals/tone-consistency "ToneConsistency")

## Metadata Filters Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [RAG](https://mastra.ai/docs/reference/rag/chunk "RAG") Metadata Filters

# Metadata Filters

Mastra provides a unified metadata filtering syntax across all vector stores, based on MongoDB/Sift query syntax. Each vector store translates these filters into their native format.

## Basic Example [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#basic-example)

```nextra-code
import { PgVector } from '@mastra/pg';

const store = new PgVector(connectionString);

const results = await store.query({
  indexName: "my_index",
  queryVector: queryVector,
  topK: 10,
  filter: {
    category: "electronics",  // Simple equality
    price: { $gt: 100 },     // Numeric comparison
    tags: { $in: ["sale", "new"] }  // Array membership
  }
});
```

## Supported Operators [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#supported-operators)

### Basic Comparison

| Operator | Description | Example | Supported By |
| --- | --- | --- | --- |
| `$eq` | Matches values equal to specified value | ```<br>{<br>  age: {<br>    $eq: 25<br>  }<br>}<br>``` | All |
| `$ne` | Matches values not equal | ```<br>{<br>  status: {<br>    $ne: 'inactive'<br>  }<br>}<br>``` | All |
| `$gt` | Greater than | ```<br>{<br>  price: {<br>    $gt: 100<br>  }<br>}<br>``` | All |
| `$gte` | Greater than or equal | ```<br>{<br>  rating: {<br>    $gte: 4.5<br>  }<br>}<br>``` | All |
| `$lt` | Less than | ```<br>{<br>  stock: {<br>    $lt: 20<br>  }<br>}<br>``` | All |
| `$lte` | Less than or equal | ```<br>{<br>  priority: {<br>    $lte: 3<br>  }<br>}<br>``` | All |

### Array Operators

| Operator | Description | Example | Supported By |
| --- | --- | --- | --- |
| `$in` | Matches any value in array | ```<br>{<br>  category: {<br>    $in: ["A", "B"]<br>  }<br>}<br>``` | All |
| `$nin` | Matches none of the values | ```<br>{<br>  status: {<br>    $nin: ["deleted", "archived"]<br>  }<br>}<br>``` | All |
| `$all` | Matches arrays containing all elements | ```<br>{<br>  tags: {<br>    $all: ["urgent", "high"]<br>  }<br>}<br>``` | AstraPineconeUpstash |
| `$elemMatch` | Matches array elements meeting criteria | ```<br>{<br>  scores: {<br>    $elemMatch<br>  }<br>}<br>``` | LibSQLPgVector |

### Logical Operators

| Operator | Description | Example | Supported By |
| --- | --- | --- | --- |
| `$and` | Logical AND | ```<br>{<br>  $and: [<br>    { price: { $gt: 100 } },<br>    { stock: { $gt: 0 } } }<br>  ]<br>}<br>``` | All except Vectorize |
| `$or` | Logical OR | ```<br>{<br>  $or: [<br>    { status: "active" },<br>    { priority: "high" } }<br>  ]<br>}<br>``` | All except Vectorize |
| `$not` | Logical NOT | ```<br>{<br>  price: {<br>    $not<br>  }<br>}<br>``` | AstraQdrantUpstashPgVectorLibSQL |
| `$nor` | Logical NOR | ```<br>{<br>  $nor: [<br>    { status: "deleted" },<br>    { archived: true } }<br>  ]<br>}<br>``` | QdrantUpstashPgVectorLibSQL |

### Element Operators

| Operator | Description | Example | Supported By |
| --- | --- | --- | --- |
| `$exists` | Matches documents with field | ```<br>{<br>  rating: {<br>    $exists: true<br>  }<br>}<br>``` | All except Vectorize, Chroma |

### Custom Operators

| Operator | Description | Example | Supported By |
| --- | --- | --- | --- |
| `$contains` | Text contains substring | ```<br>{<br>  description: {<br>    $contains: "sale"<br>  }<br>}<br>``` | UpstashLibSQLPgVector |
| `$regex` | Regular expression match | ```<br>{<br>  name: {<br>    $regex: "^test"<br>  }<br>}<br>``` | QdrantPgVectorUpstash |
| `$size` | Array length check | ```<br>{<br>  tags: {<br>    $size<br>  }<br>}<br>``` | AstraLibSQLPgVector |
| `$geo` | Geospatial query | ```<br>{<br>  location: {<br>    $geo<br>  }<br>}<br>``` | Qdrant |
| `$datetime` | Datetime range query | ```<br>{<br>  created: {<br>    $datetime<br>  }<br>}<br>``` | Qdrant |
| `$hasId` | Vector ID existence check | ```<br>{<br>  $hasId: [<br>    { "id1", "id2" }<br>  ]<br>}<br>``` | Qdrant |
| `$hasVector` | Vector existence check | ```<br>{<br>  $hasVector: true<br>}<br>``` | Qdrant |

## Common Rules and Restrictions [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#common-rules-and-restrictions)

1. Field names cannot:
   - Contain dots (.) unless referring to nested fields
   - Start with $ or contain null characters
   - Be empty strings
2. Values must be:
   - Valid JSON types (string, number, boolean, object, array)
   - Not undefined
   - Properly typed for the operator (e.g., numbers for numeric comparisons)
3. Logical operators:
   - Must contain valid conditions
   - Cannot be empty
   - Must be properly nested
   - Can only be used at top level or nested within other logical operators
   - Cannot be used at field level or nested inside a field
   - Cannot be used inside an operator
   - Valid: `{ "$and": [{ "field": { "$gt": 100 } }] }`
   - Valid: `{ "$or": [{ "$and": [{ "field": { "$gt": 100 } }] }] }`
   - Invalid: `{ "field": { "$and": [{ "$gt": 100 }] } }`
   - Invalid: `{ "field": { "$gt": { "$and": [{...}] } } }`
4. $not operator:
   - Must be an object
   - Cannot be empty
   - Can be used at field level or top level
   - Valid: `{ "$not": { "field": "value" } }`
   - Valid: `{ "field": { "$not": { "$eq": "value" } } }`
5. Operator nesting:
   - Logical operators must contain field conditions, not direct operators
   - Valid: `{ "$and": [{ "field": { "$gt": 100 } }] }`
   - Invalid: `{ "$and": [{ "$gt": 100 }] }`

## Store-Specific Notes [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#store-specific-notes)

### Astra [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#astra)

- Nested field queries are supported using dot notation
- Array fields must be explicitly defined as arrays in the metadata
- Metadata values are case-sensitive

### ChromaDB [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#chromadb)

- Where filters only return results where the filtered field exists in metadata
- Empty metadata fields are not included in filter results
- Metadata fields must be present for negative matches (e.g., $ne won’t match documents missing the field)

### Cloudflare Vectorize [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#cloudflare-vectorize)

- Requires explicit metadata indexing before filtering can be used
- Use `createMetadataIndex()` to index fields you want to filter on
- Up to 10 metadata indexes per Vectorize index
- String values are indexed up to first 64 bytes (truncated on UTF-8 boundaries)
- Number values use float64 precision
- Filter JSON must be under 2048 bytes
- Field names cannot contain dots (.) or start with $
- Field names limited to 512 characters
- Vectors must be re-upserted after creating new metadata indexes to be included in filtered results
- Range queries may have reduced accuracy with very large datasets (~10M+ vectors)

### LibSQL [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#libsql)

- Supports nested object queries with dot notation
- Array fields are validated to ensure they contain valid JSON arrays
- Numeric comparisons maintain proper type handling
- Empty arrays in conditions are handled gracefully
- Metadata is stored in a JSONB column for efficient querying

### PgVector [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#pgvector)

- Full support for PostgreSQL’s native JSON querying capabilities
- Efficient handling of array operations using native array functions
- Proper type handling for numbers, strings, and booleans
- Nested field queries use PostgreSQL’s JSON path syntax internally
- Metadata is stored in a JSONB column for efficient indexing

### Pinecone [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#pinecone)

- Metadata field names are limited to 512 characters
- Numeric values must be within the range of ±1e38
- Arrays in metadata are limited to 64KB total size
- Nested objects are flattened with dot notation
- Metadata updates replace the entire metadata object

### Qdrant [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#qdrant)

- Supports advanced filtering with nested conditions
- Payload (metadata) fields must be explicitly indexed for filtering
- Efficient handling of geo-spatial queries
- Special handling for null and empty values
- Vector-specific filtering capabilities
- Datetime values must be in RFC 3339 format

### Upstash [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#upstash)

- 512-character limit for metadata field keys
- Query size is limited (avoid large IN clauses)
- No support for null/undefined values in filters
- Translates to SQL-like syntax internally
- Case-sensitive string comparisons
- Metadata updates are atomic

## Related [Permalink for this section](https://mastra.ai/docs/reference/rag/metadata-filters\#related)

- [Astra](https://mastra.ai/docs/reference/rag/astra)
- [Chroma](https://mastra.ai/docs/reference/rag/chroma)
- [Cloudflare Vectorize](https://mastra.ai/docs/reference/rag/vectorize)
- [LibSQL](https://mastra.ai/docs/reference/rag/libsql)
- [PgStore](https://mastra.ai/docs/reference/rag/pg)
- [Pinecone](https://mastra.ai/docs/reference/rag/pinecone)
- [Qdrant](https://mastra.ai/docs/reference/rag/qdrant)
- [Upstash](https://mastra.ai/docs/reference/rag/upstash)

Last updated on March 11, 2025

[MDocument](https://mastra.ai/docs/reference/rag/document "MDocument") [GraphRAG](https://mastra.ai/docs/reference/rag/graph-rag "GraphRAG")

## Workflow Step Options
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows") StepOptions

# StepOptions

Configuration options for workflow steps that control variable mapping, execution conditions, and other runtime behavior.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-options\#usage)

```nextra-code
workflow.step(processOrder, {
  variables: {
    orderId: { step: 'trigger', path: 'id' },
    userId: { step: 'auth', path: 'user.id' }
  },
  when: {
    ref: { step: 'auth', path: 'status' },
    query: { $eq: 'authenticated' }
  }
});
```

## Properties [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-options\#properties)

### variables?:

Record<string, VariableRef>

Maps step input variables to values from other steps

### when?:

StepCondition

Condition that must be met for step execution

### VariableRef [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-options\#variableref)

### step:

string \| Step \| { id: string }

Source step for the variable value

### path:

string

Path to the value in the step's output

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/step-options\#related)

- [Path Comparison](https://mastra.ai/docs/workflows/control-flow#path-comparison)
- [Step Function Reference](https://mastra.ai/docs/reference/workflows/step-function)
- [Step Class Reference](https://mastra.ai/docs/reference/workflows/step-class)
- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)
- [Control Flow Guide](https://mastra.ai/docs/workflows/control-flow)

```nextra-code

```

Last updated on March 11, 2025

[Step](https://mastra.ai/docs/reference/workflows/step-class "Step") [StepCondition](https://mastra.ai/docs/reference/workflows/step-condition "StepCondition")

## Adding Tools to Agents
[Docs](https://mastra.ai/docs "Docs") [Agents](https://mastra.ai/docs/agents/00-overview "Agents") Tools

# Agent Tool Selection

Tools are typed functions that can be executed by agents or workflows, with built-in integration access and parameter validation. Each tool has a schema that defines its inputs, an executor function that implements its logic, and access to configured integrations.

## Creating Tools [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#creating-tools)

In this section, we’ll walk through the process of creating a tool that can be used by your agents. Let’s create a simple tool that fetches current weather information for a given city.

src/mastra/tools/weatherInfo.ts

```nextra-code
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const getWeatherInfo = async (city: string) => {
  // Replace with an actual API call to a weather service
  const data = await fetch(`https://api.example.com/weather?city=${city}`).then(
    (r) => r.json(),
  );
  return data;
};

export const weatherInfo = createTool({
  id: "Get Weather Information",
  inputSchema: z.object({
    city: z.string(),
  }),
  description: `Fetches the current weather information for a given city`,
  execute: async ({ context: { city } }) => {
    console.log("Using tool to fetch weather information for", city);
    return await getWeatherInfo(city);
  },
});
```

## Adding Tools to an Agent [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#adding-tools-to-an-agent)

Now we’ll add the tool to an agent. We’ll create an agent that can answer questions about the weather and configure it to use our `weatherInfo` tool.

src/mastra/agents/weatherAgent.ts

```nextra-code
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import * as tools from "../tools/weatherInfo";

export const weatherAgent = new Agent<typeof tools>({
  name: "Weather Agent",
  instructions:
    "You are a helpful assistant that provides current weather information. When asked about the weather, use the weather information tool to fetch the data.",
  model: openai("gpt-4o-mini"),
  tools: {
    weatherInfo: tools.weatherInfo,
  },
});
```

## Registering the Agent [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#registering-the-agent)

We need to initialize Mastra with our agent.

src/index.ts

```nextra-code
import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weatherAgent";

export const mastra = new Mastra({
  agents: { weatherAgent },
});
```

This registers your agent with Mastra, making it available for use.

## Debugging Tools [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#debugging-tools)

You can test tools using Vitest or any other testing framework. Writing unit tests for your tools ensures they behave as expected and helps catch errors early.

## Calling an Agent with a Tool [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#calling-an-agent-with-a-tool)

Now we can call the agent, and it will use the tool to fetch the weather information.

## Example: Interacting with the Agent [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#example-interacting-with-the-agent)

src/index.ts

```nextra-code
import { mastra } from "./index";

async function main() {
  const agent = mastra.getAgent("weatherAgent");
  const response = await agent.generate(
    "What's the weather like in New York City today?",
  );

  console.log(response.text);
}

main();
```

The agent will use the `weatherInfo` tool to get the current weather in New York City and respond accordingly.

## Vercel AI SDK Tool Format [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#vercel-ai-sdk-tool-format)

Mastra supports tools created using the Vercel AI SDK format. You can import and use these tools directly:

src/mastra/tools/vercelTool.ts

```nextra-code
import { tool } from 'ai';
import { z } from 'zod';

export const weatherInfo = tool({
  description: "Fetches the current weather information for a given city",
  parameters: z.object({
    city: z.string().describe("The city to get weather for")
  }),
  execute: async ({ city }) => {
    // Replace with actual API call
    const data = await fetch(`https://api.example.com/weather?city=${city}`);
    return data.json();
  }
});
```

You can use Vercel tools alongside Mastra tools in your agents:

src/mastra/agents/weatherAgent.ts

```nextra-code
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { weatherInfo } from "../tools/vercelTool";
import * as mastraTools from "../tools/mastraTools";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: "You are a helpful assistant that provides weather information.",
  model: openai("gpt-4"),
  tools: {
    weatherInfo,  // Vercel tool
    ...mastraTools  // Mastra tools
  },
});
```

Both tool formats will work seamlessly within your agent’s workflow.

## Tool Design Best Practices [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#tool-design-best-practices)

When creating tools for your agents, following these guidelines will help ensure reliable and intuitive tool usage:

### Tool Descriptions [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#tool-descriptions)

Your tool’s main description should focus on its purpose and value:

- Keep descriptions simple and focused on **what** the tool does
- Emphasize the tool’s primary use case
- Avoid implementation details in the main description
- Focus on helping the agent understand **when** to use the tool

```nextra-code
createTool({
  id: "documentSearch",
  description: "Access the knowledge base to find information needed to answer user questions",
  // ... rest of tool configuration
});
```

### Parameter Schemas [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#parameter-schemas)

Technical details belong in the parameter schemas, where they help the agent use the tool correctly:

- Make parameters self-documenting with clear descriptions
- Include default values and their implications
- Provide examples where helpful
- Describe the impact of different parameter choices

```nextra-code
inputSchema: z.object({
  query: z.string().describe("The search query to find relevant information"),
  limit: z.number().describe(
    "Number of results to return. Higher values provide more context, lower values focus on best matches"
  ),
  options: z.string().describe(
    "Optional configuration. Example: '{'filter': 'category=news'}'"
  ),
}),
```

### Agent Interaction Patterns [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#agent-interaction-patterns)

Tools are more likely to be used effectively when:

- Queries or tasks are complex enough to clearly require tool assistance
- Agent instructions provide clear guidance on tool usage
- Parameter requirements are well-documented in the schema
- The tool’s purpose aligns with the query’s needs

### Common Pitfalls [Permalink for this section](https://mastra.ai/docs/agents/02-adding-tools\#common-pitfalls)

- Overloading the main description with technical details
- Mixing implementation details with usage guidance
- Unclear parameter descriptions or missing examples

Following these practices helps ensure your tools are discoverable and usable by agents while maintaining clean separation between purpose (main description) and implementation details (parameter schemas).

Last updated on March 11, 2025

[Memory](https://mastra.ai/docs/agents/01-agent-memory "Memory") [Voice](https://mastra.ai/docs/agents/03-adding-voice "Voice")

## Mastra Next.js Integration
[Docs](https://mastra.ai/docs "Docs") FrameworksIntegrate with Next.js

# Integrate Mastra in your Next.js project

There are two main ways to integrate Mastra with your Next.js application: as a separate backend service or directly integrated into your Next.js app.

## 1\. Separate Backend Integration [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#1-separate-backend-integration)

Best for larger projects where you want to:

- Scale your AI backend independently
- Keep clear separation of concerns
- Have more deployment flexibility

### Create Mastra Backend [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#create-mastra-backend)

Create a new Mastra project using our CLI:

npxnpmyarnpnpm

```nextra-code
npx create-mastra@latest
```

```nextra-code
npm create mastra
```

```nextra-code
yarn create mastra
```

```nextra-code
pnpm create mastra
```

For detailed setup instructions, see our [installation guide](https://mastra.ai/docs/getting-started/installation).

### Install MastraClient [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#install--mastraclient)

npmyarnpnpm

```nextra-code
npm install @mastra/client-js
```

```nextra-code
yarn add @mastra/client-js
```

```nextra-code
pnpm add @mastra/client-js
```

### Use MastraClient [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#use-mastraclient)

Create a client instance and use it in your Next.js application:

lib/mastra.ts

```nextra-code
import { MastraClient } from '@mastra/client-js';

// Initialize the client
export const mastraClient = new MastraClient({
  baseUrl: process.env.NEXT_PUBLIC_MASTRA_API_URL || 'http://localhost:4111',
});
```

Example usage in your React component:

app/components/SimpleWeather.tsx

```nextra-code
'use client'

import { mastraClient } from '@/lib/mastra'

export function SimpleWeather() {
  async function handleSubmit(formData: FormData) {
    const city = formData.get('city')
    const agent = mastraClient.getAgent('weatherAgent')

    try {
      const response = await agent.generate({
        messages: [{ role: 'user', content: `What's the weather like in ${city}?` }],
      })
      // Handle the response
      console.log(response.text)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="city" placeholder="Enter city name" />
      <button type="submit">Get Weather</button>
    </form>
  )
}
```

### Deployment [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#deployment)

When you’re ready to deploy, you can use any of our platform-specific deployers (Vercel, Netlify, Cloudflare) or deploy to any Node.js hosting platform. Check our [deployment guide](https://mastra.ai/docs/deployment/deployment) for detailed instructions.

## 2\. Direct Integration [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#2-direct-integration)

Better for smaller projects or prototypes. This approach bundles Mastra directly with your Next.js application.

### Initialize Mastra in your Next.js Root [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#initialize-mastra-in-your-nextjs-root)

First, navigate to your Next.js project root and initialize Mastra:

```nextra-code
cd your-nextjs-app
```

Then run the initialization command:

npmyarnpnpm

```nextra-code
npx mastra@latest init
```

```nextra-code
yarn dlx mastra@latest init
```

```nextra-code
pnpm dlx mastra@latest init
```

This will set up Mastra in your Next.js project. For more details about init and other configuration options, see our [mastra init reference](https://mastra.ai/docs/reference/cli/init).

### Configure Next.js [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#configure-nextjs)

Add to your `next.config.js`:

next.config.js

```nextra-code
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@mastra/*"],
  // ... your other Next.js config
}

module.exports = nextConfig
```

#### Server Actions Example [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#server-actions-example)

app/actions.ts

```nextra-code
'use server'

import { mastra } from '@/mastra'

export async function getWeatherInfo(city: string) {
  const agent = mastra.getAgent('weatherAgent')

  const result = await agent.generate(`What's the weather like in ${city}?`)

  return result
}
```

Use it in your component:

app/components/Weather.tsx

```nextra-code
'use client'

import { getWeatherInfo } from '../actions'

export function Weather() {
  async function handleSubmit(formData: FormData) {
    const city = formData.get('city') as string
    const result = await getWeatherInfo(city)
    // Handle the result
    console.log(result)
  }

  return (
    <form action={handleSubmit}>
      <input name="city" placeholder="Enter city name" />
      <button type="submit">Get Weather</button>
    </form>
  )
}
```

#### API Routes Example [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#api-routes-example)

app/api/weather/route.ts

```nextra-code
import { mastra } from '@/mastra'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { city } = await req.json()
  const agent = mastra.getAgent('weatherAgent')

  const result = await agent.stream(`What's the weather like in ${city}?`)

  return result.toDataStreamResponse()
}
```

### Deployment [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#deployment-1)

When using direct integration, your Mastra instance will be deployed alongside your Next.js application. Ensure you:

- Set up environment variables for your LLM API keys in your deployment platform
- Implement proper error handling for production use
- Monitor your AI agent’s performance and costs

## Observability [Permalink for this section](https://mastra.ai/docs/frameworks/01-next-js\#observability)

Mastra provides built-in observability features to help you monitor, debug, and optimize your AI operations. This includes:

- Tracing of AI operations and their performance
- Logging of prompts, completions, and errors
- Integration with observability platforms like Langfuse and LangSmith

For detailed setup instructions and configuration options specific to Next.js local development, see our [Next.js Observability Configuration Guide](https://mastra.ai/docs/deployment/logging-and-tracing#nextjs-configuration).

Last updated on March 11, 2025

[Workflows: AI Recruiter](https://mastra.ai/docs/guides/03-recruiter "Workflows: AI Recruiter") [Overview](https://mastra.ai/docs/agents/00-overview "Overview")

## Mastra Class Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") CoreMastra Class

# The Mastra Class

The Mastra class is the core entry point for your application. It manages agents, workflows, and server endpoints.

## Constructor Options [Permalink for this section](https://mastra.ai/docs/reference/core/mastra-class\#constructor-options)

### agents?:

Agent\[\]

= \[\]

Array of Agent instances to register

### tools?:

Record<string, ToolApi>

= {}

Custom tools to register. Structured as a key-value pair, with keys being the tool name and values being the tool function.

### storage?:

MastraStorage

Storage engine instance for persisting data

### vectors?:

Record<string, MastraVector>

Vector store instance, used for semantic search and vector-based tools (eg Pinecone, PgVector or Qdrant)

### logger?:

Logger

= Console logger with INFO level

Logger instance created with createLogger()

### workflows?:

Record<string, Workflow>

= {}

Workflows to register. Structured as a key-value pair, with keys being the workflow name and values being the workflow instance.

### serverMiddleware?:

Array<{ handler: (c: any, next: () => Promise<void>) => Promise<Response \| void>; path?: string; }>

= \[\]

Server middleware functions to be applied to API routes. Each middleware can specify a path pattern (defaults to '/api/\*').

## Initialization [Permalink for this section](https://mastra.ai/docs/reference/core/mastra-class\#initialization)

The Mastra class is typically initialized in your `src/mastra/index.ts` file:

```nextra-code
import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";

// Basic initialization
export const mastra = new Mastra({});

// Full initialization with all options
export const mastra = new Mastra({
  agents: {},
  workflows: [],
  integrations: [],
  logger: createLogger({
    name: "My Project",
    level: "info",
  }),
  storage: {},
  tools: {},
  vectors: {},
});
```

You can think of the `Mastra` class as a top-level registry. When you register tools with Mastra, your registered agents and workflows can use them. When you register integrations with Mastra, agents, workflows, and tools can use them.

## Methods [Permalink for this section](https://mastra.ai/docs/reference/core/mastra-class\#methods)

### getAgent(name):

Agent

Returns an agent instance by id. Throws if agent not found.

### getAgents():

Record<string, Agent>

Returns all registered agents as a key-value object.

### getWorkflow(id, { serialized }):

Workflow

Returns a workflow instance by id. The serialized option (default: false) returns a simplified representation with just the name.

### getWorkflows({ serialized }):

Record<string, Workflow>

Returns all registered workflows. The serialized option (default: false) returns simplified representations.

### getVector(name):

MastraVector

Returns a vector store instance by name. Throws if not found.

### getVectors():

Record<string, MastraVector>

Returns all registered vector stores as a key-value object.

### getDeployer():

MastraDeployer \| undefined

Returns the configured deployer instance, if any.

### getStorage():

MastraStorage \| undefined

Returns the configured storage instance.

### getMemory():

MastraMemory \| undefined

Returns the configured memory instance. Note: This is deprecated, memory should be added to agents directly.

### getServerMiddleware():

Array<{ handler: Function; path: string; }>

Returns the configured server middleware functions.

### setStorage(storage):

void

Sets the storage instance for the Mastra instance.

### setLogger({ logger }):

void

Sets the logger for all components (agents, workflows, etc.).

### setTelemetry(telemetry):

void

Sets the telemetry configuration for all components.

### getLogger():

Logger

Gets the configured logger instance.

### getTelemetry():

Telemetry \| undefined

Gets the configured telemetry instance.

### getLogsByRunId({ runId, transportId }):

Promise<any>

Retrieves logs for a specific run ID and transport ID.

### getLogs(transportId):

Promise<any>

Retrieves all logs for a specific transport ID.

## Error Handling [Permalink for this section](https://mastra.ai/docs/reference/core/mastra-class\#error-handling)

The Mastra class methods throw typed errors that can be caught:

```nextra-code
try {
  const tool = mastra.getTool("nonexistentTool");
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message); // "Tool with name nonexistentTool not found"
  }
}
```

Last updated on March 11, 2025

[Overview](https://mastra.ai/docs/reference "Overview") [mastra init](https://mastra.ai/docs/reference/cli/init "mastra init")

## New Relic Configuration
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") Observability [Providers](https://mastra.ai/docs/reference/observability/providers "Providers") New Relic

# New Relic

New Relic is a comprehensive observability platform that supports OpenTelemetry (OTLP) for full-stack monitoring.

## Configuration [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/new-relic\#configuration)

To use New Relic with Mastra via OTLP, configure these environment variables:

```nextra-code
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4317
OTEL_EXPORTER_OTLP_HEADERS="api-key=your_license_key"
```

## Implementation [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/new-relic\#implementation)

Here’s how to configure Mastra to use New Relic:

```nextra-code
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-service-name",
    enabled: true,
    export: {
      type: "otlp",
    },
  },
});
```

## Dashboard [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/new-relic\#dashboard)

View your telemetry data in the New Relic One dashboard at [one.newrelic.com](https://one.newrelic.com/)

Last updated on March 11, 2025

[LangWatch](https://mastra.ai/docs/reference/observability/providers/langwatch "LangWatch") [Traceloop](https://mastra.ai/docs/reference/observability/providers/traceloop "Traceloop")

## Vector Query Tool
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Tools](https://mastra.ai/docs/reference/tools/document-chunker-tool "Tools") createVectorQueryTool()

# createVectorQueryTool()

The `createVectorQueryTool()` function creates a tool for semantic search over vector stores. It supports filtering, reranking, and integrates with various vector store backends.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#basic-usage)

```nextra-code
import { openai } from '@ai-sdk/openai';
import { createVectorQueryTool } from "@mastra/rag";

const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding('text-embedding-3-small'),
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#parameters)

### vectorStoreName:

string

Name of the vector store to query (must be configured in Mastra)

### indexName:

string

Name of the index within the vector store

### model:

EmbeddingModel

Embedding model to use for vector search

### reranker?:

RerankConfig

Options for reranking results

### id?:

string

Custom ID for the tool (defaults to 'VectorQuery {vectorStoreName} {indexName} Tool')

### description?:

string

Custom description for the tool. By default: 'Access the knowledge base to find information needed to answer user questions'

### RerankConfig [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#rerankconfig)

### model:

MastraLanguageModel

Language model to use for reranking

### options?:

RerankerOptions

Options for the reranking process

object

### weights?:

WeightConfig

Weights for scoring components (semantic: 0.4, vector: 0.4, position: 0.2)

### topK?:

number

Number of top results to return

## Returns [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#returns)

The tool returns an object with:

### relevantContext:

string

Combined text from the most relevant document chunks

## Default Tool Description [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#default-tool-description)

The default description focuses on:

- Finding relevant information in stored knowledge
- Answering user questions
- Retrieving factual content

## Result Handling [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#result-handling)

The tool determines the number of results to return based on the user’s query, with a default of 10 results. This can be adjusted based on the query requirements.

## Example with Filters [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#example-with-filters)

```nextra-code
const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding('text-embedding-3-small'),
  enableFilters: true,
});
```

With filtering enabled, the tool processes queries to construct metadata filters that combine with semantic search. The process works as follows:

1. A user makes a query with specific filter requirements like “Find content where the ‘version’ field is greater than 2.0”
2. The agent analyzes the query and constructs the appropriate filters:


```nextra-code
{
      "version": { "$gt": 2.0 }
}
```


This agent-driven approach:

- Processes natural language queries into filter specifications
- Implements vector store-specific filter syntax
- Translates query terms to filter operators

For detailed filter syntax and store-specific capabilities, see the [Metadata Filters](https://mastra.ai/docs/reference/rag/metadata-filters) documentation.

For an example of how agent-driven filtering works, see the [Agent-Driven Metadata Filtering](https://mastra.ai/examples/rag/filter-rag) example.

## Example with Reranking [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#example-with-reranking)

```nextra-code
const queryTool = createVectorQueryTool({
  vectorStoreName: "milvus",
  indexName: "documentation",
  model: openai.embedding('text-embedding-3-small'),
  reranker: {
    model: openai('gpt-4o-mini'),
    options: {
      weights: {
        semantic: 0.5,  // Semantic relevance weight
        vector: 0.3,    // Vector similarity weight
        position: 0.2   // Original position weight
      },
      topK: 5
    }
  }
});
```

Reranking improves result quality by combining:

- Semantic relevance: Using LLM-based scoring of text similarity
- Vector similarity: Original vector distance scores
- Position bias: Consideration of original result ordering
- Query analysis: Adjustments based on query characteristics

The reranker processes the initial vector search results and returns a reordered list optimized for relevance.

## Example with Custom Description [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#example-with-custom-description)

```nextra-code
const queryTool = createVectorQueryTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding('text-embedding-3-small'),
  description: "Search through document archives to find relevant information for answering questions about company policies and procedures"
});
```

This example shows how to customize the tool description for a specific use case while maintaining its core purpose of information retrieval.

## Tool Details [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#tool-details)

The tool is created with:

- **ID**: `VectorQuery {vectorStoreName} {indexName} Tool`
- **Input Schema**: Requires queryText and filter objects
- **Output Schema**: Returns relevantContext string

## Related [Permalink for this section](https://mastra.ai/docs/reference/tools/vector-query-tool\#related)

- [rerank()](https://mastra.ai/docs/reference/rag/rerank)
- [createGraphRAGTool](https://mastra.ai/docs/reference/tools/graph-rag-tool)

Last updated on March 11, 2025

[createGraphRAGTool()](https://mastra.ai/docs/reference/tools/graph-rag-tool "createGraphRAGTool()") [MastraMCPClient](https://mastra.ai/docs/reference/tools/client "MastraMCPClient")

## Graph RAG Tool
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Tools](https://mastra.ai/docs/reference/tools/document-chunker-tool "Tools") createGraphRAGTool()

# createGraphRAGTool()

The `createGraphRAGTool()` creates a tool that enhances RAG by building a graph of semantic relationships between documents. It uses the `GraphRAG` system under the hood to provide graph-based retrieval, finding relevant content through both direct similarity and connected relationships.

## Usage Example [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#usage-example)

```nextra-code
import { openai } from "@ai-sdk/openai";
import { createGraphRAGTool } from "@mastra/rag";

const graphTool = createGraphRAGTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    dimension: 1536,
    threshold: 0.7,
    randomWalkSteps: 100,
    restartProb: 0.15
  }
});
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#parameters)

### vectorStoreName:

string

Name of the vector store to query

### indexName:

string

Name of the index within the vector store

### model:

EmbeddingModel

Embedding model to use for vector search

### graphOptions?:

GraphOptions

= Default graph options

Configuration for the graph-based retrieval

### description?:

string

Custom description for the tool. By default: 'Access and analyze relationships between information in the knowledge base to answer complex questions about connections and patterns'

### GraphOptions [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#graphoptions)

### dimension?:

number

= 1536

Dimension of the embedding vectors

### threshold?:

number

= 0.7

Similarity threshold for creating edges between nodes (0-1)

### randomWalkSteps?:

number

= 100

Number of steps in random walk for graph traversal

### restartProb?:

number

= 0.15

Probability of restarting random walk from query node

## Returns [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#returns)

The tool returns an object with:

### relevantContext:

string

Combined text from the most relevant document chunks, retrieved using graph-based ranking

## Default Tool Description [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#default-tool-description)

The default description focuses on:

- Analyzing relationships between documents
- Finding patterns and connections
- Answering complex queries

## Advanced Example [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#advanced-example)

```nextra-code
const graphTool = createGraphRAGTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    dimension: 1536,
    threshold: 0.8,        // Higher similarity threshold
    randomWalkSteps: 200,  // More exploration steps
    restartProb: 0.2      // Higher restart probability
  }
});
```

## Example with Custom Description [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#example-with-custom-description)

```nextra-code
const graphTool = createGraphRAGTool({
  vectorStoreName: "pinecone",
  indexName: "docs",
  model: openai.embedding('text-embedding-3-small'),
  description: "Analyze document relationships to find complex patterns and connections in our company's historical data"
});
```

This example shows how to customize the tool description for a specific use case while maintaining its core purpose of relationship analysis.

## Related [Permalink for this section](https://mastra.ai/docs/reference/tools/graph-rag-tool\#related)

- [createVectorQueryTool](https://mastra.ai/docs/reference/tools/vector-query-tool)
- [GraphRAG](https://mastra.ai/docs/reference/rag/graph-rag)

Last updated on March 11, 2025

[createDocumentChunkerTool()](https://mastra.ai/docs/reference/tools/document-chunker-tool "createDocumentChunkerTool()") [createVectorQueryTool()](https://mastra.ai/docs/reference/tools/vector-query-tool "createVectorQueryTool()")

## Document Chunker Tool
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") ToolscreateDocumentChunkerTool()

# createDocumentChunkerTool()

The `createDocumentChunkerTool()` function creates a tool for splitting documents into smaller chunks for efficient processing and retrieval. It supports different chunking strategies and configurable parameters.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#basic-usage)

```nextra-code
import { createDocumentChunkerTool, MDocument } from "@mastra/rag";

const document = new MDocument({
  text: "Your document content here...",
  metadata: { source: "user-manual" }
});

const chunker = createDocumentChunkerTool({
  doc: document,
  params: {
    strategy: "recursive",
    size: 512,
    overlap: 50,
    separator: "\n"
  }
});

const { chunks } = await chunker.execute();
```

## Parameters [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#parameters)

### doc:

MDocument

The document to be chunked

### params?:

ChunkParams

= Default chunking parameters

Configuration parameters for chunking

### ChunkParams [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#chunkparams)

### strategy?:

'recursive'

= 'recursive'

The chunking strategy to use

### size?:

number

= 512

Target size of each chunk in tokens/characters

### overlap?:

number

= 50

Number of overlapping tokens/characters between chunks

### separator?:

string

= '\\n'

Character(s) to use as chunk separator

## Returns [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#returns)

### chunks:

DocumentChunk\[\]

Array of document chunks with their content and metadata

## Example with Custom Parameters [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#example-with-custom-parameters)

```nextra-code
const technicalDoc = new MDocument({
  text: longDocumentContent,
  metadata: {
    type: "technical",
    version: "1.0"
  }
});

const chunker = createDocumentChunkerTool({
  doc: technicalDoc,
  params: {
    strategy: "recursive",
    size: 1024,      // Larger chunks
    overlap: 100,    // More overlap
    separator: "\n\n" // Split on double newlines
  }
});

const { chunks } = await chunker.execute();

// Process the chunks
chunks.forEach((chunk, index) => {
  console.log(`Chunk ${index + 1} length: ${chunk.content.length}`);
});
```

## Tool Details [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#tool-details)

The chunker is created as a Mastra tool with the following properties:

- **Tool ID**: `Document Chunker {strategy} {size}`
- **Description**: `Chunks document using {strategy} strategy with size {size} and {overlap} overlap`
- **Input Schema**: Empty object (no additional inputs required)
- **Output Schema**: Object containing the chunks array

## Related [Permalink for this section](https://mastra.ai/docs/reference/tools/document-chunker-tool\#related)

- [MDocument](https://mastra.ai/docs/reference/rag/document)
- [createVectorQueryTool](https://mastra.ai/docs/reference/tools/vector-query-tool)

Last updated on March 11, 2025

[stream()](https://mastra.ai/docs/reference/agents/stream "stream()") [createGraphRAGTool()](https://mastra.ai/docs/reference/tools/graph-rag-tool "createGraphRAGTool()")

## Page Not Found
# 404

## This page could not be found.

## 404 Error Page
# 404

## This page could not be found.

## Create Workflow Run
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Workflows](https://mastra.ai/docs/reference/workflows/workflow "Workflows").createRun()

# Workflow.createRun()

The `.createRun()` method initializes a new workflow run instance. It generates a unique run ID for tracking and returns a start function that begins workflow execution when called.

One reason to use `.createRun()` vs `.execute()` is to get a unique run ID for tracking, logging, or subscribing via `.watch()`.

## Usage [Permalink for this section](https://mastra.ai/docs/reference/workflows/createRun\#usage)

```nextra-code
const { runId, start } = workflow.createRun();

const result = await start();
```

## Returns [Permalink for this section](https://mastra.ai/docs/reference/workflows/createRun\#returns)

### runId:

string

Unique identifier for tracking this workflow run

### start:

() =\> Promise<WorkflowResult>

Function that begins workflow execution when called

## Error Handling [Permalink for this section](https://mastra.ai/docs/reference/workflows/createRun\#error-handling)

The start function may throw validation errors if the workflow configuration is invalid:

```nextra-code
try {
  const { runId, start } = workflow.createRun();
  await start({ triggerData: data });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    console.log(error.type); // 'circular_dependency' | 'no_terminal_path' | 'unreachable_step'
    console.log(error.details);
  }
}
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/workflows/createRun\#related)

- [Workflow Class Reference](https://mastra.ai/docs/reference/workflows/workflow)
- [Step Class Reference](https://mastra.ai/docs/reference/workflows/step-class)
- See the [Creating a Workflow](https://mastra.ai/examples/workflows/creating-a-workflow) example for complete usage

```nextra-code

```

Last updated on March 11, 2025

[.while()](https://mastra.ai/docs/reference/workflows/while ".while()") [.start()](https://mastra.ai/docs/reference/workflows/start ".start()")

## Get Agent API
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") AgentsgetAgent()

# `getAgent()`

Retrieve an agent based on the provided configuration

```nextra-code [counter-reset:line]
async function getAgent({
  connectionId,
  agent,
  apis,
  logger,
}: {
  connectionId: string;
  agent: Record<string, any>;
  apis: Record<string, IntegrationApi>;
  logger: any;
}): Promise<(props: { prompt: string }) => Promise<any>> {
  return async (props: { prompt: string }) => {
    return { message: "Hello, world!" };
  };
}
```

## API Signature [Permalink for this section](https://mastra.ai/docs/reference/agents/getAgent\#api-signature)

### Parameters [Permalink for this section](https://mastra.ai/docs/reference/agents/getAgent\#parameters)

### connectionId:

string

The connection ID to use for the agent's API calls.

### agent:

Record<string, any>

The agent configuration object.

### apis:

Record<string, IntegrationAPI>

A map of API names to their respective API objects.

### Returns [Permalink for this section](https://mastra.ai/docs/reference/agents/getAgent\#returns)

Last updated on March 11, 2025

[mastra build](https://mastra.ai/docs/reference/cli/build "mastra build") [createTool()](https://mastra.ai/docs/reference/agents/createTool "createTool()")

## 404 Error Page
# 404

## This page could not be found.

## 404 Error Page
# 404

## This page could not be found.

## Qdrant Vector Store
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [RAG](https://mastra.ai/docs/reference/rag/chunk "RAG") QdrantVector

# Qdrant Vector Store

The QdrantVector class provides vector search using [Qdrant](https://qdrant.tech/), a vector similarity search engine.
It provides a production-ready service with a convenient API to store, search, and manage vectors with additional payload and extended filtering support.

## Constructor Options [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#constructor-options)

### url:

string

REST URL of the Qdrant instance. Eg. https://xyz-example.eu-central.aws.cloud.qdrant.io:6333

### apiKey:

string

Optional Qdrant API key

### https:

boolean

Whether to use TLS when setting up the connection. Recommended.

## Methods [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#methods)

### createIndex() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#createindex)

### indexName:

string

Name of the index to create

### dimension:

number

Vector dimension (must match your embedding model)

### metric?:

'cosine' \| 'euclidean' \| 'dotproduct'

= cosine

Distance metric for similarity search

### upsert() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#upsert)

### vectors:

number\[\]\[\]

Array of embedding vectors

### metadata?:

Record<string, any>\[\]

Metadata for each vector

### ids?:

string\[\]

Optional vector IDs (auto-generated if not provided)

### query() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#query)

### indexName:

string

Name of the index to query

### queryVector:

number\[\]

Query vector to find similar vectors

### topK?:

number

= 10

Number of results to return

### filter?:

Record<string, any>

Metadata filters for the query

### includeVector?:

boolean

= false

Whether to include vectors in the results

### listIndexes() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#listindexes)

Returns an array of index names as strings.

### describeIndex() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#describeindex)

### indexName:

string

Name of the index to describe

Returns:

```nextra-code
interface IndexStats {
  dimension: number;
  count: number;
  metric: "cosine" | "euclidean" | "dotproduct";
}
```

### deleteIndex() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#deleteindex)

### indexName:

string

Name of the index to delete

### updateIndexById() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#updateindexbyid)

### indexName:

string

Name of the index to update

### id:

string

ID of the vector to update

### update:

{ vector?: number\[\]; metadata?: Record<string, any>; }

Object containing the vector and/or metadata to update

Updates a vector and/or its metadata in the specified index. If both vector and metadata are provided, both will be updated. If only one is provided, only that will be updated.

### deleteIndexById() [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#deleteindexbyid)

### indexName:

string

Name of the index from which to delete the vector

### id:

string

ID of the vector to delete

Deletes a vector from the specified index by its ID.

## Response Types [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#response-types)

Query results are returned in this format:

```nextra-code
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // Only included if includeVector is true
}
```

## Error Handling [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#error-handling)

The store throws typed errors that can be caught:

```nextra-code
try {
  await store.query({
    indexName: "index_name",
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | etc
    console.log(error.details); // Additional error context
  }
}
```

### Related [Permalink for this section](https://mastra.ai/docs/reference/rag/qdrant\#related)

- [Metadata Filters](https://mastra.ai/docs/reference/rag/metadata-filters)

Last updated on March 11, 2025

[PineconeVector](https://mastra.ai/docs/reference/rag/pinecone "PineconeVector") [UpstashVector](https://mastra.ai/docs/reference/rag/upstash "UpstashVector")

## Mastra Tools API
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Client SDK - JS](https://mastra.ai/docs/reference/client-js "Client SDK - JS") Tools API

# Tools API

The Tools API provides methods to interact with and execute tools available in the Mastra platform.

## Getting All Tools [Permalink for this section](https://mastra.ai/docs/reference/client-js/tools\#getting-all-tools)

Retrieve a list of all available tools:

```nextra-code
const tools = await client.getTools();
```

## Working with a Specific Tool [Permalink for this section](https://mastra.ai/docs/reference/client-js/tools\#working-with-a-specific-tool)

Get an instance of a specific tool:

```nextra-code
const tool = client.getTool("tool-id");
```

## Tool Methods [Permalink for this section](https://mastra.ai/docs/reference/client-js/tools\#tool-methods)

### Get Tool Details [Permalink for this section](https://mastra.ai/docs/reference/client-js/tools\#get-tool-details)

Retrieve detailed information about a tool:

```nextra-code
const details = await tool.details();
```

### Execute Tool [Permalink for this section](https://mastra.ai/docs/reference/client-js/tools\#execute-tool)

Execute a tool with specific arguments:

```nextra-code
const result = await tool.execute({
  args: {
    param1: "value1",
    param2: "value2",
  },
  threadId: "thread-1", // Optional: Thread context
  resourceid: "resource-1", // Optional: Resource identifier
});
```

Last updated on March 11, 2025

[Memory API](https://mastra.ai/docs/reference/client-js/memory "Memory API") [Workflows API](https://mastra.ai/docs/reference/client-js/workflows "Workflows API")

## Workflows API Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Client SDK - JS](https://mastra.ai/docs/reference/client-js "Client SDK - JS") Workflows API

# Workflows API

The Workflows API provides methods to interact with and execute automated workflows in Mastra.

## Getting All Workflows [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#getting-all-workflows)

Retrieve a list of all available workflows:

```nextra-code
const workflows = await client.getWorkflows();
```

## Working with a Specific Workflow [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#working-with-a-specific-workflow)

Get an instance of a specific workflow:

```nextra-code
const workflow = client.getWorkflow("workflow-id");
```

## Workflow Methods [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#workflow-methods)

### Get Workflow Details [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#get-workflow-details)

Retrieve detailed information about a workflow:

```nextra-code
const details = await workflow.details();
```

### Execute Workflow [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#execute-workflow)

Execute a workflow with input parameters and wait for full results on completion:

```nextra-code
const result = await workflow.execute({
  input: {
    param1: "value1",
    param2: "value2",
  },
});
```

### Resume Workflow [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#resume-workflow)

Resume a suspended workflow step:

```nextra-code
const result = await workflow.resume({
  stepId: "step-id",
  runId: "run-id",
  contextData: { key: "value" },
});
```

### Watch Workflow [Permalink for this section](https://mastra.ai/docs/reference/client-js/workflows\#watch-workflow)

Watch workflow transitions in real-time using an async iterator:

```nextra-code
try{
  // Get workflow instance
  const workflow = client.getWorkflow("workflow-id");

  // Start a new workflow run
  const {runId} = await workflow.startRun({
    input: {
      param1: "value1",
      param2: "value2",
    },
  });

  // Watch for workflow run
  const workflowWatch = workflow.watch({runId})

  // Watch for workflow transitions
  for await (const record of workflowWatch) {
    // Every new record is the latest transition state of the workflow run
    console.log({
      activePaths: record.activePaths,
      context: record.context,
      timestamp: record.timestamp,
      runId: record.runId
    });
  }

}catch(e){
  console.error(e);
}finally{
  console.log('Workflow done');
}


```

The `watch()` method returns an AsyncGenerator that yields workflow transition records ( `WorkflowRunResult`). Each record contains:

| Field | Type | Description |
| --- | --- | --- |
| `activePaths` | `Array<{ stepId: string; stepPath: string[]; status: 'completed' | 'suspended' | 'pending' }>` | Currently active paths in the workflow with their execution status |
| `context` | `{ steps: Record<string, { status: 'completed' | 'suspended' | 'running'; [key: string]: any }> }` | Current workflow context including step statuses and additional step data |
| `timestamp` | `number` | Unix timestamp of when this transition occurred |
| `runId` | `string` | Unique identifier for this workflow run instance |
| `suspendedSteps` | `Record<string, any>` | Map of currently suspended steps and their suspension data |

This makes it easy to process workflow transitions in real-time using a simple for-await loop. The generator will automatically close when all steps in the workflow have reached a terminal state ( `completed`, `suspended`, or `failed`).

Last updated on March 11, 2025

[Tools API](https://mastra.ai/docs/reference/client-js/tools "Tools API") [Vectors API](https://mastra.ai/docs/reference/client-js/vectors "Vectors API")

## Chef Assistant Guide
[Docs](https://mastra.ai/docs "Docs") GuidesAgents: Chef Michel

# Agents Guide: Building a Chef Assistant

In this guide, we’ll walk through creating a “Chef Assistant” agent that helps users cook meals with available ingredients.

Mastra Agents Guide - Chef Michel - YouTube

Mastra AI

1.24K subscribers

[Mastra Agents Guide - Chef Michel](https://www.youtube.com/watch?v=_tZhOqHCrF0)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=_tZhOqHCrF0 "Watch on YouTube")

## Prerequisites [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#prerequisites)

- Node.js installed
- Mastra installed: `npm install @mastra/core`

* * *

## Create the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#create-the-agent)

### Define the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#define-the-agent)

Create a new file `src/mastra/agents/chefAgent.ts` and define your agent:

src/mastra/agents/chefAgent.ts

```nextra-code
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const chefAgent = new Agent({
  name: "chef-agent",
  instructions:
    "You are Michel, a practical and experienced home chef" +
    "You help people cook with whatever ingredients they have available.",
  model: openai("gpt-4o-mini"),
});
```

* * *

## Set Up Environment Variables [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#set-up-environment-variables)

Create a `.env` file in your project root and add your OpenAI API key:

.env

```nextra-code
OPENAI_API_KEY=your_openai_api_key
```

* * *

## Register the Agent with Mastra [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#register-the-agent-with-mastra)

In your main file, register the agent:

src/mastra/index.ts

```nextra-code
import { Mastra } from "@mastra/core";

import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({
  agents: { chefAgent },
});
```

* * *

## Interacting with the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#interacting-with-the-agent)

### Generating Text Responses [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#generating-text-responses)

src/index.ts

```nextra-code
async function main() {
  const query =
    "In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?";
  console.log(`Query: ${query}`);

  const response = await chefAgent.generate([{ role: "user", content: query }]);
  console.log("\n👨‍🍳 Chef Michel:", response.text);
}

main();
```

Run the script:

```nextra-code
npx bun src/index.ts
```

Output:

```nextra-code
Query: In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?

👨‍🍳 Chef Michel: You can make a delicious pasta al pomodoro! Here's how...
```

* * *

### Streaming Responses [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#streaming-responses)

src/index.ts

```nextra-code
async function main() {
  const query =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query: ${query}`);

  const stream = await chefAgent.stream([{ role: "user", content: query }]);

  console.log("\n Chef Michel: ");

  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }

  console.log("\n\n✅ Recipe complete!");
}

main();
```

Output:

```nextra-code
Query: Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.

👨‍🍳 Chef Michel:
Great! You can make a comforting chicken curry...

✅ Recipe complete!
```

* * *

### Generating a Recipe with Structured Data [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#generating-a-recipe-with-structured-data)

src/index.ts

```nextra-code
import { z } from "zod";

async function main() {
  const query =
    "I want to make lasagna, can you generate a lasagna recipe for me?";
  console.log(`Query: ${query}`);

  // Define the Zod schema
  const schema = z.object({
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
  });

  const response = await chefAgent.generate(
    [{ role: "user", content: query }],
    { output: schema },
  );
  console.log("\n👨‍🍳 Chef Michel:", response.object);
}

main();
```

Output:

```nextra-code
Query: I want to make lasagna, can you generate a lasagna recipe for me?

👨‍🍳 Chef Michel: {
  ingredients: [\
    { name: "Lasagna noodles", amount: "12 sheets" },\
    { name: "Ground beef", amount: "1 pound" },\
    // ...\
  ],
  steps: [\
    "Preheat oven to 375°F (190°C).",\
    "Cook the lasagna noodles according to package instructions.",\
    // ...\
  ]
}
```

* * *

## Running the Agent Server [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#running-the-agent-server)

### Using `mastra dev` [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#using-mastra-dev)

You can run your agent as a service using the `mastra dev` command:

```nextra-code
mastra dev
```

This will start a server exposing endpoints to interact with your registered agents.

### Accessing the Chef Assistant API [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#accessing-the-chef-assistant-api)

By default, `mastra dev` runs on `http://localhost:4111`. Your Chef Assistant agent will be available at:

```nextra-code
POST http://localhost:4111/api/agents/chefAgent/generate
```

### Interacting with the Agent via `curl` [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#interacting-with-the-agent-via-curl)

You can interact with the agent using `curl` from the command line:

```nextra-code
curl -X POST http://localhost:4111/api/agents/chefAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      {\
        "role": "user",\
        "content": "I have eggs, flour, and milk. What can I make?"\
      }\
    ]
  }'
```

**Sample Response:**

```nextra-code
{
  "text": "You can make delicious pancakes! Here's a simple recipe..."
}
```

Last updated on March 11, 2025

[Project Structure](https://mastra.ai/docs/getting-started/project-structure "Project Structure") [Tools: Stock Agent](https://mastra.ai/docs/guides/02-stock-agent "Tools: Stock Agent")

## Contextual Recall Metric
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") [Evals](https://mastra.ai/docs/reference/evals/answer-relevancy "Evals") ContextualRecall

# ContextualRecallMetric

The `ContextualRecallMetric` class evaluates how effectively an LLM’s response incorporates all relevant information from the provided context. It measures whether important information from the reference documents was successfully included in the response, focusing on completeness rather than precision.

## Basic Usage [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#basic-usage)

```nextra-code
import { openai } from "@ai-sdk/openai";
import { ContextualRecallMetric } from "@mastra/evals/llm";

// Configure the model for evaluation
const model = openai("gpt-4o-mini");

const metric = new ContextualRecallMetric(model, {
  context: [\
    "Product features: cloud synchronization capability",\
    "Offline mode available for all users",\
    "Supports multiple devices simultaneously",\
    "End-to-end encryption for all data"\
  ]
});

const result = await metric.measure(
  "What are the key features of the product?",
  "The product includes cloud sync, offline mode, and multi-device support.",
);

console.log(result.score); // Score from 0-1
```

## Constructor Parameters [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#constructor-parameters)

### model:

LanguageModel

Configuration for the model used to evaluate contextual recall

### options:

ContextualRecallMetricOptions

Configuration options for the metric

### ContextualRecallMetricOptions [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#contextualrecallmetricoptions)

### scale?:

number

= 1

Maximum score value

### context:

string\[\]

Array of reference documents or pieces of information to check against

## measure() Parameters [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#measure-parameters)

### input:

string

The original query or prompt

### output:

string

The LLM's response to evaluate

## Returns [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#returns)

### score:

number

Recall score (0 to scale, default 0-1)

### info:

object

Object containing the reason for the score

string

### reason:

string

Detailed explanation of the score

## Scoring Details [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#scoring-details)

The metric evaluates recall through comparison of response content against relevant context items.

### Scoring Process [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#scoring-process)

1. Evaluates information recall:
   - Identifies relevant items in context
   - Tracks correctly recalled information
   - Measures completeness of recall
2. Calculates recall score:
   - Counts correctly recalled items
   - Compares against total relevant items
   - Computes coverage ratio

Final score: `(correctly_recalled_items / total_relevant_items) * scale`

### Score interpretation [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#score-interpretation)

(0 to scale, default 0-1)

- 1.0: Perfect recall - all relevant information included
- 0.7-0.9: High recall - most relevant information included
- 0.4-0.6: Moderate recall - some relevant information missed
- 0.1-0.3: Low recall - significant information missed
- 0.0: No recall - no relevant information included

## Example with Custom Configuration [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#example-with-custom-configuration)

```nextra-code
import { openai } from "@ai-sdk/openai";
import { ContextualRecallMetric } from "@mastra/evals/llm";

// Configure the model for evaluation
const model = openai("gpt-4o-mini");

const metric = new ContextualRecallMetric(
  model,
  {
    scale: 100, // Use 0-100 scale instead of 0-1
    context: [\
      "All data is encrypted at rest and in transit",\
      "Two-factor authentication (2FA) is mandatory",\
      "Regular security audits are performed",\
      "Incident response team available 24/7"\
    ]
  }
);

const result = await metric.measure(
  "Summarize the company's security measures",
  "The company implements encryption for data protection and requires 2FA for all users.",
);

// Example output:
// {
//   score: 50, // Only half of the security measures were mentioned
//   info: {
//     reason: "The score is 50 because only half of the security measures were mentioned
//           in the response. The response missed the regular security audits and incident
//           response team information."
//   }
// }
```

## Related [Permalink for this section](https://mastra.ai/docs/reference/evals/contextual-recall\#related)

- [Context Relevancy Metric](https://mastra.ai/docs/reference/evals/context-relevancy)
- [Completeness Metric](https://mastra.ai/docs/reference/evals/completeness)
- [Summarization Metric](https://mastra.ai/docs/reference/evals/summarization)

Last updated on March 11, 2025

[ContextRelevancy](https://mastra.ai/docs/reference/evals/context-relevancy "ContextRelevancy") [Faithfulness](https://mastra.ai/docs/reference/evals/faithfulness "Faithfulness")

## TTS Providers Overview
# 404

## This page could not be found.

## Logging and Tracing Guide
# 404

## This page could not be found.

## Stock Price Agent
[Docs](https://mastra.ai/docs "Docs") [Guides](https://mastra.ai/docs/guides/01-chef-michel "Guides") Tools: Stock Agent

# Stock Agent

We’re going to create a simple agent that fetches the last day’s closing stock price for a given symbol. This example will show you how to create a tool, add it to an agent, and use the agent to fetch stock prices.

Mastra Tools Guide - Stock Agent - YouTube

Mastra AI

1.24K subscribers

[Mastra Tools Guide - Stock Agent](https://www.youtube.com/watch?v=rIaZ4l7y9wo)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=rIaZ4l7y9wo "Watch on YouTube")

## Project Structure [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#project-structure)

```nextra-code
stock-price-agent/
├── src/
│   ├── agents/
│   │   └── stockAgent.ts
│   ├── tools/
│   │   └── stockPrices.ts
│   └── index.ts
├── package.json
└── .env
```

* * *

## Initialize the Project and Install Dependencies [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#initialize-the-project-and-install-dependencies)

First, create a new directory for your project and navigate into it:

```nextra-code
mkdir stock-price-agent
cd stock-price-agent
```

Initialize a new Node.js project and install the required dependencies:

```nextra-code
npm init -y
npm install @mastra/core zod
```

Set Up Environment Variables

Create a `.env` file at the root of your project to store your OpenAI API key.

.env

```nextra-code
OPENAI_API_KEY=your_openai_api_key
```

Create the necessary directories and files:

```nextra-code
mkdir -p src/agents src/tools
touch src/agents/stockAgent.ts src/tools/stockPrices.ts src/index.ts
```

* * *

## Create the Stock Price Tool [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#create-the-stock-price-tool)

Next, we’ll create a tool that fetches the last day’s closing stock price for a given symbol.

src/tools/stockPrices.ts

```nextra-code
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const getStockPrice = async (symbol: string) => {
  const data = await fetch(
    `https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`,
  ).then((r) => r.json());
  return data.prices["4. close"];
};

export const stockPrices = createTool({
  id: "Get Stock Price",
  inputSchema: z.object({
    symbol: z.string(),
  }),
  description: `Fetches the last day's closing stock price for a given symbol`,
  execute: async ({ context: { symbol } }) => {
    console.log("Using tool to fetch stock price for", symbol);
    return {
      symbol,
      currentPrice: await getStockPrice(symbol),
    };
  },
});
```

* * *

## Add the Tool to an Agent [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#add-the-tool-to-an-agent)

We’ll create an agent and add the `stockPrices` tool to it.

src/agents/stockAgent.ts

```nextra-code
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

import * as tools from "../tools/stockPrices";

export const stockAgent = new Agent<typeof tools>({
  name: "Stock Agent",
  instructions:
    "You are a helpful assistant that provides current stock prices. When asked about a stock, use the stock price tool to fetch the stock price.",
  model: openai("gpt-4o-mini"),
  tools: {
    stockPrices: tools.stockPrices,
  },
});
```

* * *

## Set Up the Mastra Instance [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#set-up-the-mastra-instance)

We need to initialize the Mastra instance with our agent and tool.

src/index.ts

```nextra-code
import { Mastra } from "@mastra/core";

import { stockAgent } from "./agents/stockAgent";

export const mastra = new Mastra({
  agents: { stockAgent },
});
```

## Serve the Application [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#serve-the-application)

Instead of running the application directly, we’ll use the `mastra dev` command to start the server. This will expose your agent via REST API endpoints, allowing you to interact with it over HTTP.

In your terminal, start the Mastra server by running:

```nextra-code
mastra dev --dir src
```

This command will allow you to test your stockPrices tool and your stockAgent within the playground.

This will also start the server and make your agent available at:

```nextra-code
http://localhost:4111/api/agents/stockAgent/generate
```

* * *

## Test the Agent with cURL [Permalink for this section](https://mastra.ai/docs/guides/02-stock-agent\#test-the-agent-with-curl)

Now that your server is running, you can test your agent’s endpoint using `curl`:

```nextra-code
curl -X POST http://localhost:4111/api/agents/stockAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      { "role": "user", "content": "What is the current stock price of Apple (AAPL)?" }\
    ]
  }'
```

**Expected Response:**

You should receive a JSON response similar to:

```nextra-code
{
  "text": "The current price of Apple (AAPL) is $174.55.",
  "agent": "Stock Agent"
}
```

This indicates that your agent successfully processed the request, used the `stockPrices` tool to fetch the stock price, and returned the result.

Last updated on March 11, 2025

[Agents: Chef Michel](https://mastra.ai/docs/guides/01-chef-michel "Agents: Chef Michel") [Workflows: AI Recruiter](https://mastra.ai/docs/guides/03-recruiter "Workflows: AI Recruiter")

## AI Recruitment Workflows
[Docs](https://mastra.ai/docs "Docs") [Guides](https://mastra.ai/docs/guides/01-chef-michel "Guides") Workflows: AI Recruiter

# Introduction

In this guide, you’ll learn how Mastra helps you build workflows with LLMs.

We’ll walk through creating a workflow that gathers information from a candidate’s resume, then branches to either a technical or behavioral question based on the candidate’s profile. Along the way, you’ll see how to structure workflow steps, handle branching, and integrate LLM calls.

Below is a concise version of the workflow. It starts by importing the necessary modules, sets up Mastra, defines steps to extract and classify candidate data, and then asks suitable follow-up questions. Each code block is followed by a short explanation of what it does and why it’s useful.

## 1\. Imports and Setup [Permalink for this section](https://mastra.ai/docs/guides/03-recruiter\#1-imports-and-setup)

You need to import Mastra tools and Zod to handle workflow definitions and data validation.

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
```

Add your `OPENAI_API_KEY` to the `.env` file.

.env

```nextra-code
OPENAI_API_KEY=<your-openai-key>
```

## 2\. Step One: Gather Candidate Info [Permalink for this section](https://mastra.ai/docs/guides/03-recruiter\#2-step-one-gather-candidate-info)

You want to extract candidate details from the resume text and classify them as technical or non-technical. This step calls an LLM to parse the resume and return structured JSON, including the name, technical status, specialty, and the original resume text. The code reads resumeText from trigger data, prompts the LLM, and returns organized fields for use in subsequent steps.

src/mastra/index.ts

```nextra-code
import { Agent } from '@mastra/core/agent';
import { openai } from "@ai-sdk/openai";

const recruiter = new Agent({
  instructions: `You are a recruiter.`,
  model: openai("gpt-4o-mini"),
})

const gatherCandidateInfo = new Step({
  id: "gatherCandidateInfo",
  inputSchema: z.object({
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string(),
    resumeText: z.string(),
  }),
  execute: async ({ context }) => {
    const resumeText = context?.getStepResult<{
      resumeText: string;
    }>("trigger")?.resumeText;

    const prompt = `
          Extract details from the resume text:
          "${resumeText}"
        `;

    const res = await recruiter.generate(prompt, {
      output: z.object({
        candidateName: z.string(),
        isTechnical: z.boolean(),
        specialty: z.string(),
        resumeText: z.string(),
      }),
    });

    return res.object;
  },
});
```

## 3\. Technical Question Step [Permalink for this section](https://mastra.ai/docs/guides/03-recruiter\#3-technical-question-step)

This step prompts a candidate who is identified as technical for more information about how they got into their specialty. It uses the entire resume text so the LLM can craft a relevant follow-up question. The code generates a question about the candidate’s specialty.

src/mastra/index.ts

```nextra-code
interface CandidateInfo {
  candidateName: string;
  isTechnical: boolean;
  specialty: string;
  resumeText: string;
}

const askAboutSpecialty = new Step({
  id: "askAboutSpecialty",
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ context }) => {
    const candidateInfo = context?.getStepResult<CandidateInfo>(
      "gatherCandidateInfo",
    );

    const prompt = `
          You are a recruiter. Given the resume below, craft a short question
          for ${candidateInfo?.candidateName} about how they got into "${candidateInfo?.specialty}".
          Resume: ${candidateInfo?.resumeText}
        `;
    const res = await recruiter.generate(prompt);

    return { question: res?.text?.trim() || "" };
  },
});
```

## 4\. Behavioral Question Step [Permalink for this section](https://mastra.ai/docs/guides/03-recruiter\#4-behavioral-question-step)

If the candidate is non-technical, you want a different follow-up question. This step asks what interests them most about the role, again referencing their complete resume text. The code solicits a role-focused query from the LLM.

src/mastra/index.ts

```nextra-code
const askAboutRole = new Step({
  id: "askAboutRole",
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ context }) => {
    const candidateInfo = context?.getStepResult<CandidateInfo>(
      "gatherCandidateInfo",
    );

    const prompt = `
          You are a recruiter. Given the resume below, craft a short question
          for ${candidateInfo?.candidateName} asking what interests them most about this role.
          Resume: ${candidateInfo?.resumeText}
        `;
    const res = await recruiter.generate(prompt);
    return { question: res?.text?.trim() || "" };
  },
});
```

## 5\. Define the Workflow [Permalink for this section](https://mastra.ai/docs/guides/03-recruiter\#5-define-the-workflow)

You now combine the steps to implement branching logic based on the candidate’s technical status. The workflow first gathers candidate data, then either asks about their specialty or about their role, depending on isTechnical. The code chains gatherCandidateInfo with askAboutSpecialty and askAboutRole, and commits the workflow.

src/mastra/index.ts

```nextra-code
const candidateWorkflow = new Workflow({
  name: "candidate-workflow",
  triggerSchema: z.object({
    resumeText: z.string(),
  }),
});

candidateWorkflow
  .step(gatherCandidateInfo)
  .then(askAboutSpecialty, {
    when: { "gatherCandidateInfo.isTechnical": true },
  })
  .after(gatherCandidateInfo)
  .step(askAboutRole, {
    when: { "gatherCandidateInfo.isTechnical": false },
  });

candidateWorkflow.commit();
```

## 6\. Execute the Workflow [Permalink for this section](https://mastra.ai/docs/guides/03-recruiter\#6-execute-the-workflow)

src/mastra/index.ts

```nextra-code
const mastra = new Mastra({
  workflows: {
    candidateWorkflow,
  },
});

(async () => {
  const { runId, start } = mastra.getWorkflow("candidateWorkflow").createRun();

  console.log("Run", runId);

  const runResult = await start({
    triggerData: { resumeText: "Simulated resume content..." },
  });

  console.log("Final output:", runResult.results);
})();
```

You’ve just built a workflow to parse a resume and decide which question to ask based on the candidate’s technical abilities. Congrats and happy hacking!

Last updated on March 11, 2025

[Tools: Stock Agent](https://mastra.ai/docs/guides/02-stock-agent "Tools: Stock Agent") [Integrate with Next.js](https://mastra.ai/docs/frameworks/01-next-js "Integrate with Next.js")

## Traceloop Overview
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") Observability [Providers](https://mastra.ai/docs/reference/observability/providers "Providers") Traceloop

# Traceloop

Traceloop is an OpenTelemetry-native observability platform specifically designed for LLM applications.

## Configuration [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/traceloop\#configuration)

To use Traceloop with Mastra, configure these environment variables:

```nextra-code
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.traceloop.com
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your_api_key, x-traceloop-destination-id=your_destination_id"
```

## Implementation [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/traceloop\#implementation)

Here’s how to configure Mastra to use Traceloop:

```nextra-code
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-service-name",
    enabled: true,
    export: {
      type: "otlp",
    },
  },
});
```

## Dashboard [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/traceloop\#dashboard)

Access your traces and analytics in the Traceloop dashboard at [app.traceloop.com](https://app.traceloop.com/)

Last updated on March 11, 2025

[New Relic](https://mastra.ai/docs/reference/observability/providers/new-relic "New Relic") [Laminar](https://mastra.ai/docs/reference/observability/providers/laminar "Laminar")

## 404 Error Page
# 404

## This page could not be found.

## 404 Error Page
# 404

## This page could not be found.

## Mastra Project Structure
[Docs](https://mastra.ai/docs "Docs") [Getting Started](https://mastra.ai/docs/getting-started/installation "Getting Started") Project Structure

# Project Structure

This page provides a guide for organizing folders and files in Mastra. Mastra is a modular framework, and you can use any of the modules separately or together.

You could write everything in a single file (as we showed in the quick start), or separate each agent, tool, and workflow into their own files.

We don’t enforce a specific folder structure, but we do recommend some best practices, and the CLI will scaffold a project with a sensible structure.

## Using the CLI [Permalink for this section](https://mastra.ai/docs/getting-started/project-structure\#using-the-cli)

`mastra init` is an interactive CLI that allows you to:

- **Choose a directory for Mastra files**: Specify where you want the Mastra files to be placed (default is `src/mastra`).
- **Select components to install**: Choose which components you want to include in your project:
  - Agents
  - Tools
  - Workflows
- **Select a default LLM provider**: Choose from supported providers like OpenAI, Anthropic, or Groq.
- **Include example code**: Decide whether to include example code to help you get started.

### Example Project Structure [Permalink for this section](https://mastra.ai/docs/getting-started/project-structure\#example-project-structure)

Assuming you select all components and include example code, your project structure will look like this:

- root
  - src
    - mastra
      - agents
        - index.ts
      - tools
        - index.ts
      - workflows
        - index.ts
      - index.ts
  - .env

### Top-level Folders [Permalink for this section](https://mastra.ai/docs/getting-started/project-structure\#top-level-folders)

| Folder | Description |
| --- | --- |
| `src/mastra` | Core application folder |
| `src/mastra/agents` | Agent configurations and definitions |
| `src/mastra/tools` | Custom tool definitions |
| `src/mastra/workflows` | Workflow definitions |

### Top-level Files [Permalink for this section](https://mastra.ai/docs/getting-started/project-structure\#top-level-files)

| File | Description |
| --- | --- |
| `src/mastra/index.ts` | Main configuration file for Mastra |
| `.env` | Environment variables |

Last updated on March 11, 2025

[Installation](https://mastra.ai/docs/getting-started/installation "Installation") [Agents: Chef Michel](https://mastra.ai/docs/guides/01-chef-michel "Agents: Chef Michel")

## Chef Assistant Guide
[Docs](https://mastra.ai/docs "Docs") GuidesAgents: Chef Michel

# Agents Guide: Building a Chef Assistant

In this guide, we’ll walk through creating a “Chef Assistant” agent that helps users cook meals with available ingredients.

Mastra Agents Guide - Chef Michel - YouTube

Mastra AI

1.24K subscribers

[Mastra Agents Guide - Chef Michel](https://www.youtube.com/watch?v=_tZhOqHCrF0)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=_tZhOqHCrF0 "Watch on YouTube")

## Prerequisites [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#prerequisites)

- Node.js installed
- Mastra installed: `npm install @mastra/core`

* * *

## Create the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#create-the-agent)

### Define the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#define-the-agent)

Create a new file `src/mastra/agents/chefAgent.ts` and define your agent:

src/mastra/agents/chefAgent.ts

```nextra-code
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const chefAgent = new Agent({
  name: "chef-agent",
  instructions:
    "You are Michel, a practical and experienced home chef" +
    "You help people cook with whatever ingredients they have available.",
  model: openai("gpt-4o-mini"),
});
```

* * *

## Set Up Environment Variables [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#set-up-environment-variables)

Create a `.env` file in your project root and add your OpenAI API key:

.env

```nextra-code
OPENAI_API_KEY=your_openai_api_key
```

* * *

## Register the Agent with Mastra [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#register-the-agent-with-mastra)

In your main file, register the agent:

src/mastra/index.ts

```nextra-code
import { Mastra } from "@mastra/core";

import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({
  agents: { chefAgent },
});
```

* * *

## Interacting with the Agent [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#interacting-with-the-agent)

### Generating Text Responses [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#generating-text-responses)

src/index.ts

```nextra-code
async function main() {
  const query =
    "In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?";
  console.log(`Query: ${query}`);

  const response = await chefAgent.generate([{ role: "user", content: query }]);
  console.log("\n👨‍🍳 Chef Michel:", response.text);
}

main();
```

Run the script:

```nextra-code
npx bun src/index.ts
```

Output:

```nextra-code
Query: In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?

👨‍🍳 Chef Michel: You can make a delicious pasta al pomodoro! Here's how...
```

* * *

### Streaming Responses [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#streaming-responses)

src/index.ts

```nextra-code
async function main() {
  const query =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query: ${query}`);

  const stream = await chefAgent.stream([{ role: "user", content: query }]);

  console.log("\n Chef Michel: ");

  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }

  console.log("\n\n✅ Recipe complete!");
}

main();
```

Output:

```nextra-code
Query: Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.

👨‍🍳 Chef Michel:
Great! You can make a comforting chicken curry...

✅ Recipe complete!
```

* * *

### Generating a Recipe with Structured Data [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#generating-a-recipe-with-structured-data)

src/index.ts

```nextra-code
import { z } from "zod";

async function main() {
  const query =
    "I want to make lasagna, can you generate a lasagna recipe for me?";
  console.log(`Query: ${query}`);

  // Define the Zod schema
  const schema = z.object({
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
  });

  const response = await chefAgent.generate(
    [{ role: "user", content: query }],
    { output: schema },
  );
  console.log("\n👨‍🍳 Chef Michel:", response.object);
}

main();
```

Output:

```nextra-code
Query: I want to make lasagna, can you generate a lasagna recipe for me?

👨‍🍳 Chef Michel: {
  ingredients: [\
    { name: "Lasagna noodles", amount: "12 sheets" },\
    { name: "Ground beef", amount: "1 pound" },\
    // ...\
  ],
  steps: [\
    "Preheat oven to 375°F (190°C).",\
    "Cook the lasagna noodles according to package instructions.",\
    // ...\
  ]
}
```

* * *

## Running the Agent Server [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#running-the-agent-server)

### Using `mastra dev` [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#using-mastra-dev)

You can run your agent as a service using the `mastra dev` command:

```nextra-code
mastra dev
```

This will start a server exposing endpoints to interact with your registered agents.

### Accessing the Chef Assistant API [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#accessing-the-chef-assistant-api)

By default, `mastra dev` runs on `http://localhost:4111`. Your Chef Assistant agent will be available at:

```nextra-code
POST http://localhost:4111/api/agents/chefAgent/generate
```

### Interacting with the Agent via `curl` [Permalink for this section](https://mastra.ai/docs/guides/01-chef-michel\#interacting-with-the-agent-via-curl)

You can interact with the agent using `curl` from the command line:

```nextra-code
curl -X POST http://localhost:4111/api/agents/chefAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [\
      {\
        "role": "user",\
        "content": "I have eggs, flour, and milk. What can I make?"\
      }\
    ]
  }'
```

**Sample Response:**

```nextra-code
{
  "text": "You can make delicious pancakes! Here's a simple recipe..."
}
```

Last updated on March 11, 2025

[Project Structure](https://mastra.ai/docs/getting-started/project-structure "Project Structure") [Tools: Stock Agent](https://mastra.ai/docs/guides/02-stock-agent "Tools: Stock Agent")

## 404 Error Page
# 404

## This page could not be found.

## Mastra AI Framework
DocsIntroduction

# About Mastra

Mastra is an open-source Typescript agent framework.

It’s designed to give you the primitives you need to build AI applications and features.

You can use Mastra to build [AI agents](https://mastra.ai/docs/agents/00-overview) that have memory and can execute functions, or chain LLM calls in deterministic [workflows](https://mastra.ai/docs/workflows/00-overview). You can chat with your agents in Mastra’s [local dev environment](https://mastra.ai/docs/local-dev/mastra-dev), feed them application-specific knowledge with [RAG](https://mastra.ai/docs/rag/overview), and score their outputs with Mastra’s [evals](https://mastra.ai/docs/08-running-evals).

The main features include:

- **[Model routing](https://sdk.vercel.ai/docs/introduction)**: Mastra uses the [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction) for model routing, providing a unified interface to interact with any LLM provider including OpenAI, Anthropic, and Google Gemini.
- **[Agent memory and tool calling](https://mastra.ai/docs/agents/01-agent-memory)**: With Mastra, you can give your agent tools (functions) that it can call. You can persist agent memory and retrieve it based on recency, semantic similarity, or conversation thread.
- **[Workflow graphs](https://mastra.ai/docs/workflows/00-overview)**: When you want to execute LLM calls in a deterministic way, Mastra gives you a graph-based workflow engine. You can define discrete steps, log inputs and outputs at each step of each run, and pipe them into an observability tool. Mastra workflows have a simple syntax for control flow ( `step()`, `.then()`, `.after()`) that allows branching and chaining.
- **[Agent development environment](https://mastra.ai/docs/local-dev/mastra-dev)**: When you’re developing an agent locally, you can chat with it and see its state and memory in Mastra’s agent development environment.
- **[Retrieval-augmented generation (RAG)](https://mastra.ai/docs/rag/overview)**: Mastra gives you APIs to process documents (text, HTML, Markdown, JSON) into chunks, create embeddings, and store them in a vector database. At query time, it retrieves relevant chunks to ground LLM responses in your data, with a unified API on top of multiple vector stores (Pinecone, pgvector, etc) and embedding providers (OpenAI, Cohere, etc).
- **[Deployment](https://mastra.ai/docs/deployment/deployment)**: Mastra supports bundling your agents and workflows within an existing React, Next.js, or Node.js application, or into standalone endpoints. The Mastra deploy helper lets you easily bundle agents and workflows into a Node.js server using Hono, or deploy it onto a serverless platform like Vercel, Cloudflare Workers, or Netlify.
- **[Evals](https://mastra.ai/docs/evals/00-overview)**: Mastra provides automated evaluation metrics that use model-graded, rule-based, and statistical methods to assess LLM outputs, with built-in metrics for toxicity, bias, relevance, and factual accuracy. You can also define your own evals.

Last updated on March 11, 2025

[Installation](https://mastra.ai/docs/getting-started/installation "Installation")

## Mastra AI Framework
DocsIntroduction

# About Mastra

Mastra is an open-source Typescript agent framework.

It’s designed to give you the primitives you need to build AI applications and features.

You can use Mastra to build [AI agents](https://mastra.ai/docs/agents/00-overview) that have memory and can execute functions, or chain LLM calls in deterministic [workflows](https://mastra.ai/docs/workflows/00-overview). You can chat with your agents in Mastra’s [local dev environment](https://mastra.ai/docs/local-dev/mastra-dev), feed them application-specific knowledge with [RAG](https://mastra.ai/docs/rag/overview), and score their outputs with Mastra’s [evals](https://mastra.ai/docs/08-running-evals).

The main features include:

- **[Model routing](https://sdk.vercel.ai/docs/introduction)**: Mastra uses the [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction) for model routing, providing a unified interface to interact with any LLM provider including OpenAI, Anthropic, and Google Gemini.
- **[Agent memory and tool calling](https://mastra.ai/docs/agents/01-agent-memory)**: With Mastra, you can give your agent tools (functions) that it can call. You can persist agent memory and retrieve it based on recency, semantic similarity, or conversation thread.
- **[Workflow graphs](https://mastra.ai/docs/workflows/00-overview)**: When you want to execute LLM calls in a deterministic way, Mastra gives you a graph-based workflow engine. You can define discrete steps, log inputs and outputs at each step of each run, and pipe them into an observability tool. Mastra workflows have a simple syntax for control flow ( `step()`, `.then()`, `.after()`) that allows branching and chaining.
- **[Agent development environment](https://mastra.ai/docs/local-dev/mastra-dev)**: When you’re developing an agent locally, you can chat with it and see its state and memory in Mastra’s agent development environment.
- **[Retrieval-augmented generation (RAG)](https://mastra.ai/docs/rag/overview)**: Mastra gives you APIs to process documents (text, HTML, Markdown, JSON) into chunks, create embeddings, and store them in a vector database. At query time, it retrieves relevant chunks to ground LLM responses in your data, with a unified API on top of multiple vector stores (Pinecone, pgvector, etc) and embedding providers (OpenAI, Cohere, etc).
- **[Deployment](https://mastra.ai/docs/deployment/deployment)**: Mastra supports bundling your agents and workflows within an existing React, Next.js, or Node.js application, or into standalone endpoints. The Mastra deploy helper lets you easily bundle agents and workflows into a Node.js server using Hono, or deploy it onto a serverless platform like Vercel, Cloudflare Workers, or Netlify.
- **[Evals](https://mastra.ai/docs/evals/00-overview)**: Mastra provides automated evaluation metrics that use model-graded, rule-based, and statistical methods to assess LLM outputs, with built-in metrics for toxicity, bias, relevance, and factual accuracy. You can also define your own evals.

Last updated on March 11, 2025

[Installation](https://mastra.ai/docs/getting-started/installation "Installation")

## 404 Error - Not Found
# 404

## This page could not be found.

## Agent Evaluation Tests
[Docs](https://mastra.ai/docs "Docs") EvalsOverview

# Testing your agents with evals

Evals are automated tests that evaluate Agents outputs using model-graded, rule-based, and statistical methods. Each eval returns a normalized score between 0-1 that can be logged and compared. Evals can be customized with your own prompts and scoring functions.

Evals can be run in the cloud, capturing real-time results. But evals can also be part of your CI/CD pipeline, allowing you to test and monitor your agents over time.

## How to use evals [Permalink for this section](https://mastra.ai/docs/evals/00-overview\#how-to-use-evals)

Evals need to be added to an agent. To use any of [the default metrics](https://mastra.ai/docs/evals/01-supported-evals), you can do the following:

src/mastra/agents/index.ts

```nextra-code [counter-reset:line]
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { ToneConsistencyMetric } from "@mastra/evals/nlp";

export const myAgent = new Agent({
  name: "My Agent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
  evals: {
    tone: new ToneConsistencyMetric()
  },
});
```

You can now view the evals in the Mastra dashboard, when using `mastra dev`.

### Executing evals in your CI/CD pipeline [Permalink for this section](https://mastra.ai/docs/evals/00-overview\#executing-evals-in-your-cicd-pipeline)

We support any testing framework that supports ESM modules. For example, you can use [Vitest](https://vitest.dev/), [Jest](https://jestjs.io/) or [Mocha](https://mochajs.org/) to run evals in your CI/CD pipeline.

src/mastra/agents/index.test.ts

```nextra-code [counter-reset:line]
import { describe, it, expect } from 'vitest';
import { evaluate } from '@mastra/core/eval';
import { myAgent } from './index';

describe('My Agent', () => {
  it('should be able to validate tone consistency', async () => {
    const metric = new ToneConsistencyMetric();
    const result = await evaluate(myAgent, 'Hello, world!', metric)

    expect(result.score).toBe(1);
  });
});

```

You will need to configure a testSetup and globalSetup script for your testing framework to capture the eval results. It allows us to show these results in your mastra dashboard.

#### Vitest [Permalink for this section](https://mastra.ai/docs/evals/00-overview\#vitest)

These are the files you need to add to your project to run evals in your CI/CD pipeline and allow us to capture the results.
Without these files, the evals will still run and fail when necessary but you won’t be able to see the results in the Mastra dashboard.

globalSetup.ts

```nextra-code [counter-reset:line]
import { globalSetup } from '@mastra/evals';

export default function setup() {
  globalSetup()
}
```

testSetup.ts

```nextra-code [counter-reset:line]
import { beforeAll } from 'vitest';
import { attachListeners } from '@mastra/evals';

beforeAll(async () => {
  await attachListeners();
});
```

Store evals in Mastra Storage

Pass your Mastra instance to store evals in the configured storage:

```nextra-code
import { mastra } from './your-mastra-setup';

beforeAll(async () => {
  // Store evals in Mastra Storage (requires storage to be enabled)
  await attachListeners(mastra);
});
```

This allows you to save evals in Mastra Storage.
With file storage, evals persist and can be queried later.
With memory storage, evals are isolated to the test process.

vitest.config.ts

```nextra-code [counter-reset:line]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './globalSetup.ts',
    setupFiles: ['./testSetup.ts'],
  },
})
```

Last updated on March 11, 2025

[Deployment](https://mastra.ai/docs/deployment/deployment "Deployment") [Supported Evals](https://mastra.ai/docs/evals/01-supported-evals "Supported Evals")

## Laminar Observability Platform
[Docs](https://mastra.ai/docs "Docs") [Reference](https://mastra.ai/docs/reference "Reference") Observability [Providers](https://mastra.ai/docs/reference/observability/providers "Providers") Laminar

# Laminar

Laminar is a specialized observability platform for LLM applications.

## Configuration [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/laminar\#configuration)

To use Laminar with Mastra, configure these environment variables:

```nextra-code
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.lmnr.ai:8443
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your_api_key, x-laminar-team-id=your_team_id"
```

## Implementation [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/laminar\#implementation)

Here’s how to configure Mastra to use Laminar:

```nextra-code
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-service-name",
    enabled: true,
    export: {
      type: "otlp",
      protocol: "grpc",
    },
  },
});
```

## Dashboard [Permalink for this section](https://mastra.ai/docs/reference/observability/providers/laminar\#dashboard)

Access your Laminar dashboard at [https://lmnr.ai/](https://lmnr.ai/)

Last updated on March 11, 2025

[Traceloop](https://mastra.ai/docs/reference/observability/providers/traceloop "Traceloop") [Logger](https://mastra.ai/docs/reference/observability/logger "Logger")

## 404 Error Page
# 404

## This page could not be found.

## 404 Error Page
# 404

## This page could not be found.

