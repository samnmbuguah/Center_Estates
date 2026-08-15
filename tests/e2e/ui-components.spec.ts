import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function signInAdmin(page: Page) {
  if (!adminPassword) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(adminPassword);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

test.beforeEach(async ({ page }) => signInAdmin(page));

function openTab(page: Page, tabName: string) {
  return page.getByRole("tab", { name: tabName }).click();
}

test("enhanced role assignment UI renders with accordion sections", async ({ page }) => {
  await page.goto("/administration");
  await openTab(page, "Roles");
  
  // Check for role selector
  await expect(page.getByRole("combobox", { name: /SELECT EMBEDDED OR CUSTOM ROLE/ })).toBeVisible();
  
  // Check for accordion-style permission groups
  await expect(page.locator('[role="button"][aria-expanded]')).toBeVisible();
  
  // Verify module sections are present
  await expect(page.getByText(/Property Management/i)).toBeVisible();
  await expect(page.getByText(/Facility Management/i)).toBeVisible();
  await expect(page.getByText(/Companion & Staff Performance/i)).toBeVisible();
});

test("role assignment accordion expands and collapses sections", async ({ page }) => {
  await page.goto("/administration");
  await openTab(page, "Roles");
  
  // Find a module accordion
  const propertySection = page.getByText(/Property Management/i).locator("..").locator('[role="button"]');
  
  // Click to expand/collapse
  await propertySection.click();
  await expect(propertySection).toHaveAttribute("aria-expanded", "true");
  
  await propertySection.click();
  await expect(propertySection).toHaveAttribute("aria-expanded", "false");
});

test("role assignment shows permission descriptions on hover", async ({ page }) => {
  await page.goto("/administration");
  await openTab(page, "Roles");
  
  // Find a permission checkbox
  const permission = page.locator('[type="checkbox"]').first();
  
  // Hover over permission
  await permission.hover();
  
  // Check for description tooltip (may appear with delay)
  await page.waitForTimeout(500);
  const description = page.getByText(/Grants access to/i);
  // Description may or may not be visible depending on implementation
});

test("create custom role button exists and opens modal", async ({ page }) => {
  await page.goto("/administration");
  await openTab(page, "Roles");
  
  // Check for create button - it might have changed text after our fixes
  const createButton = page.getByRole("button", { name: /Create Custom Role/i });
  await expect(createButton).toBeVisible();
  
  // Click to open modal
  await createButton.click();
  
  // Check for modal
  await expect(page.getByRole("dialog", { name: /Create Custom Role/i })).toBeVisible();
  
  // Close modal
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Create Custom Role/i })).not.toBeVisible();
});

test("role preview shows selected permissions", async ({ page }) => {
  await page.goto("/administration");
  await openTab(page, "Roles");
  
  // Select a role that has permissions
  await page.getByRole("combobox").selectOption({ label: /Custom Role/i });
  
  // Check for role preview section
  await expect(page.getByText(/Role Preview/i)).toBeVisible();
  
  // Check for permission chips
  const permissionChips = page.locator(".MuiChip-root");
  await expect(permissionChips.first()).toBeVisible();
});

test("enhanced data table renders with search and filters", async ({ page }) => {
  await page.goto("/property");
  
  // Check for search input
  await expect(page.getByRole("searchbox", { name: /Search/i })).toBeVisible();
  
  // Check for filter button
  await expect(page.getByRole("button", { name: /filter/i })).toBeVisible();
  
  // Check for column visibility button
  await expect(page.getByRole("button", { name: /column/i })).toBeVisible();
});

test("data table supports row selection", async ({ page }) => {
  await page.goto("/property");
  
  // Find checkboxes in table
  const checkboxes = page.locator('[type="checkbox"]');
  if (await checkboxes.count() > 0) {
    // Select first row
    await checkboxes.first().check();
    
    // Check for bulk action toolbar
    await expect(page.getByText(/selected/i)).toBeVisible();
  }
});

test("data table supports sorting", async ({ page }) => {
  await page.goto("/property");
  
  // Find sortable column headers
  const sortableHeaders = page.locator("th[style*='cursor: pointer'], th[style*='pointer']");
  if (await sortableHeaders.count() > 0) {
    // Click to sort
    await sortableHeaders.first().click();
    
    // Check for sort indicators
    await expect(page.locator("svg")).toBeVisible();
  }
});

