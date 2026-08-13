import { describe, expect, it } from "vitest";
import {
  boundedEvidence,
  can,
  canAccessCollection,
  chunkText,
  quotaViolation,
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
  it("does not let duplicate ids within one list outrank cross-list agreement", () => {
    const result = reciprocalRankFusion([
      [{ id: "agreed" }, { id: "dupe" }, { id: "dupe" }, { id: "dupe" }],
      [{ id: "agreed" }],
    ]);
    expect(result[0]?.id).toBe("agreed");
  });
  it("bounds evidence by character budget", () => {
    const result = boundedEvidence(
      [{ content: "a".repeat(90) }, { content: "b".repeat(90) }, { content: "c".repeat(10) }],
      100,
    );
    expect(result.map(({ content }) => content[0])).toEqual(["a", "c"]);
  });
});
describe("quotas", () => {
  it("enforces the OCR page limit", () => {
    expect(
      quotaViolation({ documents: 0, storageBytes: 0, members: 1, ocrPages: 100 }, { ocrPages: 1 }),
    ).toContain("ocrPages");
  });
  it("passes when usage stays within limits", () => {
    expect(
      quotaViolation({ documents: 10, storageBytes: 10, members: 1, ocrPages: 0 }, {}),
    ).toBeNull();
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
