import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./helpers";

const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill(ADMIN);
  await page.locator("#password").fill(PASS);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/);
}

test.beforeEach(async ({ page }) => signIn(page));


test("tender overview renders dashboard with KPIs and pipeline stepper", async ({ page }) => {
  await page.goto("/tender");
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(page.getByText("Pipeline Value", { exact: true })).toBeVisible();
  await expect(page.getByText("Drafted", { exact: true })).toBeVisible();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("Won", { exact: true })).toBeVisible();
  await expect(page.getByText("Invitation", { exact: true })).toBeVisible();
  await expect(page.getByText("AI Analysis")).toBeVisible();
  await expect(page.getByText("Award")).toBeVisible();
  await expect(page.getByText("Recent Tender Invitations")).toBeVisible();
});

test("tender invitations register shows tenders with stage filters", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Invitations");
  await expect(page.getByText("TND-2026-0047", { exact: true })).toBeVisible();
  await expect(page.locator(".stage-chip, button").filter({ hasText: "All" }).first()).toBeVisible();
  await expect(page.locator(".stage-chip, button").filter({ hasText: "Active" }).first()).toBeVisible();
  await page.getByRole("row").filter({ hasText: "TND-2026-0047" }).click();
  await expect(page.locator(".drawer, [role=dialog]").first()).toBeVisible();
});

test("AI analysis shows requirements grouped by category", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "AI Analysis");
  await expect(page.getByText("Eligibility")).toBeVisible();
  await expect(page.getByText("Technical")).toBeVisible();
  await expect(page.getByText("Financial")).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm|confirm/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit|edit/i }).first()).toBeVisible();
});

test("bid decisions show scoring and decision status", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Bid / No-bid");
  await expect(page.getByText("eligibility", { exact: true }).or(page.getByText("Eligibility", { exact: true }))).toBeVisible();
  await expect(page.getByText("profitability", { exact: true }).or(page.getByText("Profitability", { exact: true }))).toBeVisible();
  await expect(page.locator(".progress-bar, [role=progressbar]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Decide", exact: true }).or(page.getByRole("button", { name: /Decide/i }))).toBeVisible();
});

test("planning shows tasks with Gantt visualization", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Planning");
  await expect(page.getByRole("columnheader", { name: /Status|status/i }).or(page.getByText("Status", { exact: true }))).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Start|start/i }).or(page.getByText("Start", { exact: true }))).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Due|due/i }).or(page.getByText("Due", { exact: true }))).toBeVisible();
  await expect(page.locator(".gantt-bar, .gantt-chart, [class*=gantt]").first()).toBeVisible();
});

test("company documents vault shows document entries", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Company documents");
  await expect(page.getByText("Tax Compliance Certificate")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Expiry/i }).or(page.getByText(/\d{2}\/\d{2}\/\d{4}/).first())).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload", exact: true }).or(page.getByRole("button", { name: /Upload/i }))).toBeVisible();
});

test("proposals show sections with AI assisted badges", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Technical proposal");
  await expect(page.locator("table, [role=table], .data-table").first()).toBeVisible();
  await expect(page.getByText("AI Assisted").or(page.locator(".ai-badge, [class*=ai-badge]")).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Review", exact: true }).or(page.getByRole("button", { name: /Review/i }))).toBeVisible();
});

test("financial BOQ shows items with pricing summary", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Financial BOQ");
  await expect(page.getByRole("columnheader", { name: "Code", exact: true }).or(page.getByText("Code", { exact: true }))).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Description", exact: true }).or(page.getByText("Description", { exact: true }))).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Qty", exact: true }).or(page.getByText("Qty", { exact: true }))).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Rate/i }).or(page.getByText("Rate", { exact: true }))).toBeVisible();
  await expect(page.locator(".donut, [class*=donut], .pricing-summary").first()).toBeVisible();
});

test("reviews show gate status with readiness scores", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Review & approval");
  await expect(page.locator(".progress-bar, [role=progressbar]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true }).or(page.getByRole("button", { name: /Approve/i }))).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject", exact: true }).or(page.getByRole("button", { name: /Reject/i }))).toBeVisible();
});

test("packaging shows packages with TOC and export actions", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Packaging");
  await expect(page.getByRole("button", { name: "Create Package", exact: true }).or(page.getByRole("button", { name: /Create package/i }))).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test("tender submission evidence and audit trail are accessible", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Submissions");
  await expect(page.getByText("PPIP-RCT-260726-1048", { exact: true })).toBeVisible();
  await openTab(page, "Audit trail");
  await expect(page.getByText("TND-2026-0039", { exact: true })).toBeVisible();
  await expect(page.getByText("submitted", { exact: true }).first()).toBeVisible();
});

test("tender reports tab shows catalogue with export capability", async ({ page }) => {
  await page.goto("/tender");
  await openTab(page, "Reports");
  await expect(page.getByText("Requirement compliance matrix", { exact: true })).toBeVisible();
  await expect(page.getByText("Tender pipeline and deadlines", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" }).or(page.getByRole("button", { name: "Export" }))).toBeVisible();
});
