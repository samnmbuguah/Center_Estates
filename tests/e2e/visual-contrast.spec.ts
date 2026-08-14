import { expect, test } from "@playwright/test";

type ContrastResult = { foreground: string; background: string; ratio: number };

async function contrastFor(page: import("@playwright/test").Page, selector: string): Promise<ContrastResult> {
  return page.locator(selector).evaluate((element) => {
    const parse = (value: string) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return numbers.slice(0, 3);
    };
    const luminance = (rgb: number[]) => {
      const linear = rgb.map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const style = getComputedStyle(element);
    const foreground = style.color;
    const background = style.backgroundColor;
    const first = luminance(parse(foreground));
    const second = luminance(parse(background));
    return { foreground, background, ratio: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05) };
  });
}

test("shared blue badges and pills remain legible in light and dark themes", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.id = "contrast-fixture";
    fixture.innerHTML = '<span class="badge badge-blue">Verified</span><span class="pill pill-blue">Analysis</span>';
    document.body.appendChild(fixture);
  });

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(value => document.documentElement.setAttribute("data-theme", value), theme);
    for (const selector of ["#contrast-fixture .badge-blue", "#contrast-fixture .pill-blue"]) {
      const result = await contrastFor(page, selector);
      expect(result.ratio, `${theme} ${selector}: ${result.foreground} on ${result.background}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
