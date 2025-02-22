"use server";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStreamableValue } from "ai/rsc";

export async function runRAGAgent(input: string, context?: string): Promise<{ streamData: any }> {
  "use server";
  const stream = createStreamableValue();

  (async () => {
    try {
      // Use provided context or default to an empty string if none is provided.
      const retrievedContext = context || "";
      
      // Define a prompt template that combines the patient document context with the clinician's question.
      const promptTemplate = ChatPromptTemplate.fromTemplate(
        `You are a clinical assistant. Use the following patient document context to answer the question.

Context:
{context}

Question:
{question}

Provide a detailed and insightful answer, including relevant document excerpts when possible.`
      );

      // Initialize the LLM with a production-grade model "o3-mini" and adjusted parameters.
      const llm = new ChatOpenAI({ model: "o3-mini", temperature: 0.3 });
      
      // Create the chain by piping the prompt template into the LLM.
      const chain = promptTemplate.pipe(llm);

      // Stream results from the chain.
      let streamResult;
      try {
        streamResult = await chain.stream({
          context: retrievedContext,
          question: input,
        });
      } catch (chainError) {
        console.error("Error during chain.stream execution:", chainError);
        stream.update({ error: chainError instanceof Error ? chainError.message : String(chainError) });
        stream.done();
        return;
      }

      try {
        for await (const item of streamResult) {
          // Update stream with native format without the JSON stringify/parse hack.
          stream.update(item);
        }
      } catch (streamIterationError) {
        console.error("Error during streaming iteration:", streamIterationError);
        stream.update({ error: streamIterationError instanceof Error ? streamIterationError.message : String(streamIterationError) });
      }
      stream.done();
    } catch (error) {
      console.error("General error in runRAGAgent:", error);
      stream.update({ error: error instanceof Error ? error.message : String(error) });
      stream.done();
    }
  })();

  return { streamData: stream.value };
}