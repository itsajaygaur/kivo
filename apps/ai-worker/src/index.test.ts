import { describe, expect, it } from "vitest";
import worker from "./index";

const call = (request: Request, env: Partial<Env>) =>
  (worker.fetch as unknown as (request: Request, env: Partial<Env>) => Promise<Response>)(
    request,
    env,
  );

function searchRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://ai.internal/internal/search", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({}),
  });
}

describe("internal service authentication", () => {
  it("fails closed when the service token is not configured", async () => {
    const response = await call(searchRequest(), {});
    expect(response.status).toBe(503);
  });

  it("rejects requests without the service token header", async () => {
    const response = await call(searchRequest(), { INTERNAL_SERVICE_TOKEN: "secret" });
    expect(response.status).toBe(401);
  });

  it("rejects requests with a wrong service token", async () => {
    const response = await call(searchRequest({ "x-kivo-service-token": "wrong" }), {
      INTERNAL_SERVICE_TOKEN: "secret",
    });
    expect(response.status).toBe(401);
  });

  it("admits requests with the correct token (payload validation still applies)", async () => {
    const response = await call(searchRequest({ "x-kivo-service-token": "secret" }), {
      INTERNAL_SERVICE_TOKEN: "secret",
    });
    expect(response.status).toBe(422);
  });

  it("leaves health unauthenticated", async () => {
    const response = await call(new Request("https://ai.internal/health"), {});
    expect(response.status).toBe(200);
  });
});
