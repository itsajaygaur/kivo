import { describe, expect, it, vi } from "vitest";
import type { ChatRequest, RankedChunk } from "@kivo/shared";
import { decodeWorkersAIStream, generatedText, streamGroundedAnswer } from "./generation";

const encoder = new TextEncoder();

function byteStream(...parts: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

async function decoded(stream: ReadableStream<Uint8Array>): Promise<string> {
  let text = "";
  for await (const delta of decodeWorkersAIStream(stream)) text += delta;
  return text;
}

describe("Workers AI generation streams", () => {
  it("decodes native and Chat Completions SSE across byte boundaries", async () => {
    const stream = byteStream(
      'data: {"response":"Hello"}\n\ndata: {"choices":[{"delta":{"content":" from',
      ' chat"}}]}\n\ndata: [DONE]',
    );

    await expect(decoded(stream)).resolves.toBe("Hello from chat");
  });

  it("decodes Responses API deltas without duplicating the completed text", async () => {
    const stream = byteStream(
      'data: {"type":"response.output_text.delta","delta":"Grounded answer"}\n\n',
      'data: {"type":"response.output_text.done","text":"Grounded answer"}\n\n',
      "data: [DONE]\n\n",
    );

    await expect(decoded(stream)).resolves.toBe("Grounded answer");
  });

  it("uses a completed event when no delta was emitted", async () => {
    const stream = byteStream(
      'data: {"type":"response.output_text.done","text":"Recovered completed text"}',
    );

    await expect(decoded(stream)).resolves.toBe("Recovered completed text");
  });

  it("extracts synchronous Responses and Chat Completions output", () => {
    expect(generatedText({ output_text: "Responses answer" })).toBe("Responses answer");
    expect(generatedText({ choices: [{ message: { content: "Chat Completions answer" } }] })).toBe(
      "Chat Completions answer",
    );
  });
});

describe("grounded answer recovery", () => {
  it("retries synchronously when the model stream contains no text", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(byteStream("data: [DONE]\n\n"))
      .mockResolvedValueOnce({ output_text: "Recovered answer" });
    const env = {
      AI: { run },
      GENERATION_MODEL: "@cf/openai/gpt-oss-20b",
    } as unknown as Env;
    const request: ChatRequest = {
      organizationId: "org",
      query: "What is supported?",
      messages: [{ role: "user", content: "What is supported?" }],
      limit: 10,
    };
    const chunk: RankedChunk = {
      id: "chunk",
      chunkId: "chunk",
      documentId: "document",
      versionId: "version",
      collectionId: "collection",
      title: "Handbook",
      content: "The supported answer is in this evidence.",
      excerpt: "The supported answer",
      page: 1,
      score: 0.9,
      rank: 0,
    };

    const response = streamGroundedAnswer(env, request, [chunk]);
    const body = await response.text();

    expect(run).toHaveBeenCalledTimes(2);
    expect(body).toContain("Recovered answer");
    expect(body).toContain('"type":"text-delta"');
  });
});
