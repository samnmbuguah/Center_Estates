import { type Page, type TestInfo } from "@playwright/test";

/**
 * Shared navigation helpers for E2E specs.
 *
 * Single-sidebar navigation model:
 * - Horizontal module tabs: `.module-tabs-workspace`
 * - App sidebar sub-nav tree: `.module-subnav-tree` (expandable when a module is active)
 * - Mobile: app-sidebar drawer toggled via the "Open module navigation" / hamburger button
 */

const TAB_ALIASES: Record<string, string> = {
  "Receipt allocations": "Allocations", "Credit notes": "Credit Notes",
  "Bank reconciliation": "Bank Reconciliation", "Charge allocations": "Allocations",
  "Rent & invoices": "Invoices", "Rent schedules": "Rent Roll",
  Budgets: "Budgets & Estimates", Expenses: "Property Expenses",
};

const SIDEBAR_ALIASES: Record<string, string> = { "Service charge": "Service Charge" };

const PROPERTY_PARENTS: Record<string, string> = {
  "Property Register": "Properties", Buildings: "Properties",
  "Unit Occupancy": "Occupancy", "Property Projects": "Occupancy",
  "Tenant documents": "Tenants",
  Invoices: "Rent Collection", "Rent & invoices": "Rent Collection", "Rent Roll": "Rent Collection", "Rent schedules": "Rent Collection", Arrears: "Rent Collection",
  Reminders: "Rent Collection", Receipts: "Rent Collection", Allocations: "Rent Collection",
  "Receipt allocations": "Rent Collection", "Bank Reconciliation": "Rent Collection",
  "Bank reconciliation": "Rent Collection", "Credit Notes": "Rent Collection", "Credit notes": "Rent Collection",
  "Charge Setup": "Service Charge", "Charge allocations": "Service Charge", Reconciliations: "Service Charge",
  "Budgets & Estimates": "Income & Expenses", "Property Expenses": "Income & Expenses", "Fee Invoicing": "Income & Expenses",
  Budgets: "Income & Expenses", Expenses: "Income & Expenses",
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

  // Desktop: horizontal tabs first
  const tabs = page.locator(".module-tabs-workspace");
  if (await tabs.count()) {
    const requestedTab = tabs.getByRole("button", { name: TAB_ALIASES[name] ?? name, exact: true });
    if (await requestedTab.count()) {
      await requestedTab.click();
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
    await page.locator(".module-subnav-tree").getByText(parent, { exact: true }).click();
    await page.locator(".module-tabs-workspace").getByRole("button", { name: TAB_ALIASES[name] ?? name, exact: true }).click();
    return;
  }

  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Open a horizontal module tab directly. */
export async function openTab(page: Page, name: string) {
  await page.locator(".module-tabs-workspace").getByRole("button", { name, exact: true }).click();
}
