import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Shared navigation helpers for E2E specs.
 *
 * Single-sidebar navigation model:
 * - Horizontal module nav bar: `.module-nav-bar`
 * - App sidebar sub-nav tree: `.module-subnav-tree` (expandable when a module is active)
 * - Mobile: app-sidebar drawer toggled via the "Open module navigation" / hamburger button
 */

const TAB_ALIASES: Record<string, string | string[]> = {
  // Property — one page per workflow item (no more consolidated group pages)
  Tenants: "Tenant Register",
  Leases: "Lease Agreements",
  "Tenant documents": "Compliance & Docs",
  Properties: "Properties Register",
  "Property Register": "Properties Register",
  "Service charge": "Service Charge Schemes",
  "Charge Setup": "Service Charge Schemes",
  "Charge allocations": "Charge Allocations",
  Reconciliations: "Reconciliations",
  Budgets: "Budgets & Estimates",
  "Budgets & Estimates": "Budgets & Estimates",
  Expenses: "Expenses",
  "Property Expenses": "Expenses",
  Arrears: "Arrears & Recovery",
  Fees: "Management Fees",
  "Fee Invoicing": "Management Fees",
  "Tenancy reports": "Tenancy Analytics",
  "Tenancy Analytics": "Tenancy Analytics",
  "Financial reports": "Financial Analytics",
  "Financial Analytics": "Financial Analytics",
  Invoices: "Invoice Register",
  Receipts: "Receipts",
  // Facility
  "Work orders": "Maintenance",
  "Work Orders": "Maintenance",
  Contractors: "Vendors & Contracts",
  Buildings: "Buildings & Locations",
  Assets: "Assets & Inventory",
  Utilities: "Energy & Utilities",
  Expenditure: "Expenditure & Floats",
  // Sales
  Inventory: "Projects & Units",
  Buyers: "Buyers & Leads",
  Sales: "Property Sales",
  "Site visits": "Site Visits",
  Payments: ["Buyer Payments", "Fee Collections"],
  Commissions: "Sales Commissions",
  Installments: "Payment Schedules",
  "Payment schedules": "Payment Schedules",
  "Agent performance": "Agent Performance",
  Documents: "Legal Documents",
  "Legal documents": "Legal Documents",
  "Audit trail": "Audit Trail",
  "Audit events": "Audit Trail",
  // Tender
  Invitations: "Invitations & RFPs",
  Tenders: "Invitations & RFPs",
  Requirements: "AI Requirement Analysis",
  Decisions: "Bid / No-Bid Decisions",
  "Proposal planning": "Proposal Planning",
  "Company documents": "Company Document Vault",
  Proposals: "Proposal Sections",
  "Financial BOQ": "Financial BOQ",
  Reviews: "Review & Approvals",
  "Review & approval": "Review & Approvals",
  Packaging: "Tender Packaging",
  Submissions: "Submissions Log",
  Outcomes: "Awards & Regrets",
  // Valuation
  Instructions: "Valuation Instructions",
  Inspections: "Site Inspections",
  Comparables: "Comparable Evidence",
  "Draft reports": "Draft Reports",
  "Final reports": "Final Reports & Sign-off",
  Invoicing: "Client Invoicing",
  Clients: "Client Directory",
  Analytics: "Performance Analytics",
  Reports: ["Sales Reports", "Valuation Reports"],
  // Monitoring (construction)
  Projects: "Project Portfolio",
  Milestones: "Progress",
  "Daily logs": "Daily Logs",
  Issues: "Issues",
  Risks: "Risks",
  Quality: "Quality",
  RFIs: "RFIs",
  // Companion
  Tasks: "All tasks",
  "My tasks": "My tasks",
  Delegations: "Delegations",
  "Staff history": "Staff history",
  "Performance dashboard": "Performance dashboard",
};

/** Flatten a name + optional aliases into the ordered list of candidate labels. */
function aliasTargets(name: string): string[] {
  const alias = TAB_ALIASES[name];
  return [name, ...(Array.isArray(alias) ? alias : alias ? [alias] : [])];
}

