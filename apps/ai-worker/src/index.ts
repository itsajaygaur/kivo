import { Hono } from "hono";
import {
  chatRequestSchema,
  problem,
  searchRequestSchema,
  type IngestionMessage,
} from "@kivo/shared";
import { streamGroundedAnswer } from "./generation";
import { processIngestion } from "./queue";
import { retrieve, toCitations } from "./retrieval";
const app = new Hono<{ Bindings: Env }>();
app.use("/internal/*", async (context, next) => {
  const token = context.env.INTERNAL_SERVICE_TOKEN;
  if (token && context.req.header("x-kivo-service-token") !== token)
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
  const body = await context.req.json<{ image: string }>();
  const result = await context.env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct" as never, {
    image: [...Uint8Array.from(atob(body.image), (char) => char.charCodeAt(0))],
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
    for (const message of batch.messages)
      try {
        await processIngestion(message.body, env);
        message.ack();
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "ingestion_failed",
            jobId: message.body.jobId,
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
        message.retry({ delaySeconds: Math.min(900, 2 ** message.attempts * 10) });
      }
  },
} satisfies ExportedHandler<Env, IngestionMessage>;
