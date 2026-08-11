import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await signInAs(page, process.env.E2E_ADMIN_USERNAME ?? "admin", password);
});

test("tenancy report tabs export the selected dataset as Excel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download fidelity is covered on desktop");
  await page.goto("/property?tab=tenancy-reports");
  await expect(page.getByRole("heading", { name: "Tenancy & occupancy reports" })).toBeVisible();
  await page.getByRole("tab", { name: "Tenancy schedule" }).click();
  await page.getByLabel("Format").click();
  await page.getByRole("option", { name: "Excel" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/tenancy-schedule.*\.xlsx$/);
});

test("financial VAT tab exports a branded PDF", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download fidelity is covered on desktop");
  await page.goto("/property?tab=financial-reports");
  await expect(page.getByRole("heading", { name: "Financial reports" })).toBeVisible();
  await page.getByRole("tab", { name: "VAT & statutory" }).click();
  await page.getByLabel("Format").click();
  await page.getByRole("option", { name: "PDF" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/vat-schedule.*\.pdf$/);
});
