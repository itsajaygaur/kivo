import { describe, expect, it } from "vitest";
import {
  can,
  canAccessCollection,
  chunkText,
  reciprocalRankFusion,
  decryptSecret,
  encryptSecret,
} from ".";
describe("authorization", () => {
  it("enforces role and collection grants", () => {
    expect(can("viewer", "documents:write")).toBe(false);
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(canAccessCollection("viewer", [], "c1", true)).toBe(false);
  });
});
describe("retrieval", () => {
  it("fuses ranks deterministically", () => {
    const result = reciprocalRankFusion([[{ id: "a" }, { id: "b" }], [{ id: "b" }]]);
    expect(result[0]?.id).toBe("b");
  });
});
describe("chunking", () => {
  it("normalizes and overlaps", () => {
    const chunks = chunkText("# One\n\n" + "Knowledge sentence. ".repeat(100), 250, 30);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.heading).toBe("One");
  });
});
describe("encryption", () => {
  it("round trips AES-GCM", async () => {
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    expect(await decryptSecret(await encryptSecret("secret", key), key)).toBe("secret");
  });
});
