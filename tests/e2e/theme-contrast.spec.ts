import { expect, test } from "@playwright/test";

function luminance(rgb: string) {
  const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("login preserves readable semantic surfaces in light and dark themes", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("ce-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const card = page.locator(".login-auth-card");
  const heading = card.getByRole("heading", { name: "Welcome back" });
  const darkColors = await card.evaluate((element) => {
    const headingElement = element.querySelector("h1");
    return {
      card: getComputedStyle(element).backgroundColor,
      heading: headingElement ? getComputedStyle(headingElement).color : "",
    };
  });

  expect(darkColors.card).not.toBe("rgb(255, 255, 255)");
  expect(contrast(darkColors.heading, darkColors.card)).toBeGreaterThanOrEqual(4.5);
  await expect(heading).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login-dark.png"), fullPage: true });

  await page.evaluate(() => localStorage.setItem("ce-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const lightColors = await card.evaluate((element) => {
    const headingElement = element.querySelector("h1");
    return {
      card: getComputedStyle(element).backgroundColor,
      heading: headingElement ? getComputedStyle(headingElement).color : "",
    };
  });
  expect(contrast(lightColors.heading, lightColors.card)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("login-light.png"), fullPage: true });
});
