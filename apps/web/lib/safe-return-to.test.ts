import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  const token = "a".repeat(64);

  it("allows the app and invitation destinations", () => {
    expect(safeReturnTo("/app")).toBe("/app");
    expect(safeReturnTo(`/invite/${token}`)).toBe(`/invite/${token}`);
  });

  it.each([
    undefined,
    null,
    "",
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/%2f%2fexample.com",
    "/app/../invite/not-a-token",
    "/invite/not-a-token",
    `/invite/${token}?next=https://example.com`,
  ])("falls back to the app for an unsafe destination: %s", (value) => {
    expect(safeReturnTo(value)).toBe("/app");
  });
});
