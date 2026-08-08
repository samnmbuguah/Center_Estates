import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

test("facility boot coalesces dashboard reads and batches interaction telemetry", async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await signInAs(page, process.env.E2E_ADMIN_USERNAME ?? "admin", password);
  await page.waitForLoadState("networkidle");

  const requests = new Map<string, number>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/v1/")) return;
    const key = `${request.method()} ${url.pathname}`;
    requests.set(key, (requests.get(key) ?? 0) + 1);
  });

  await page.goto("/facility");
  await expect(page.getByRole("heading", { name: "Facility Management", exact: true })).toBeVisible();
  await expect(page.getByText("Loading facility operations…", { exact: true })).toBeHidden();
  await page.waitForTimeout(5_500);

  expect(requests.get("GET /api/v1/facility/dashboard/") ?? 0).toBeLessThanOrEqual(1);
  expect(requests.get("GET /api/v1/property/properties/") ?? 0).toBeLessThanOrEqual(1);
  expect(requests.get("GET /api/v1/companion/dashboard/") ?? 0).toBeLessThanOrEqual(1);
  expect(requests.get("POST /api/v1/companion/telemetry/") ?? 0).toBeLessThanOrEqual(1);
});
