import { describe, expect, it } from "vitest";
import { detectMimeType, extractDocument } from "./extraction";

describe("document extraction", () => {
  it("detects supported types from safe file extensions", () => {
    expect(detectMimeType(new File(["hello"], "notes.md"))).toBe("text/markdown");
    expect(detectMimeType(new File(["hello"], "records.csv"))).toBe("text/csv");
  });

  it("turns untrusted HTML into inert plain text", async () => {
    const result = await extractDocument(
      new File(
        [
          '<article><h1>Quarterly &amp; plan</h1><script>window.alert("unsafe")</script><p>Ship &#x1F680; carefully.</p></article>',
        ],
        "plan.html",
        { type: "text/html" },
      ),
    );

    expect(result.text).toBe("Quarterly & plan Ship 🚀 carefully.");
    expect(result.text).not.toContain("<script>");
    expect(result.chunks).toHaveLength(1);
  });
});
