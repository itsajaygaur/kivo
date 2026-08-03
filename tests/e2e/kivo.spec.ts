import { expect, test } from "@playwright/test";
test("marketing explains the grounded product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your knowledge/ })).toBeVisible();
  await expect(page.getByText("Every answer has receipts")).toBeVisible();
});
test("demo workspace exposes primary knowledge journeys", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
  await page.getByRole("link", { name: "Documents" }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await page.getByRole("button", { name: /Upload documents/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("chat produces cited evidence", async ({ page }) => {
  await page.goto("/app/chat");
  await page.getByRole("button", { name: "Summarize our Q3 product strategy" }).click();
  await page.getByLabel("Question").press("Enter");
  await expect(page.getByText("weekly verified answers", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Product handbook", { exact: false }).first()).toBeVisible();
});
