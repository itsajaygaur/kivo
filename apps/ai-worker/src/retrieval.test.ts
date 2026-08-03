import { describe, expect, it } from "vitest";
import { isCollectionAuthorized, toCitations } from "./retrieval";
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
describe("collection authorization", () => {
  it("excludes collections outside the actor grant", () => {
    expect(isCollectionAuthorized("restricted", { authorizedCollectionIds: ["open"] })).toBe(false);
    expect(isCollectionAuthorized("open", { authorizedCollectionIds: ["open"] })).toBe(true);
    expect(isCollectionAuthorized(null, { authorizedCollectionIds: ["open"] })).toBe(true);
  });
  it("honors a narrower user-selected scope", () => {
    expect(
      isCollectionAuthorized("open", {
        authorizedCollectionIds: ["open", "other"],
        collectionIds: ["other"],
      }),
    ).toBe(false);
  });
});
