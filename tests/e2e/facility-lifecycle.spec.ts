import { expect, test } from "@playwright/test";
import { openModuleSection, signInAs } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await signInAs(page, process.env.E2E_ADMIN_USERNAME ?? "admin", password);
});

test("approved service request becomes an evidenced and resolved work order", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "The full evidence register is verified on desktop");
  const reference = `SR-E2E-${Date.now()}`;
  const workOrderNumber = `SR-${reference}`;

  await page.goto("/facility");
  const propertySelector = page.getByLabel("Select property");
  const westlands = await propertySelector.locator("option", { hasText: "Westlands Business Centre" }).getAttribute("value");
  await propertySelector.selectOption(westlands ?? "");
  await openModuleSection(page, "Service Requests", testInfo);

  await page.getByRole("button", { name: "New Service Request", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "New Service Request" });
  await createDialog.getByLabel("Subject / Title").fill("E2E common-area lighting repair");
  await createDialog.getByLabel("Category").selectOption("Electrical");
  await createDialog.getByLabel("Priority").selectOption("high");
  await createDialog.getByLabel("Reference").fill(reference);
  await createDialog.getByLabel("Property").selectOption(westlands ?? "");
  await createDialog.getByLabel("Description").fill("Replace failed common-area fitting and record completion evidence.");
  await createDialog.getByRole("button", { name: "Create Request", exact: true }).click();

  const requestRow = page.getByRole("row").filter({ hasText: reference });
  await expect(requestRow).toContainText("new");
  await requestRow.getByRole("button", { name: "Approve", exact: true }).click();
  const approvalDialog = page.getByRole("dialog", { name: new RegExp(`Approve Service Request.*${reference}`) });
  await approvalDialog.getByLabel("Approval notes").fill("Resident manager approved common-area maintenance.");
  await approvalDialog.getByRole("button", { name: "Approve Request", exact: true }).click();
  await expect(requestRow).toContainText("approved");

  await requestRow.getByRole("button", { name: "Create WO", exact: true }).click();
  await expect(requestRow).toContainText("assigned");

  await openModuleSection(page, "Work orders", testInfo);
  const workOrderRow = page.getByRole("row").filter({ hasText: workOrderNumber });
  await expect(workOrderRow).toContainText("open");
  await workOrderRow.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(workOrderRow).toContainText("assigned");
  await workOrderRow.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(workOrderRow).toContainText("in progress");

  await workOrderRow.click();
  const detailTabs = page.getByRole("tablist", { name: "Work order details" });
  await detailTabs.getByRole("tab", { name: /Parts & Labor/ }).click();
  await page.getByRole("button", { name: "+ Add Cost Item", exact: true }).click();
  const costDialog = page.getByRole("dialog", { name: new RegExp(`Add Cost Item.*${workOrderNumber}`) });
  await costDialog.getByLabel("Cost type").selectOption("labor");
  await costDialog.getByLabel("Reference").fill("TS-E2E-001");
  await costDialog.getByLabel("Description").fill("Electrical technician labour");
  await costDialog.getByLabel("Quantity").fill("2");
  await costDialog.getByLabel("Unit cost (KES)").fill("1500");
  await costDialog.getByLabel("Supplier / technician").fill("Center Estates Maintenance Team");
  await costDialog.getByRole("button", { name: "Record Cost", exact: true }).click();
  const costRow = page.getByRole("row").filter({ hasText: "Electrical technician labour" });
  await expect(costRow).toContainText("3,000");

  await detailTabs.getByRole("tab", { name: /Media/ }).click();
  await page.getByRole("button", { name: "+ Attach Evidence", exact: true }).click();
  const mediaDialog = page.getByRole("dialog", { name: new RegExp(`Attach Work Evidence.*${workOrderNumber}`) });
  await mediaDialog.getByLabel("File URL").fill("https://centerestates.com/images/facility.jpg");
  await mediaDialog.getByLabel("File name").fill("lighting-repair-after.jpg");
  await mediaDialog.getByLabel("Media type").fill("image/jpeg");
  await mediaDialog.getByLabel("Caption").fill("Common-area fitting operational after repair");
  await mediaDialog.getByRole("button", { name: "Attach Evidence", exact: true }).click();
  await expect(page.getByText("lighting-repair-after.jpg", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "← Back to Work Orders", exact: true }).click();
  await workOrderRow.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(workOrderRow).toContainText("completed");

  await openModuleSection(page, "Service Requests", testInfo);
  await requestRow.getByRole("button", { name: "Resolve", exact: true }).click();
  const resolveDialog = page.getByRole("dialog", { name: "Resolve Service Request" });
  await resolveDialog.getByLabel("Satisfaction score").fill("5");
  await resolveDialog.getByRole("button", { name: "Resolve Request", exact: true }).click();
  await expect(requestRow).toContainText("resolved");
});