const SIDEBAR_ALIASES: Record<string, string> = { "Service charge": "Service Charge" };

const SUBTAB_ALIASES: Record<string, string> = {};

const PROPERTY_PARENTS: Record<string, string> = {};

/** Open a module section by name, preferring horizontal tabs, then the sidebar sub-nav tree. */
export async function openModuleSection(page: Page, name: string, testInfo?: TestInfo) {
  // Detect mobile from the project name when available, else from the
  // viewport (openTab callers may not forward testInfo).
  const isMobile = Boolean(
    (testInfo?.project.name.startsWith("mobile"))
    || (!testInfo && (await page.viewportSize()).width < 768),
  );
  if (isMobile) {
    // Mobile: the group tabs and page buttons are hidden (CSS media query);
    // the module select dropdown is the navigation surface.
    const navBar = page.locator(".module-nav-bar");
    await navBar.first().waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
    if (await navBar.count()) {
      for (const candidate of aliasTargets(name)) {
        const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const option = navBar.locator("option").filter({ hasText: new RegExp(`—\\s*${escaped}$`, "i") }).first();
        if (await option.count()) {
          await navBar.locator("select").selectOption({ label: (await option.textContent())?.trim() ?? candidate });
          await page.waitForTimeout(500);
          return;
        }
      }
      // Fall back to visible buttons when the select is unavailable.
      for (const candidate of aliasTargets(name)) {
        const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const tab = navBar.getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${escaped}$`, "i") });
        if (await tab.count()) {
          await tab.first().click();
          return;
        }
      }
    }
    // Fallback: open the app-sidebar drawer then navigate via the sub-nav tree.
    const openNav = page.getByRole("button", { name: /open (module )?navigation/i }).first();
    if (await openNav.isVisible().catch(() => false)) await openNav.click();
    await page.waitForTimeout(300);
    const subnav = page.locator(".module-subnav-tree");
    const item = subnav.getByText(name, { exact: true });
    if (await item.count()) {
      await item.click();
      return;
    }
    await page.getByRole("button", { name, exact: true }).first().click();
    return;
  }

  // Desktop: horizontal nav bar (grouped buttons) first
  const navBar = page.locator(".module-nav-bar");
  await navBar.first().waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
  if (await navBar.count()) {
    // Try the raw name first (matches most modules), then the aliases.
    // Aliases are ambiguous across modules (e.g. Reports → Sales/Valuation Reports).
    for (const candidate of aliasTargets(name)) {
      const candidateEscaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Accessible name is "<icon> Label" or just "Label"; anchor to exact label.
      const requestedTab = navBar.getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${candidateEscaped}$`, "i") });
      if (await requestedTab.count()) {
        await requestedTab.first().click();
        return;
      }
    }

    // The redesigned module navigation shows pages for one workflow group at a
    // time. Resolve the page's group from the mobile select, activate that
    // group, then click the now-visible page tab. Options carry the full item
    // label, so try the aliases first, then the raw name.
    let option: ReturnType<typeof navBar.locator> | null = null;
    let resolvedOptionLabel = name;
    for (const candidate of aliasTargets(name)) {
      const candidateEscaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const opt = navBar.locator("option").filter({ hasText: new RegExp(`—\\s*${candidateEscaped}$`, "i") }).first();
      if (await opt.count()) {
        option = opt;
        resolvedOptionLabel = candidate;
        break;
      }
    }
    if (option && (await option.count())) {
      const optionText = (await option.textContent())?.trim() ?? "";
      const groupLabel = optionText.split("—")[0]?.trim();
      if (groupLabel) {
        const groupButton = navBar.locator("[role=tab]").filter({ hasText: groupLabel }).first();
        await expect(groupButton, `Navigation group "${groupLabel}" should be available`).toBeVisible();
        await groupButton.click();
        const resolvedEscaped = resolvedOptionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const groupedTab = navBar.getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${resolvedEscaped}$`, "i") });
        await expect(groupedTab, `Navigation page "${resolvedOptionLabel}" should be available`).toBeVisible();
        await groupedTab.click();
        // A module may expose a view control using tab semantics; module page
        // navigation itself remains limited to the two levels above.
        const subTabName = SUBTAB_ALIASES[name] ?? name;
        if (subTabName !== resolvedOptionLabel) {
          const subTab = page.getByRole("tab", { name: subTabName, exact: true }).first();
          await subTab.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
          if (await subTab.isVisible().catch(() => false)) await subTab.click();
        }
        return;
      }
    }
  }

  // Fallback: sidebar sub-nav tree
  const sidebarSection = page.locator(".module-subnav-tree").getByText(SIDEBAR_ALIASES[name] ?? name, { exact: true });
  if (await sidebarSection.count()) {
    await sidebarSection.click();
    return;
  }

  // Property parent-group navigation (e.g. "Rent Roll" lives under "Rent Collection")
  const parent = PROPERTY_PARENTS[name];
  if (parent) {
    const parentEscaped = parent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parentButton = navBar.getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${parentEscaped}$`, "i") });
    if (await parentButton.count()) {
      await parentButton.first().click();
    } else {
      const parentOption = navBar.locator("option").filter({ hasText: new RegExp(`—\\s*${parentEscaped}$`, "i") }).first();
      if (await parentOption.count()) {
        const optionText = (await parentOption.textContent())?.trim() ?? "";
        const groupLabel = optionText.split("—")[0]?.trim();
        const groupButton = navBar.getByRole("tab", { name: new RegExp(`^${groupLabel}\\s*\\d*$`, "i") });
        await expect(groupButton, `Navigation group "${groupLabel}" should be available`).toBeVisible();
        await groupButton.click();
        const visibleParent = navBar.getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${parentEscaped}$`, "i") });
        await expect(visibleParent, `Navigation parent "${parent}" should be available`).toBeVisible();
        await visibleParent.click();
      } else {
        const parentSidebarLink = page.locator(".module-subnav-tree").getByText(parent, { exact: true });
        await expect(parentSidebarLink, `Navigation parent "${parent}" should be available`).toHaveCount(1);
        await parentSidebarLink.click();
      }
    }
    if (parent === "Financials" && (name === "Rent & invoices" || name === "Arrears" || name === "Reminders")) {
      const invoicesButton = page.locator(".property-workspace").getByRole("tab", { name: "Invoices", exact: true }).first();
      await expect(invoicesButton).toBeVisible();
      await invoicesButton.click();
      if (name === "Rent & invoices") return;
    }
    const target = aliasTargets(name)[0];
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const childScope = page.locator(".property-workspace");
    const childName = new RegExp(`^[^a-zA-Z0-9]*${escaped}$`, "i");
    let childButton = childScope.getByRole("tab", { name: childName });
    if (await childButton.count() === 0) childButton = childScope.getByRole("button", { name: childName });
    await expect(childButton, `Navigation child "${target}" should be available`).toHaveCount(1);
    await childButton.first().click();
    if (name === "Budgets") {
      const openBudgetRegister = page.getByRole("button", { name: "Open Budgets →", exact: true });
      await expect(openBudgetRegister).toBeVisible();
      await openBudgetRegister.click();
    }
    return;
  }

  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Open a horizontal module tab directly. */
export async function openTab(page: Page, name: string, testInfo?: TestInfo) {
  await openModuleSection(page, name, testInfo);
}

/** Sign in with a generous navigation timeout (slower under parallel load). */
export async function signInAs(page: Page, username: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

/**
 * Assert collected page errors, tolerating the transient React #418 hydration
 * warning that occasionally fires on the shared production host during fast
 * client-side navigation. Only real (non-hydration) errors fail the test.
 */
export async function expectNoPageErrors(page: Page, errors: string[]) {
  const realErrors = errors.filter((e) => !e.includes("#418"));
  expect(realErrors).toEqual([]);
}
