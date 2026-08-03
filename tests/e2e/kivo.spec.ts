import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const document = {
  id: "doc_handbook",
  title: "Product handbook",
  filename: "product-handbook.md",
  mimeType: "text/markdown",
  bytes: 12640,
  status: "ready",
  progress: 100,
  collectionId: "col_product",
  collectionName: "Product & Engineering",
  updatedAt: Date.now(),
};

async function mockWorkspace(page: Page) {
  await page.route("**/api/v1/workspace", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "org_kivo",
          name: "Acme Research",
          slug: "acme-research",
          userName: "Ajay Sharma",
          userEmail: "ajay@example.com",
          role: "owner",
        },
      },
    }),
  );
  await page.route("**/api/v1/documents", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 201,
        json: { documentId: "doc_new", versionId: "ver_new", jobId: "job_new", upload: null },
      });
    return route.fulfill({ json: { data: [document], nextCursor: null } });
  });
  await page.route("**/api/v1/collections", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ status: 201, json: { id: "col_new" } });
    return route.fulfill({
      json: {
        data: [
          {
            id: "col_product",
            name: "Product & Engineering",
            description: "Product knowledge",
            restricted: 0,
            documentCount: 1,
          },
        ],
      },
    });
  });
  await page.route("**/api/v1/usage", (route) =>
    route.fulfill({
      json: {
        data: {
          documents: 1,
          documentLimit: 250,
          storageBytes: 12640,
          storageLimit: 524288000,
          members: 1,
          memberLimit: 25,
        },
      },
    }),
  );
  await page.route("**/api/v1/audit", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/v1/ocr", (route) =>
    route.fulfill({
      json: {
        response:
          "Product handbook OCR text with enough grounded content for indexing and retrieval.",
      },
    }),
  );
}

test("marketing explains the grounded product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your knowledge/ })).toBeVisible();
  await expect(page.getByText("Every answer has receipts")).toBeVisible();
});

test("workspace loads persisted documents and uploads extracted chunks", async ({ page }) => {
  await mockWorkspace(page);
  const chunkPayloads: Record<string, unknown>[] = [];
  await page.route("**/api/v1/chunks", async (route) => {
    chunkPayloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 202, json: { accepted: 1 } });
  });
  await page.goto("/app/documents");
  await expect(page.getByText("Product handbook").first()).toBeVisible();
  await page.getByRole("button", { name: /Upload documents/ }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles([
      path.join(process.cwd(), "tests/fixtures/product-handbook.md"),
      path.join(process.cwd(), "tests/fixtures/product-handbook.pdf"),
      path.join(process.cwd(), "tests/fixtures/product-handbook.docx"),
    ]);
  await expect.poll(() => chunkPayloads.length, { timeout: 15_000 }).toBe(3);
  expect(chunkPayloads.every(({ documentId }) => documentId === "doc_new")).toBe(true);
  expect(chunkPayloads.every(({ chunks }) => (chunks as unknown[]).length > 0)).toBe(true);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("search posts a query and renders ranked evidence", async ({ page }) => {
  await mockWorkspace(page);
  let query = "";
  await page.route("**/api/v1/search", async (route) => {
    query = (route.request().postDataJSON() as { query: string }).query;
    await route.fulfill({
      json: {
        data: [
          {
            id: "chk_northstar",
            title: "Product handbook",
            excerpt: "Weekly verified answers measure trusted knowledge.",
            page: 4,
            score: 0.94,
          },
        ],
      },
    });
  });
  await page.goto("/app/search");
  await page.getByLabel("Search knowledge").fill("north star metric");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Weekly verified answers")).toBeVisible();
  expect(query).toBe("north star metric");
});

test("chat streams a grounded answer and source", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
      body: [
        'data: {"type":"start"}',
        'data: {"type":"source-document","sourceId":"chk_northstar","mediaType":"text/plain","title":"Product handbook"}',
        'data: {"type":"text-start","id":"answer"}',
        'data: {"type":"text-delta","id":"answer","delta":"The north-star metric is weekly verified answers. [1]"}',
        'data: {"type":"text-end","id":"answer"}',
        'data: {"type":"finish"}',
        "data: [DONE]",
        "",
      ].join("\n\n"),
    }),
  );
  await page.goto("/app/chat");
  await page.getByRole("button", { name: "What is our north-star metric?" }).click();
  await page.getByLabel("Question").press("Enter");
  await expect(page.getByText("weekly verified answers", { exact: false })).toBeVisible();
  await expect(page.getByText("Product handbook").first()).toBeVisible();
});
