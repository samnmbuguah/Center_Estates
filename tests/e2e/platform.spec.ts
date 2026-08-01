import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

async function openConstructionSection(page: Page, testInfo: TestInfo, name: string) {
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open construction navigation" }).click();
  }
  await page.getByRole("button", { name, exact: true }).click();
}

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
  await page.getByRole("button", { name: "Receipt allocations", exact: true }).click();
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

test("property approval and billing workflows are interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel property workflow races");
  await page.goto("/property");
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  const expense = page.getByRole("row").filter({ hasText: "EXP-LIFT-PENDING" });
  await expect(expense.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await expense.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(expense.getByText("approved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rent schedules", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generate invoice", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leases", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "LS-2026-DRAFT" }).getByRole("button", { name: "Activate", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Budgets", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Utilities" }).getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rent & invoices", exact: true }).click();
  const overdueInvoice = page.getByRole("row").filter({ hasText: "INV-2026-0702" });
  await overdueInvoice.getByRole("button", { name: "Send reminder", exact: true }).click();
  await page.getByRole("button", { name: "Reminders", exact: true }).click();
  await expect(page.getByText("INV-2026-0702", { exact: true }).first()).toBeVisible();
});

test("property arrears, service-charge and report data are connected", async ({ page }) => {
  await page.goto("/property");
  await page.getByRole("button", { name: "Arrears", exact: true }).click();
  await expect(page.getByText("Bluebird Retail Kenya", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Charge allocations", exact: true }).click();
  await expect(page.getByText(`${new Date().getFullYear()} Commercial Service Charge`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Westlands Business Centre", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Reconciliations", exact: true }).click();
  await expect(page.getByText("draft", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Bank reconciliation", exact: true }).click();
  await expect(page.getByText("FT260418ACACIA", { exact: true })).toBeVisible();
  await expect(page.getByText("matched", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Outstanding aging" }).getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("property-aging.csv");
});

test("tenant self-service uses the shared lease and billing ledger", async ({ page }) => {
  await page.goto("/tenant-portal");
  await expect(page.getByRole("heading", { name: /Good morning, Acacia Consulting Ltd/ })).toBeVisible();
  await expect(page.getByText("Westlands Business Centre · 101", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByText("INV-2026-0701", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Payments & receipts", exact: true }).click();
  await expect(page.getByText("RCT-2026-0418", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Messages & notices", exact: true }).click();
  await expect(page.getByText("Water shutdown notice", { exact: true })).toBeVisible();
});

test("tenant can submit a scoped maintenance request", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel tenant request races");
  const requestTitle = `E2E corridor light fault ${Date.now()}`;
  await page.goto("/tenant-portal");
  await page.getByRole("button", { name: "Report an issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Report an issue" });
  await dialog.getByLabel("Subject").fill(requestTitle);
  await dialog.getByLabel("Category").fill("Electrical");
  await dialog.getByLabel("Description").fill("The corridor light outside the unit is not working.");
  await dialog.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText(requestTitle, { exact: true })).toBeVisible();
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

test("facility preventive and service workflows are interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel maintenance races");
  await page.goto("/facility");
  await page.getByRole("button", { name: "Planned maintenance", exact: true }).click();
  const schedule = page.getByRole("row").filter({ hasText: "PM-LIFT-MONTHLY" });
  await expect(schedule.getByRole("button", { name: "Generate work order", exact: true })).toBeVisible();
  await schedule.getByRole("button", { name: "Generate work order", exact: true }).click();
  await page.getByRole("button", { name: "Work orders", exact: true }).click();
  await expect(page.getByText(/PM-PM-LIFT-MONTHLY/).first()).toBeVisible();
  await page.getByRole("button", { name: "Service requests", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "SR-2026-00123" }).getByRole("button", { name: "Resolve", exact: true })).toBeVisible();
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

test("sales buyer and commission workflows are controlled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel sales workflow races");
  await page.goto("/sales");
  await page.getByRole("button", { name: "Buyers", exact: true }).click();
  const lead = page.getByRole("row").filter({ hasText: "BUY-2026-0043" });
  await lead.getByRole("button", { name: "Qualify", exact: true }).click();
  await expect(lead.getByText("qualified", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Commissions", exact: true }).click();
  const commission = page.getByRole("row").filter({ hasText: "COM-2026-0029" });
  await commission.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(commission.getByText("approved", { exact: true })).toBeVisible();
});

test("sales performance and report exports use live data", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await page.getByRole("button", { name: "Agent performance", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Pipeline value" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.getByText("Payment reconciliation", { exact: true })).toBeVisible();
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Payment reconciliation" }).getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sales-payments.csv");
});

test("tender submission evidence and audit trail are connected", async ({ page }) => {
  await page.goto("/tender");
  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await expect(page.getByText("PPIP-RCT-260726-1048", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Audit trail", exact: true }).click();
  await expect(page.getByText("TND-2026-0039", { exact: true })).toBeVisible();
  await expect(page.getByText("submitted", { exact: true }).first()).toBeVisible();
});

test("tender approval controls and reports are interactive", async ({ page }, testInfo) => {
  await page.goto("/tender");
  await page.getByRole("button", { name: "Financial BOQ", exact: true }).click();
  await expect(page.getByText("FM-001", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.getByText("Requirement compliance matrix", { exact: true })).toBeVisible();
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Tender pipeline and deadlines" }).getByRole("button", { name: "Download CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("tender-pipeline.csv");
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

test("valuation analytics and evidence exports use live records", async ({ page }, testInfo) => {
  await page.goto("/valuation");
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Average fee" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.getByText("Comparable evidence analysis", { exact: true })).toBeVisible();
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Fees, payments and aging" }).getByRole("button", { name: "Download CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("valuation-fees.csv");
});

test("construction procurement inventory and stock ledger are connected", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Inventory");
  await expect(page.getByText("MAT-SEAL-01", { exact: true })).toBeVisible();
  await expect(page.getByText("Fire-rated sealant", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Purchase orders");
  await expect(page.getByText("PO-2026-0038", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Stock ledger");
  await expect(page.getByText("WO-019 / Level 6", { exact: true })).toBeVisible();
});

test("construction portfolio programme and risk workspaces are visual and connected", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Projects");
  await expect(page.locator(".construction-project-card").first()).toBeVisible();
  await expect(page.getByText("Open project workspace →", { exact: true }).first()).toBeVisible();
  await openConstructionSection(page, testInfo, "Programme");
  await expect(page.locator(".programme-row").first()).toBeVisible();
  await expect(page.getByText("Programme activities", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Risks");
  await expect(page.getByRole("heading", { name: "Exposure matrix", exact: true })).toBeVisible();
  await expect(page.locator(".risk-register-card").first()).toBeVisible();
});

test("construction controlled documents and issue discussion are connected", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Document revisions");
  await expect(page.getByText("Level 6 coordinated structural drawings", { exact: true })).toBeVisible();
  await expect(page.getByText("Rev B", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Issue discussion");
  await expect(page.getByText("level-6-corrective-plan.pdf", { exact: true })).toBeVisible();
});

test("construction governance registers and notification controls are connected", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Project team");
  await expect(page.getByText("Project administrator", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Requirement waivers");
  await expect(page.getByText("LEGACY_CONTRACT_IMPORT", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Progress verification");
  await expect(page.getByText("Progress evidence reviewed against the approved programme.", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Approvals");
  await expect(page.getByText("NCA-CE-2026-041", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Notifications");
  await expect(page.getByText("IPC-011 disbursed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("construction finance workflow actions are interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel workflow races");
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Variations");
  const proposal = page.getByRole("row").filter({ hasText: "VAR-2026-0028" });
  await expect(proposal.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
  await proposal.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(proposal.getByText("submitted", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Requisitions");
  await expect(page.getByRole("row").filter({ hasText: "Generator fuel float" }).getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Payments");
  await expect(page.getByRole("row").filter({ hasText: "425,000" }).getByRole("button", { name: "Mark paid", exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Drawdowns");
  await expect(page.getByRole("row").filter({ hasText: "DD-010" }).getByRole("button", { name: "Review documents", exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Provisional sums");
  await expect(page.getByRole("row").filter({ hasText: "PS-04" }).getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Advances");
  await expect(page.getByRole("row").filter({ hasText: "Apex Refurbishment Ltd" }).getByRole("button", { name: "Record recovery", exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Advance recoveries");
  await expect(page.getByText("IPC-011", { exact: true })).toBeVisible();
});

test("construction reports export tenant-scoped CSV files", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Reports");
  await expect(page.getByText(/W\d{2}/).first()).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export BoQ", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^boq-.*\.csv$/);
  expect(await download.failure()).toBeNull();
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
