import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.getByLabel("Username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => signIn(page));

test("subscribed modules navigate through the unified shell", async ({ page }, testInfo) => {
  const modules = [
    ["Property", "Property Management"],
    ["Facility", "Facility Management"],
    ["Sales", "Sales Management"],
    ["Tender", "Tender Management"],
    ["Valuation", "Valuation"],
    ["Construction Monitoring", "Project monitoring"],
  ] as const;
  for (const [link, heading] of modules) {
    if (testInfo.project.name.startsWith("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator(".form-error")).toHaveCount(0);
  }
});

test("property rent ledger registers and receipt dialog are usable", async ({ page }) => {
  await page.goto("/property");
  await expect(page.getByText("Outstanding rent", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Receipts", exact: true }).click();
  await expect(page.getByText("RCT-2026-0418", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Allocations", exact: true }).click();
  await expect(page.getByText("INV-2026-0701", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Credit notes", exact: true }).click();
  await expect(page.getByText("CN-2026-0021", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Record receipt", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record and allocate receipt" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Open invoice")).not.toHaveValue("");
  await expect(dialog.getByLabel("Amount")).toHaveAttribute("max", "100000.00");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("facility work history, cost and media registers are connected", async ({ page }) => {
  await page.goto("/facility");
  await page.getByRole("button", { name: "Work history", exact: true }).click();
  await expect(page.getByText("Technician checked in and isolated the leaking joint.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Labor & parts", exact: true }).click();
  await expect(page.getByText("Compression fitting and pipe section", { exact: true })).toBeVisible();
  await expect(page.getByText("AquaFix Stores", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Work media", exact: true }).click();
  await expect(page.getByText("leak-before-repair.jpg", { exact: true })).toBeVisible();
});

test("sales payment verification and audit controls are connected", async ({ page }) => {
  await page.goto("/sales");
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.getByText("PAY-2026-0106", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Audit trail", exact: true }).click();
  await expect(page.getByText("PAY-2026-0098", { exact: true })).toBeVisible();
  await expect(page.getByText("payment verified", { exact: true })).toBeVisible();
});

test("tender submission evidence and audit trail are connected", async ({ page }) => {
  await page.goto("/tender");
  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await expect(page.getByText("PPIP-RCT-260726-1048", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Audit trail", exact: true }).click();
  await expect(page.getByText("TND-2026-0039", { exact: true })).toBeVisible();
  await expect(page.getByText("submitted", { exact: true }).first()).toBeVisible();
});

test("valuation final report, payment and audit evidence are connected", async ({ page }) => {
  await page.goto("/valuation");
  await page.getByRole("button", { name: "Final reports", exact: true }).click();
  await expect(page.getByText("VR-2026-0161-F", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.getByText("VPAY-2026-0032", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Audit trail", exact: true }).click();
  await expect(page.getByText("final report issued", { exact: true })).toBeVisible();
  await expect(page.getByText("payment allocated", { exact: true })).toBeVisible();
});

test("construction procurement inventory and stock ledger are connected", async ({ page }) => {
  await page.goto("/monitoring");
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(page.getByText("MAT-SEAL-01", { exact: true })).toBeVisible();
  await expect(page.getByText("Fire-rated sealant", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Purchase orders", exact: true }).click();
  await expect(page.getByText("PO-2026-0038", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stock ledger", exact: true }).click();
  await expect(page.getByText("WO-019 / Level 6", { exact: true })).toBeVisible();
});

test("construction controlled documents and issue discussion are connected", async ({ page }) => {
  await page.goto("/monitoring");
  await page.getByRole("button", { name: "Document revisions", exact: true }).click();
  await expect(page.getByText("Level 6 coordinated structural drawings", { exact: true })).toBeVisible();
  await expect(page.getByText("Rev B", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Issue discussion", exact: true }).click();
  await expect(page.getByText("level-6-corrective-plan.pdf", { exact: true })).toBeVisible();
});

test("mobile navigation opens, changes module and closes", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile navigation behavior");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Platform modules" })).toBeVisible();
  await page.getByRole("link", { name: "Property", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Property Management" })).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/mobile-open/);
});

test("authenticated module pages do not produce browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/property", "/facility", "/sales", "/tender", "/valuation", "/monitoring"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
