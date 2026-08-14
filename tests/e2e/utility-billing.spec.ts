import { expect, test } from "@playwright/test";
import { openModuleSection, signInAs } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await signInAs(page, process.env.E2E_ADMIN_USERNAME ?? "admin", password);
});

test("caretaker reading is unit-scoped, validated and manager-approved", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "The desktop register is the manager review surface");
  await page.goto("/facility");
  const propertySelector = page.getByLabel("Select property");
  const westlands = await propertySelector.locator("option", { hasText: "Westlands Business Centre" }).getAttribute("value");
  await propertySelector.selectOption(westlands ?? "");
  await openModuleSection(page, "Utilities", testInfo);

  const meterRow = page.getByRole("row").filter({ hasText: "Tower A Unit 101 Electricity Meter" });
  await expect(meterRow).toContainText("Unit 101");
  const previousText = (await meterRow.locator("td").nth(2).innerText()).replace(/,/g, "");
  const previousReadAt = await meterRow.locator("td").nth(6).innerText();
  const nextValue = Number(previousText) + 25;

  await meterRow.getByRole("button", { name: "Record Reading", exact: true }).click();
  const entry = page.getByRole("dialog", { name: /Record Reading/ });
  await expect(entry.getByLabel("Previous reading")).toHaveValue(previousText);
  await entry.getByLabel(/Current reading/).fill(String(nextValue));
  // datetime-local values are interpreted in EAT. Advancing the displayed
  // UTC reading by four hours produces an EAT value one hour later.
  const readAt = new Date(new Date(previousReadAt).getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
  await entry.getByLabel("Reading date and time").fill(readAt);
  await entry.getByLabel("Caretaker notes").fill("E2E unit meter capture");
  await entry.getByRole("button", { name: "Submit for Review", exact: true }).click();

  await expect(meterRow).toContainText("pending");
  await meterRow.getByRole("button", { name: "Approve", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Approve Meter Reading" });
  await review.getByLabel("Review notes").fill("Checked against the unit reading sheet");
  await review.getByRole("button", { name: "Approve Reading", exact: true }).click();
  await expect(meterRow).toContainText("approved");

  await meterRow.getByRole("button", { name: "Edit Rate", exact: true }).click();
  const rateDialog = page.getByRole("dialog", { name: /Edit Utility Rate/ });
  const rateInput = rateDialog.getByLabel("Rate per unit (KES)");
  const newRate = (Number(await rateInput.inputValue()) + 0.0001).toFixed(4);
  await rateInput.fill(newRate);
  await rateDialog.getByRole("button", { name: "Save Rate", exact: true }).click();
  await expect(meterRow).toContainText(Number(newRate).toLocaleString(undefined, { maximumFractionDigits: 4 }));
});

test("dedicated caretaker portal provides a property-scoped meter entry surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "The desktop register verifies the complete field-entry form");
  await page.goto("/caretaker-portal");
  await expect(page).toHaveURL(/\/caretaker-portal/);
  const propertySelector = page.getByLabel("Select property");
  const westlands = await propertySelector.locator("option", { hasText: "Westlands Business Centre" }).getAttribute("value");
  await propertySelector.selectOption(westlands ?? "");
  await openModuleSection(page, "Meter readings", testInfo);

  const meterRow = page.getByRole("row").filter({ hasText: "Tower A Unit 101 Electricity Meter" });
  await expect(meterRow).toContainText("Unit 101");
  await meterRow.getByRole("button", { name: "Record Reading", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Record Reading/ });
  await expect(dialog.getByLabel("Property / unit")).toHaveValue(/Unit 101/);
  await expect(dialog.getByLabel("Previous reading")).not.toHaveValue("");
  await expect(dialog.getByLabel(/Current reading/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
