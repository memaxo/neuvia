export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let counter = 0;
      const interval = setInterval(() => {
        const event = {
          eventType: counter % 2 === 0 ? "search" : "LLM_response",
          sectionId: `Section ${counter}`,
          percent: (counter * 10) % 100,
          timestamp: Date.now(),
          description: `Simulated event ${counter}`
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        counter++;
        if (counter > 10) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}