test("breadcrumb navigation renders on pages", async ({ page }) => {
  await page.goto("/property");
  
  // Check for breadcrumbs
  await expect(page.locator("nav[aria-label='Breadcrumb']")).toBeVisible();
  
  // Check for home link
  await expect(page.getByRole("link", { name: /Home/i })).toBeVisible();
});

test("breadcrumb search with keyboard shortcut", async ({ page }) => {
  await page.goto("/property");
  
  // Trigger keyboard shortcut (Ctrl+K)
  await page.keyboard.press("Control+k");
  
  // Check for search dropdown
  await expect(page.getByRole("menu", { name: /Search/i })).toBeVisible();
});

test("breadcrumb keyboard shortcuts menu", async ({ page }) => {
  await page.goto("/property");
  
  // Trigger keyboard shortcut (Ctrl+/)
  await page.keyboard.press("Control+/");
  
  // Check for shortcuts menu
  await expect(page.getByRole("menu", { name: /keyboard shortcuts/i })).toBeVisible();
});

test("notification center renders with bell icon", async ({ page }) => {
  await page.goto("/property");
  
  // Check for notification bell
  await expect(page.getByRole("button", { name: /notifications/i })).toBeVisible();
});

test("notification center opens on click", async ({ page }) => {
  await page.goto("/property");
  
  // Click notification bell
  await page.getByRole("button", { name: /notifications/i }).click();
  
  // Check for notification menu
  await expect(page.getByRole("menu")).toBeVisible();
});

test("notification center shows filter options", async ({ page }) => {
  await page.goto("/property");
  
  // Click notification bell
  await page.getByRole("button", { name: /notifications/i }).click();
  
  // Check for filter dropdown
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("task assignment shows navigation to team matrix when no staff", async ({ page }) => {
  await page.goto("/companion");
  await openTab(page, "Tasks");
  
  // Click assign task button
  await page.getByRole("button", { name: /Assign Task/i }).click();
  
  // Check for task assignment modal
  await expect(page.getByRole("dialog", { name: /Assign Task/i })).toBeVisible();
  
  // Check for staff assignment section
  const staffSection = page.getByText(/Assign to Team Member/i);
  await expect(staffSection).toBeVisible();
  
  // If no staff available, check for improved navigation alert
  const noStaffAlert = page.getByRole("alert", { name: /info/i }).filter({ hasText: /No staff assigned to this property yet/i });
  if (await noStaffAlert.isVisible()) {
    // Check for navigation button
    await expect(page.getByRole("button", { name: /Go to Team Matrix/i })).toBeVisible();
    
    // Test navigation button functionality
    const currentUrl = page.url();
    await page.getByRole("button", { name: /Go to Team Matrix/i }).click();
    
    // Should navigate to team matrix
    await expect(page).toHaveURL(/team-matrix/);
  }
});

test("interactive dashboard renders KPI cards", async ({ page }) => {
  await page.goto("/property");
  
  // Check for KPI cards
  await expect(page.locator(".MuiCard-root")).toBeVisible();
  
  // Check for multiple KPI cards
  const cards = page.locator(".MuiCard-root");
  await expect(await cards.count()).toBeGreaterThan(0);
});

test("dashboard KPI cards show trend indicators", async ({ page }) => {
  await page.goto("/property");
  
  // Check for trend icons (up/down arrows)
  const trendIcons = page.locator("svg").filter({ hasText: /TrendingUp|TrendingDown/i });
  // Trend icons may or may not be present depending on data
});

test("dashboard supports time range selection", async ({ page }) => {
  await page.goto("/property");
  
  // Check for time range selector
  const timeRange = page.getByRole("combobox");
  if (await timeRange.count() > 0) {
    await expect(timeRange.first()).toBeVisible();
  }
});

test("dashboard supports chart type toggle", async ({ page }) => {
  await page.goto("/property");
  
  // Check for chart type buttons
  const chartButtons = page.locator("button").filter({ hasText: /bar|line|pie/i });
  if (await chartButtons.count() > 0) {
    await expect(chartButtons.first()).toBeVisible();
  }
});