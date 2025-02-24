import { GeminiProcessor } from './gemini';

// Utility function to read a File object as text
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = error => reject(error);
    reader.readAsText(file);
  });
}

// Process the uploaded document by reading its content and generating a summary using GeminiProcessor
export async function processDocument(file: File): Promise<{ summary: string }> {
  const fileContent = await readFile(file);
  const gemini = new GeminiProcessor();
  const summary = await gemini.summarizeDocument(fileContent);
  return { summary };
} 