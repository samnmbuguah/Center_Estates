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
  await page.getByRole("button", { name: /Export Excel/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/tenancy-schedule.*\.xlsx$/);
  await expect(page.getByText(/exported as XLSX/i)).toBeVisible();
});

test("financial VAT tab exports a branded PDF", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download fidelity is covered on desktop");
  await page.goto("/property?tab=financial-reports");
  await expect(page.getByRole("heading", { name: "Financial reports" })).toBeVisible();
  await page.getByRole("tab", { name: "VAT & statutory" }).click();
  await page.getByLabel("Format").click();
  await page.getByRole("option", { name: "PDF" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export PDF/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/vat-schedule.*\.pdf$/);
  await expect(page.getByText(/exported as PDF/i)).toBeVisible();
});

test("critical financial pack cards export tenant payments status PDF", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download fidelity is covered on desktop");
  await page.goto("/property?tab=financial-reports");
  await expect(page.getByRole("heading", { name: "Financial reports" })).toBeVisible();
  await expect(page.getByText("Critical financial packs")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Tenants payment's status as PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/tenant-payment-status.*\.pdf$/);
});

test("period presets refresh financial report KPIs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Filter controls are desktop-first");
  await page.goto("/property?tab=financial-reports");
  await expect(page.getByRole("heading", { name: "Financial reports" })).toBeVisible();
  await page.getByLabel("Period").click();
  await page.getByRole("option", { name: "Year to date", exact: true }).click();
  await expect(page.getByText("Total billed")).toBeVisible();
  await expect(page.getByText("Collection rate")).toBeVisible();
});

test("tenancy critical packs expose vacancy and lease expiry exports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download fidelity is covered on desktop");
  await page.goto("/property?tab=tenancy-reports");
  await expect(page.getByText("Critical tenancy packs")).toBeVisible();
  await expect(page.getByText("Vacancy register")).toBeVisible();
  await expect(page.getByRole("article", { name: "Lease expiry" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Vacancy register as Excel", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/vacancy.*\.xlsx$/);
});
