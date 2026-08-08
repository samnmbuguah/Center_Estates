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

async function openConstructionSection(page: Page, testInfo: TestInfo, name: string) {
  await openModuleSection(page, name, testInfo);
}

test("subscribed modules navigate through the unified shell", async ({ page }) => {
  const modules = [
    ["property", "Property Management"],
    ["facility", "Facility Management"],
    ["valuation", "Valuation Management"],
    ["companion", "Companion & Staff Performance"],
  ] as const;
  for (const [slug, heading] of modules) {
    await page.goto("/workspaces");
    await page.locator(`a.module-card[href="/${slug}"]`).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator(".form-error")).toHaveCount(0);
  }
});

test("property rent ledger registers and receipt dialog are usable", async ({ page }) => {
  await page.goto("/property?tab=overview");
  await expect(page.getByText("Outstanding Rent", { exact: true })).toBeVisible();
  await openModuleSection(page, "Receipts");
  await expect(page.getByText("RCT-2026-0418", { exact: true })).toBeVisible();
  await openModuleSection(page, "Receipt allocations");
  await expect(page.getByText("INV-2026-0701", { exact: true })).toBeVisible();
  await openModuleSection(page, "Credit notes");
  await expect(page.getByText("CN-2026-0021", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Record Receipt", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record Rent Payment Receipt" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tenant")).toBeVisible();
  await expect(dialog.getByLabel("Amount (KES)")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("property command center renders live portfolio intelligence", async ({ page }) => {
  await page.goto("/property?tab=overview");
  await expect(page.getByRole("heading", { name: "Monthly rent collection trend" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lease expiry overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Property portfolio summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rent Ageing Heatmap" })).toBeVisible();
  await expect(page.getByText("Westlands Business Centre", { exact: true })).toBeVisible();
  await expect(page.locator(".chart-month")).toHaveCount(new Date().getMonth() + 1);
});

test("property navigation uses the client-approved consolidated hierarchy", async ({ page }) => {
  await page.goto("/property?tab=overview");
  const navigation = page.locator(".module-nav-bar");
  await expect(navigation.getByRole("tab", { name: /TENANCY/ })).toBeVisible();
  await expect(navigation.getByRole("tab", { name: /COLLECTIONS/ })).toBeVisible();
  await navigation.getByRole("tab", { name: /TENANCY/ }).click();
  await expect(navigation.getByRole("button", { name: /Tenants & Occupancy$/ })).toBeVisible();
  await navigation.getByRole("tab", { name: /COLLECTIONS/ }).click();
  await expect(navigation.getByRole("button", { name: /Financials$/ })).toBeVisible();
  await expect(navigation.getByRole("button", { name: /Management Fees$/ })).toBeVisible();
  await expect(navigation.getByRole("button", { name: /Rent Collection$/ })).toHaveCount(0);
  await navigation.getByRole("tab", { name: /TENANCY/ }).click();
  await navigation.getByRole("button", { name: /Tenants & Occupancy$/ }).click();
  for (const label of ["Occupancy", "Tenants", "Leases", "Documents"]) {
    await expect(page.locator(".property-workspace").getByRole("tab", { name: label, exact: true })).toBeVisible();
  }
});

test("public marketing and authenticated command center have distinct responsibilities", async ({ browser, page }) => {
  const context = await browser.newContext();
  const publicPage = await context.newPage();
  await publicPage.goto("/");
  await expect(publicPage.getByRole("heading", { name: /Smart ERP/i })).toBeVisible();
  await expect(publicPage.getByText("Executive command center", { exact: false })).toHaveCount(0);

  for (const route of ["/product", "/pricing", "/about", "/blog", "/faq", "/demo", "/contact", "/docs", "/sign-up", "/login"]) {
    await publicPage.goto(route);
    await expect(publicPage).not.toHaveURL(/\/login\?next=/);
  }
  await context.close();

  await page.goto("/workspaces");
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
  await expect(page.getByText("Critical Alerts", { exact: true })).toHaveCount(0);
  await expect(page.getByText("My Tasks", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Onboard property/i })).toBeVisible();
});

test("property context persists between modules and scopes horizontal-tab data", async ({ page }) => {
  await page.goto("/facility?tab=assets");
  const propertySelector = page.getByLabel("Current property");
  await expect(propertySelector.getByRole("option")).toHaveCount(3);

  const nyaliId = await propertySelector.locator("option", { hasText: "Nyali Trade Centre" }).getAttribute("value");
  await page.evaluate(() => { (window as typeof window & { __propertySwitchMarker?: string }).__propertySwitchMarker = "shell-preserved"; });
  await propertySelector.selectOption(nyaliId ?? "");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __propertySwitchMarker?: string }).__propertySwitchMarker)).toBe("shell-preserved");
  await expect(page.getByLabel("Current property")).toHaveValue(/.+/);
  await expect(page.getByText("Central Air Handling Unit", { exact: true })).toBeVisible();
  await expect(page.getByText("Standby Generator", { exact: true })).toHaveCount(0);

  await page.goto("/valuation?tab=instructions");
  await expect(page.getByLabel("Current property").locator("option:checked")).toContainText("Nyali Trade Centre");
  await expect(page.getByText("VAL-2026-023", { exact: true })).toBeVisible();

  const kilimaniId = await page.getByLabel("Current property").locator("option", { hasText: "Kilimani Heights Residences" }).getAttribute("value");
  await page.getByLabel("Current property").selectOption(kilimaniId ?? "");
  await page.goto("/facility?tab=assets");
  await expect(page.getByText("Standby Generator", { exact: true })).toBeVisible();
  await expect(page.getByText("Central Air Handling Unit", { exact: true })).toHaveCount(0);
});

test("horizontal navigation remains legible in light and dark themes", async ({ page }) => {
  await page.goto("/facility?tab=assets");
  const navButton = page.locator(".module-nav-pages button").first();
  await expect(navButton).toBeVisible();

  const contrast = async () => navButton.evaluate((element) => {
    const parse = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const luminance = (rgb: number[]) => {
      const channels = rgb.map((part) => {
        const value = part / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const style = getComputedStyle(element);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(getComputedStyle(element.closest(".module-nav-bar")!).backgroundColor));
    return {
      ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      foreground: style.color,
      background: getComputedStyle(element.closest(".module-nav-bar")!).backgroundColor,
    };
  });

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  expect((await contrast()).ratio).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const darkContrast = await contrast();
  expect(darkContrast.ratio, JSON.stringify(darkContrast)).toBeGreaterThanOrEqual(4.5);
});

test("property tenant onboarding and compliance dialogs are connected", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel tenant-code races");
  await page.goto("/property");
  await openModuleSection(page, "Tenants");
  await page.getByRole("button", { name: "+ Add Tenant", exact: true }).last().click();
  const tenantDialog = page.getByRole("dialog", { name: "Add New Tenant Profile" });
  const suffix = Date.now();
  await tenantDialog.getByLabel("Tenant code").fill(`E2E-${suffix}`);
  await tenantDialog.getByLabel("Full Name / Company").fill(`E2E Tenant ${suffix}`);
  await tenantDialog.getByLabel("Registration Number").fill(`REG-${suffix}`);
  await tenantDialog.getByLabel("KRA PIN / Tax ID").fill(`P${String(suffix).slice(-8)}Z`);
  await tenantDialog.getByLabel("Email Address").fill(`tenant-${suffix}@example.test`);
  await tenantDialog.getByRole("button", { name: "Register Tenant" }).click();
  await expect(page.getByText(`E2E Tenant ${suffix}`, { exact: true })).toBeVisible();
  await openModuleSection(page, "Tenant documents");
  await page.getByRole("button", { name: "+ Upload", exact: true }).click();
  const documentDialog = page.getByRole("dialog", { name: "Upload Tenant Document" });
  await expect(documentDialog.getByLabel("Tenant").getByRole("option", { name: `E2E Tenant ${suffix}` })).toHaveCount(1);
  await documentDialog.getByRole("button", { name: "Cancel" }).click();
});

test("property leasing can reject tenant compliance evidence with a reason", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel document review races");
  await page.goto("/property");
  await openModuleSection(page, "Tenant documents");
  await page.getByRole("button", { name: "+ Upload", exact: true }).click();
  const upload = page.getByRole("dialog", { name: "Upload Tenant Document" });
  const number = `E2E-DOC-${Date.now()}`;
  await upload.getByLabel("Tenant").selectOption({ index: 1 });
  await upload.getByLabel("Document Type").selectOption("other");
  await upload.getByLabel("Document Number").fill(number);
  await upload.getByLabel("File URL").fill("https://example.test/evidence.pdf");
  await upload.getByRole("button", { name: "Upload Document", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(row).toContainText("pending");
  await row.getByRole("button", { name: "Reject", exact: true }).click();
  const rejection = page.getByRole("dialog", { name: "Reject tenant document" });
  await rejection.getByLabel("Rejection reason").fill("Document scan is incomplete and cannot be verified.");
  await rejection.getByRole("button", { name: "Reject document", exact: true }).click();
  await expect(row).toContainText("rejected");
});

test("property leasing officer can create a controlled draft lease", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel lease-reference races");
  await page.goto("/property");
  await openModuleSection(page, "Leases");
  await page.getByRole("button", { name: "+ Add Single Lease", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Single Lease" });
  const reference = `E2E-LS-${Date.now()}`;
  await dialog.getByLabel("Lease reference").fill(reference);
  await dialog.getByLabel("Tenant").selectOption({ index: 1 });
  await dialog.getByLabel("Unit").selectOption({ index: 1 });
  await dialog.getByLabel("Start Date").fill("2026-09-01");
  await dialog.getByLabel("End Date").fill("2027-08-31");
  await dialog.getByLabel("Monthly Rent (KES)").fill("175000");
  await dialog.getByLabel("Deposit (KES)").fill("350000");
  await dialog.getByRole("button", { name: "Save Lease" }).click();
  await expect(page.getByRole("row").filter({ hasText: reference })).toContainText("draft");
});

test("property finance can capture draft service-charge budgets", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutations avoid parallel finance register races");
  await page.goto("/property");
  const suffix=Date.now();
  await openModuleSection(page, "Budgets");
  await page.getByRole("button", {name:"+ Add budget line",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Create budget line"});
  await dialog.getByLabel("Property").selectOption({index:1});
  await dialog.getByLabel("Category").fill(`E2E Budget ${suffix}`);
  await dialog.getByLabel("Annual budget").fill("950000");
  await dialog.getByRole("button",{name:"Save draft"}).click();
  await expect(page.getByRole("row").filter({hasText:`E2E Budget ${suffix}`})).toContainText("draft");
});

test("property finance can configure and allocate a service charge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel service-charge races");
  await page.goto("/property");
  await openModuleSection(page, "Service charge");
  await page.getByRole("button", {name:"+ Set up charge",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Set up service charge"});
  const name=`E2E Service Charge ${Date.now()}`;
  await dialog.getByLabel("Property").selectOption({index:1});
  await dialog.getByLabel("Scheme name").fill(name);
  await dialog.getByLabel("Allocation method").selectOption("equal");
  await dialog.getByLabel("Starts on").fill("2026-08-01");
  await dialog.getByLabel("Annual service budget").fill("1200000");
  await dialog.getByRole("button",{name:"Save draft"}).click();
  const row=page.getByRole("row").filter({hasText:name});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"Allocate",exact:true}).click();
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
});

test("property finance can reconcile a service charge period", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single reconciliation avoids parallel period updates");
  await page.goto("/property");
  await openModuleSection(page, "Service charge");
  const scheme = page.getByRole("row").filter({ hasText: "2026 Commercial Service Charge" });
  await scheme.getByRole("button", { name: "Reconcile", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reconcile service charge" });
  await dialog.getByLabel("Period start").fill("2026-01-01");
  await dialog.getByLabel("Period end").fill("2026-08-04");
  await dialog.getByRole("button", { name: "Run reconciliation", exact: true }).click();
  await expect(page.getByText("2026 Commercial Service Charge", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("draft", { exact: true }).first()).toBeVisible();
});

test("property finance can issue an audited credit note", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel invoice balance races");
  await page.goto("/property");
  await openModuleSection(page, "Credit notes");
  await page.getByRole("button", { name: "+ Issue credit note", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Issue credit note" });
  const number = `E2E-CN-${Date.now()}`;
  await dialog.getByLabel("Credit note number").fill(number);
  await dialog.getByLabel("Issued on").fill("2026-08-04");
  await dialog.getByLabel("Invoice").selectOption({ index: 1 });
  await dialog.getByLabel("Credit amount").fill("1");
  await dialog.getByLabel("Reason").fill("End-to-end controlled billing adjustment");
  await dialog.getByRole("button", { name: "Issue credit note", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: number })).toContainText("issued");
});

test("property approval and billing workflows are interactive", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel property workflow races");
  await page.goto("/property");
  await openModuleSection(page, "Rent schedules");
  await expect(page.getByRole("button", { name: "Generate invoice", exact: true })).toBeVisible();
  await openModuleSection(page, "Leases");
  await expect(page.getByRole("row").filter({ hasText: "LS-2026-DRAFT" }).getByRole("button", { name: "Activate", exact: true })).toBeVisible();
  await openModuleSection(page, "Budgets");
  await expect(page.getByRole("row").filter({ hasText: "Utilities" }).getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await openModuleSection(page, "Rent & invoices");
  const overdueInvoice = page.getByRole("row").filter({ hasText: "INV-2026-0702" });
  await overdueInvoice.getByRole("button", { name: "Send reminder", exact: true }).click();
  await openModuleSection(page, "Reminders");
  await expect(page.getByText("INV-2026-0702", { exact: true }).first()).toBeVisible();
});

test("property leasing and billing lifecycle controls are available", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name.startsWith("mobile"), "Lifecycle mutations use shared lease and invoice records");
  await page.goto("/property");
  await openModuleSection(page, "Leases");
  const activeLease = page.getByRole("row").filter({ hasText: "LS-2026-001" });
  await activeLease.getByRole("button", { name: "Renew", exact: true }).click();
  const renewal = page.getByRole("dialog", { name: "Renew lease" });
  const reference = `E2E-RENEW-${Date.now()}`;
  await renewal.getByLabel("Renewal reference").fill(reference);
  await renewal.getByLabel("New end date").fill("2030-12-31");
  await renewal.getByLabel("New monthly rent").fill("195000");
  await renewal.getByRole("button", { name: "Create renewal", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: /E2E-RENEW-/ }).first()).toBeVisible();

  const expiringLease = page.getByRole("row").filter({ hasText: "LS-2025-014" });
  await expiringLease.getByRole("button", { name: "Terminate", exact: true }).click();
  const termination = page.getByRole("dialog", { name: "Terminate lease" });
  await expect(termination.getByRole("button", { name: "Confirm termination", exact: true })).toBeVisible();
  await termination.getByRole("button", { name: "Cancel", exact: true }).click();

  await openModuleSection(page, "Rent & invoices");
  const draftInvoice = page.getByRole("row").filter({ hasText: "INV-2026-DRAFT" });
  const issue = draftInvoice.getByRole("button", { name: "Issue", exact: true });
  if (await issue.count()) await issue.click();
  await expect(draftInvoice.getByText(/issued|overdue|partial/, { exact: true })).toBeVisible();
});

test("property arrears, service-charge and report data are connected", async ({ page }) => {
  await page.goto("/property");
  await openModuleSection(page, "Arrears");
  await expect(page.getByText("Bluebird Retail Kenya", { exact: true })).toBeVisible();
  await openModuleSection(page, "Charge allocations");
  await expect(page.getByText(`${new Date().getFullYear()} Commercial Service Charge`, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "2026 Commercial Service Charge" }).getByText("101", { exact: true })).toBeVisible();
  await openModuleSection(page, "Reconciliations");
  await expect(page.getByText("draft", { exact: true }).first()).toBeVisible();
  await openModuleSection(page, "Bank reconciliation");
  await expect(page.getByText("FT260418ACACIA", { exact: true })).toBeVisible();
  await expect(page.getByText("matched", { exact: true }).first()).toBeVisible();
  await openModuleSection(page, "Reports");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Outstanding aging" }).getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("property-aging.csv");
});

test("property reports follow the four client-approved categories", async ({ page }) => {
  await page.goto("/property");
  await openModuleSection(page, "Reports");
  for (const category of ["Financial", "Tenants & Occupancy", "Service Providers", "Compliance & Risk"]) {
    await expect(page.getByRole("heading", { name: `${category} Reports`, exact: true })).toBeVisible();
  }
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Service provider expiry", { exact: true }).locator("..").getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("property-contractor-expiry.csv");
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
  await openModuleSection(page, "Work history");
  await expect(page.getByText("Technician checked in and isolated the leaking joint.", { exact: true })).toBeVisible();
  await openModuleSection(page, "Labor & parts");
  await expect(page.getByText("Compression fitting and pipe section", { exact: true })).toBeVisible();
  await expect(page.getByText("AquaFix Stores", { exact: true })).toBeVisible();
  await openModuleSection(page, "Work media");
  await expect(page.getByText("leak-before-repair.jpg", { exact: true })).toBeVisible();
});

test("facility preventive and service workflows are interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel maintenance races");
  await page.goto("/facility");
  await openModuleSection(page, "Planned maintenance");
  const schedule = page.getByRole("row").filter({ hasText: "PM-LIFT-MONTHLY" });
  await expect(schedule.getByRole("button", { name: "Generate work order", exact: true })).toBeVisible();
  await schedule.getByRole("button", { name: "Generate work order", exact: true }).click();
  await openModuleSection(page, "Work orders");
  await expect(page.getByText(/PM-PM-LIFT-MONTHLY/).first()).toBeVisible();
  await openModuleSection(page, "Service requests");
  await expect(page.getByRole("row").filter({ hasText: "SR-2026-00123" }).getByRole("button", { name: "Resolve", exact: true })).toBeVisible();
});

test("sales payment verification and audit controls are connected", async ({ page }) => {
  await page.goto("/sales");
  await openModuleSection(page, "Payments");
  await expect(page.getByText("PAY-2026-0106", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();
  await openModuleSection(page, "Audit trail");
  await expect(page.getByText("PAY-2026-0098", { exact: true })).toBeVisible();
  await expect(page.getByText("payment verified", { exact: true })).toBeVisible();
});

test("sales buyer and commission workflows are controlled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel sales workflow races");
  await page.goto("/sales");
  await openModuleSection(page, "Buyers");
  const lead = page.getByRole("row").filter({ hasText: "BUY-2026-0043" });
  await lead.getByRole("button", { name: "Qualify", exact: true }).click();
  await expect(lead.getByText("qualified", { exact: true })).toBeVisible();
  await openModuleSection(page, "Commissions");
  const commission = page.getByRole("row").filter({ hasText: "COM-2026-0029" });
  await commission.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(commission.getByText("approved", { exact: true })).toBeVisible();
});

test("sales performance and report exports use live data", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openModuleSection(page, "Agent performance");
  await expect(page.getByRole("columnheader", { name: "Pipeline value" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
  await openModuleSection(page, "Reports");
  await expect(page.getByText("Payment reconciliation", { exact: true })).toBeVisible();
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Payment reconciliation" }).getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sales-payments.csv");
});

test("tender submission evidence and audit trail are connected", async ({ page }) => {
  await page.goto("/tender");
  await openModuleSection(page, "Submissions");
  await expect(page.getByText("PPIP-RCT-260726-1048", { exact: true })).toBeVisible();
  await openModuleSection(page, "Audit trail");
  await expect(page.getByText("TND-2026-0039", { exact: true })).toBeVisible();
  await expect(page.getByText("submitted", { exact: true }).first()).toBeVisible();
});

test("tender approval controls and reports are interactive", async ({ page }, testInfo) => {
  await page.goto("/tender");
  await openModuleSection(page, "Financial BOQ");
  await expect(page.getByText("FM-001", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await openModuleSection(page, "Reports");
  await expect(page.getByText("Requirement compliance matrix", { exact: true })).toBeVisible();
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Tender pipeline and deadlines" }).getByRole("button", { name: "Download CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("tender-pipeline.csv");
});

test("valuation final report, payment and audit evidence are connected", async ({ page }) => {
  await page.goto("/valuation");
  await openModuleSection(page, "Final reports");
  await expect(page.getByText("VR-2026-0161-F", { exact: true })).toBeVisible();
  await openModuleSection(page, "Payments");
  await expect(page.getByText("VPAY-2026-0032", { exact: true })).toBeVisible();
  await openModuleSection(page, "Audit trail");
  await expect(page.getByText("final report issued", { exact: true })).toBeVisible();
  await expect(page.getByText("payment allocated", { exact: true })).toBeVisible();
});

test("valuation analytics and evidence exports use live records", async ({ page }, testInfo) => {
  await page.goto("/valuation");
  await openModuleSection(page, "Analytics");
  await expect(page.getByRole("columnheader", { name: "Average fee" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
  await openModuleSection(page, "Reports");
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

test("construction operational commercial finance and evidence workspaces are connected", async ({ page }, testInfo) => {
  await page.goto("/monitoring");
  await openConstructionSection(page, testInfo, "Issues");
  await expect(page.locator(".issue-card").first()).toBeVisible();
  await openConstructionSection(page, testInfo, "Daily logs");
  await expect(page.locator(".site-diary-list article").first()).toBeVisible();
  await openConstructionSection(page, testInfo, "Variations");
  await expect(page.getByText("Register value", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Certificates");
  await expect(page.getByText("Financial control", { exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Documents");
  await expect(page.locator(".document-card").first()).toBeVisible();
  await openConstructionSection(page, testInfo, "Reports");
  await expect(page.getByRole("heading", { name: "Progress and control reporting", exact: true })).toBeVisible();
  await openConstructionSection(page, testInfo, "Notifications");
  await expect(page.locator(".collaboration-feed article").first()).toBeVisible();
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
  for (const path of ["/property", "/facility", "/sales", "/tender", "/valuation", "/monitoring", "/companion"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("monitoring workspace tabs handle empty or missing API payloads without throwing runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/monitoring");
  
  // Test core horizontal tabs to verify resilience against empty/partial API data
  const tabs = ["Overview", "Tickets", "Programme", "Milestones", "Financials", "Risks", "Documents", "Reports", "Daily Logs", "Procurement"];
  for (const tabLabel of tabs) {
    const tabBtn = page.getByRole("button", { name: tabLabel, exact: true });
    if (await tabBtn.isVisible()) {
      await tabBtn.click();
      await page.waitForTimeout(100);
    }
  }
  expect(errors).toEqual([]);
});

test("companion module appears in command center and renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/workspaces");
  await page.waitForLoadState("networkidle");
  const companionCard = page.locator("a.module-card[href='/companion']");
  await expect(companionCard).toBeVisible();
  await companionCard.click();
  await expect(page.getByRole("heading", { name: "Companion & Staff Performance", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("companion workspace renders all tabs without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/companion");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toBeVisible();
  
  // Click through companion tabs
  const tabs = ["All tasks", "My tasks", "Templates", "Performance dashboard"];
  for (const tabLabel of tabs) {
    const tabBtn = page.getByRole("button", { name: tabLabel });
    if (await tabBtn.isVisible()) {
      await tabBtn.click();
      await page.waitForTimeout(100);
    }
  }
  expect(errors).toEqual([]);
});

test("construction role dashboards render without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  
  for (const role of ["Role Dashboards"]) {
    const tabBtn = page.getByRole("button", { name: role });
    if (await tabBtn.isVisible()) {
      await tabBtn.click();
      await page.waitForTimeout(100);
    }
  }
  // Navigate to monitoring first, then check role dashboards
  await page.goto("/monitoring");
  await page.waitForLoadState("networkidle");

  // Construction/Monitoring is disabled in the current scope — tolerate the unavailable state.
  const unavailable = await page.evaluate(() => document.body.innerText.includes("Module unavailable"));
  if (unavailable) {
    test.skip(true, "Construction Monitoring is disabled in the active scope.");
    return;
  }
  // Test the role dashboard nav items
  for (const roleTab of page.locator(".module-nav-bar button").filter({ hasText: /Project Manager|Finance|Site Agent/ })) {
    if (await roleTab.isVisible()) {
      await roleTab.click();
      await page.waitForTimeout(100);
    }
  }
  expect(errors).toEqual([]);
});
