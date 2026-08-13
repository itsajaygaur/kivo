import { Hono } from "hono";
import { z } from "zod";
import {
  chatRequestSchema,
  problem,
  searchRequestSchema,
  type IngestionMessage,
} from "@kivo/shared";
import { streamGroundedAnswer } from "./generation";
import { markFailed, processIngestion } from "./queue";
import { retrieve, toCitations } from "./retrieval";

const ocrSchema = z.object({ image: z.string().min(100).max(4_000_000) });

async function tokensMatch(expected: string, provided: string | undefined): Promise<boolean> {
  const encoder = new TextEncoder();
  const [expectedDigest, providedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(provided ?? "")),
  ]);
  const a = new Uint8Array(expectedDigest);
  const b = new Uint8Array(providedDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

const app = new Hono<{ Bindings: Env }>();
app.use("/internal/*", async (context, next) => {
  const token = context.env.INTERNAL_SERVICE_TOKEN;
  if (!token)
    return problem(
      503,
      "Service token missing",
      "Set the INTERNAL_SERVICE_TOKEN secret on this Worker before it can serve internal traffic.",
    );
  if (!(await tokensMatch(token, context.req.header("x-kivo-service-token"))))
    return problem(
      401,
      "Unauthorized",
      "This endpoint accepts trusted service-bound requests only.",
    );
  await next();
});
app.get("/health", (context) =>
  context.json({ status: "ok", service: "ai-worker", time: new Date().toISOString() }),
);
app.post("/internal/search", async (context) => {
  const parsed = searchRequestSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return problem(
      422,
      "Invalid request",
      parsed.error.issues[0]?.message ?? "Invalid search request.",
    );
  const chunks = await retrieve(context.env, parsed.data);
  return context.json({ data: chunks, citations: toCitations(chunks) });
});
app.post("/internal/chat", async (context) => {
  const parsed = chatRequestSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return problem(
      422,
      "Invalid request",
      parsed.error.issues[0]?.message ?? "Invalid chat request.",
    );
  const chunks = await retrieve(context.env, parsed.data);
  return streamGroundedAnswer(context.env, parsed.data, chunks);
});
app.post("/internal/ocr", async (context) => {
  const parsed = ocrSchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return problem(422, "Invalid request", parsed.error.issues[0]?.message ?? "Invalid OCR page.");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(parsed.data.image), (char) => char.charCodeAt(0));
  } catch {
    return problem(422, "Invalid request", "The OCR payload must be base64-encoded image bytes.");
  }
  const result = await context.env.AI.run(context.env.OCR_MODEL as never, {
    image: [...bytes],
    prompt: "Transcribe this page exactly. Preserve headings and tables. Do not interpret it.",
  });
  return context.json(result);
});
app.notFound((context) =>
  problem(404, "Not found", "The AI route does not exist.", context.req.path),
);
app.onError((error, context) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "ai_request_failed",
      requestId: context.req.header("cf-ray"),
      message: error.message,
    }),
  );
  return problem(500, "Internal error", "The AI service could not complete the request.");
});
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<IngestionMessage>, env: Env): Promise<void> {
    // Messages that exhausted their retries land on the dead-letter queue; the
    // job must be recorded as failed so documents never sit in "indexing" forever.
    if (batch.queue === "kivo-ingestion-dlq") {
      for (const message of batch.messages) {
        try {
          if (message.body?.jobId)
            await markFailed(env, message.body, "Ingestion retries exhausted");
        } catch (error) {
          console.error(
            JSON.stringify({
              level: "error",
              event: "dlq_mark_failed_error",
              jobId: message.body?.jobId ?? "unknown",
              message: error instanceof Error ? error.message : "unknown",
            }),
          );
        }
        message.ack();
      }
      return;
    }
    for (const message of batch.messages)
      try {
        await processIngestion(message.body, env);
        message.ack();
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "ingestion_failed",
            jobId: (message.body as { jobId?: string } | null)?.jobId ?? "unknown",
            attempts: message.attempts,
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
        message.retry({ delaySeconds: Math.min(900, 2 ** message.attempts * 10) });
      }
  },
} satisfies ExportedHandler<Env, IngestionMessage>;
