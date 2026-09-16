import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openModuleSection } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => signIn(page));

test("construction suppliers page lists vendors with an add form", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openModuleSection(page, "Suppliers", testInfo);

  await expect(page.getByRole("heading", { name: "Suppliers", exact: true })).toBeVisible();
  await expect(page.getByText("Add Supplier", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Supplier" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Contact" })).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("material requests page lists requisitions with a create form", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openModuleSection(page, "Material requests", testInfo);

  await expect(page.getByRole("heading", { name: "Material Requests", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Reference" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();

  await page.getByRole("button", { name: /New Request/i }).click();
  await expect(page.getByText("New material requisition", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Submit requisition/i })).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("purchase orders page lists orders and offers a new-order form", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openModuleSection(page, "Purchase orders", testInfo);

  await expect(page.getByRole("heading", { name: "Purchase Orders", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "PO #" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Supplier" })).toBeVisible();

  await page.getByRole("button", { name: /New Purchase Order/i }).click();
  await expect(page.getByText("New purchase order", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create purchase order/i })).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("stock ledger renders movement types with totals", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openModuleSection(page, "Stock ledger", testInfo);

  await expect(page.getByRole("heading", { name: "Stock Ledger", exact: true })).toBeVisible();
  await expect(page.getByText("Goods receipt", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Issue", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Quantity" })).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("progress verification lists verification decisions", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openModuleSection(page, "Progress verification", testInfo);

  await expect(page.getByRole("heading", { name: "Progress Verification", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Milestone" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Decision" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Verifier" })).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("agent portal renders pipeline and commission sections for staff", async ({ page }) => {
  await page.goto("/agent-portal");

  const denied = page.getByText("not linked to a sales agent profile", { exact: false });
  if (await denied.count()) {
    test.info().annotations.push({ type: "note", description: "Admin account is not an agent in this org" });
    return;
  }

  await expect(page.getByText("Good day,", { exact: false })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "My Leads", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commissions", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Available Units", exact: true })).toBeVisible();
});

test("management fees register lists landlord fee invoices", async ({ page }, testInfo) => {
  await page.goto("/property");
  await openModuleSection(page, "Management Fees", testInfo);

  await expect(page.getByText("Management Fees & Landlord Invoicing", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate Fee Invoice/i })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
});
