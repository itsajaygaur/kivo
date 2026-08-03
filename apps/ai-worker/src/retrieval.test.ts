import { describe, expect, it } from "vitest";
import { toCitations } from "./retrieval";
describe("citations", () => {
  it("preserves source identifiers", () => {
    expect(
      toCitations([
        {
          id: "c",
          chunkId: "c",
          documentId: "d",
          versionId: "v",
          collectionId: "x",
          title: "Handbook",
          content: "grounded",
          excerpt: "grounded",
          page: 2,
          score: 0.9,
          rank: 0,
        },
      ])[0],
    ).toMatchObject({ chunkId: "c", documentId: "d", page: 2 });
  });
});
