import type { JobAgentStreamEvent } from "./types";

export function createJobExecutionStreamResponse(
  run: (send: (event: JobAgentStreamEvent) => void) => Promise<void>,
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const enqueue = (value: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(value));
        } catch {
          closed = true;
        }
      };
      const send = (event: JobAgentStreamEvent) => {
        enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };
      const heartbeat = setInterval(() => {
        enqueue(": ping\n\n");
      }, 15000);

      run(send)
        .catch((error) => {
          send({
            type: "error",
            content: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // Client disconnected.
            }
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
