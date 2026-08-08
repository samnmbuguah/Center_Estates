import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Shared navigation helpers for E2E specs.
 *
 * Single-sidebar navigation model:
 * - Horizontal module nav bar: `.module-nav-bar`
 * - App sidebar sub-nav tree: `.module-subnav-tree` (expandable when a module is active)
 * - Mobile: app-sidebar drawer toggled via the "Open module navigation" / hamburger button
 */

const TAB_ALIASES: Record<string, string> = {
  "Receipt allocations": "Allocations", "Credit notes": "Credit Notes",
  "Bank reconciliation": "Reconciliation", "Bank Reconciliation": "Reconciliation", "Charge allocations": "Allocations",
  "Rent & invoices": "Invoices", "Rent schedules": "Schedules",
  Budgets: "Budget & Estimate", Expenses: "Property Expenses",
  "Tenant documents": "Documents",
  "Work orders": "Maintenance", Contractors: "Vendors & Contracts",
  Buildings: "Buildings & Locations", Assets: "Assets & Inventory",
  Utilities: "Energy & Utilities",
};

const SIDEBAR_ALIASES: Record<string, string> = { "Service charge": "Service Charge" };

const PROPERTY_PARENTS: Record<string, string> = {
  "Property Register": "Properties", Buildings: "Properties",
  "Unit Occupancy": "Tenants & Occupancy", Occupancy: "Tenants & Occupancy",
  Tenants: "Tenants & Occupancy", Leases: "Tenants & Occupancy", "Tenant documents": "Tenants & Occupancy",
  Invoices: "Financials", "Rent & invoices": "Financials", "Rent Roll": "Financials", "Rent schedules": "Financials", Arrears: "Financials",
  Reminders: "Financials",
  Receipts: "Financials", Allocations: "Financials", "Receipt allocations": "Financials",
  "Bank Reconciliation": "Financials", "Bank reconciliation": "Financials",
  "Credit Notes": "Financials", "Credit notes": "Financials",
  "Charge Setup": "Service Charge", "Charge allocations": "Service Charge", Reconciliations: "Service Charge",
  "Budgets & Estimates": "Service Charge", Budgets: "Service Charge",
  "Property Expenses": "Income & Expenses", "Fee Invoicing": "Income & Expenses", Expenses: "Income & Expenses",
};

/** Open a module section by name, preferring horizontal tabs, then the sidebar sub-nav tree. */
export async function openModuleSection(page: Page, name: string, testInfo?: TestInfo) {
  const isMobile = Boolean(testInfo?.project.name.startsWith("mobile"));
  if (isMobile) {
    // Mobile: open the app-sidebar drawer (hamburger) then navigate via the sub-nav tree.
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
    const target = TAB_ALIASES[name] ?? name;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Accessible name is "<icon> Label" or just "Label"; anchor to exact label.
    const requestedTab = navBar.getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${escaped}$`, "i") });
    if (await requestedTab.count()) {
      await requestedTab.first().click();
      return;
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
      const parentSidebarLink = page.locator(".module-subnav-tree").getByText(parent, { exact: true });
      await expect(parentSidebarLink, `Navigation parent "${parent}" should be available`).toHaveCount(1);
      await parentSidebarLink.click();
    }
    if (parent === "Financials" && (name === "Rent & invoices" || name === "Arrears" || name === "Reminders")) {
      const invoicesButton = page.locator(".property-workspace").getByRole("tab", { name: "Invoices", exact: true }).first();
      await expect(invoicesButton).toBeVisible();
      await invoicesButton.click();
      if (name === "Rent & invoices") return;
    }
    const target = TAB_ALIASES[name] ?? name;
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
export async function openTab(page: Page, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.locator(".module-nav-bar").getByRole("button", { name: new RegExp(`^[^a-zA-Z0-9]*${escaped}$`, "i") }).first().click();
}

/** Sign in with a generous navigation timeout (slower under parallel load). */
export async function signInAs(page: Page, username: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}
