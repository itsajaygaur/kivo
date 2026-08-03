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
          userName: "Ajay Gaur",
          userEmail: "ajay@example.com",
          role: "owner",
          demo: false,
          platformAdmin: false,
          retentionDays: 30,
          maxDocuments: 250,
          maxStorageBytes: 524288000,
          maxMembers: 25,
        },
      },
    }),
  );
  await page.route("**/api/v1/workspaces", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "org_kivo",
            name: "Acme Research",
            slug: "acme-research",
            role: "owner",
            active: 1,
          },
        ],
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
  await page.route("**/api/v1/members", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "mem_owner",
            name: "Ajay Gaur",
            email: "ajay@example.com",
            role: "owner",
            joinedAt: Date.now() - 86_400_000,
          },
        ],
        invitations: [],
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

test("public demo entry creates an explicit demo session", async ({ page }) => {
  await mockWorkspace(page);
  let enteredDemo = false;
  await page.route("**/api/v1/auth-capabilities", (route) =>
    route.fulfill({
      json: {
        data: {
          emailPassword: true,
          passkeys: false,
          github: false,
          google: false,
          demo: true,
        },
      },
    }),
  );
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
  await page.route("**/api/v1/demo-session", (route) => {
    enteredDemo = route.request().method() === "POST";
    return route.fulfill({ status: 204 });
  });
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect.poll(() => enteredDemo).toBe(true);
  await expect(page).toHaveURL(/\/app$/);
});

test("collection managers can edit metadata and access", async ({ page }) => {
  await mockWorkspace(page);
  let collectionPatch: Record<string, unknown> | null = null;
  let accessUpdate: Record<string, unknown> | null = null;
  await page.route("**/api/v1/collections/col_product", async (route) => {
    collectionPatch = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { data: { updated: true } } });
  });
  await page.route("**/api/v1/collections/col_product/members", async (route) => {
    accessUpdate = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { data: { updated: true } } });
  });
  await page.goto("/app/collections");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Product & Engineering");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name", { exact: true }).fill("Product knowledge");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => collectionPatch).toMatchObject({ name: "Product knowledge" });
  await expect.poll(() => accessUpdate).toMatchObject({ memberIds: [] });
});

test("workspace owners can create member invitations", async ({ page }) => {
  await mockWorkspace(page);
  let invited: Record<string, unknown> | null = null;
  await page.route("**/api/v1/members", async (route) => {
    if (route.request().method() === "POST") {
      invited = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 201,
        json: { data: { inviteUrl: "https://kivo.test/invite/example" } },
      });
    }
    return route.fulfill({
      json: {
        data: [
          {
            id: "mem_owner",
            name: "Ajay Gaur",
            email: "ajay@example.com",
            role: "owner",
            joinedAt: Date.now(),
          },
        ],
        invitations: [],
      },
    });
  });
  await page.goto("/app/members");
  await page.getByLabel("Invite email").fill("new@example.com");
  await page.getByLabel("Invite role").selectOption("editor");
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect.poll(() => invited).toMatchObject({ email: "new@example.com", role: "editor" });
  await expect(page.getByText("https://kivo.test/invite/example")).toBeVisible();
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
  const answer = [
    "**North-star metric**",
    "",
    "- Weekly verified answers",
    "- Evidence-backed decisions",
    "",
    ...Array.from(
      { length: 24 },
      (_, index) => `${index + 1}. Supporting detail ${index + 1} from the product handbook.`,
    ),
  ].join("\n");

  await page.route("**/api/v1/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
      body: [
        'data: {"type":"start"}',
        'data: {"type":"source-document","sourceId":"chk_northstar","mediaType":"text/plain","title":"Product handbook"}',
        'data: {"type":"source-document","sourceId":"chk_northstar_2","mediaType":"text/plain","title":"Product handbook"}',
        'data: {"type":"text-start","id":"answer"}',
        `data: ${JSON.stringify({ type: "text-delta", id: "answer", delta: answer })}`,
        'data: {"type":"text-end","id":"answer"}',
        'data: {"type":"finish"}',
        "data: [DONE]",
        "",
      ].join("\n\n"),
    });
  });
  await page.goto("/app/chat");
  await page.getByRole("button", { name: "What is our north-star metric?" }).click();
  await page.getByLabel("Question").press("Enter");

  await expect(page.getByText("Finding relevant evidence")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".thinking-state .spin").evaluate((element) => {
        return getComputedStyle(element).animationName;
      }),
    )
    .not.toBe("none");

  await expect(page.getByText("weekly verified answers", { exact: false })).toBeVisible();
  await expect(page.locator('[data-streamdown="strong"]')).toHaveText("North-star metric");
  await expect(page.locator(".message-markdown")).not.toContainText("**");
  await expect(page.getByText("Product handbook", { exact: true })).toHaveCount(2);

  await expect
    .poll(() =>
      page.locator(".chat-scroll-viewport").evaluate((element) => {
        return element.scrollHeight - element.clientHeight - element.scrollTop;
      }),
    )
    .toBeLessThan(3);

  await page
    .locator(".chat-scroll-viewport")
    .dispatchEvent("wheel", { deltaY: -1000, bubbles: true });
  await page.locator(".chat-scroll-viewport").evaluate((element) => element.scrollTo({ top: 0 }));
  await expect(page.getByRole("button", { name: "Scroll to latest message" })).toBeVisible();
  await page.getByRole("button", { name: "Scroll to latest message" }).click();
  await expect
    .poll(() =>
      page.locator(".chat-scroll-viewport").evaluate((element) => {
        return element.scrollHeight - element.clientHeight - element.scrollTop;
      }),
    )
    .toBeLessThan(3);
});
