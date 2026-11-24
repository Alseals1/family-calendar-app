import { expect, test } from "@playwright/test";
import { APP_NAME } from "../src/lib/copy";

test("a signed-out visit to the home page goes to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle(APP_NAME);
});

for (const path of ["/login", "/register"]) {
  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  });
}
