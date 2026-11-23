import { expect, test } from "@playwright/test";
import { APP_NAME } from "../src/lib/copy";

test("home page shows the app name", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: APP_NAME }),
  ).toBeVisible();
  await expect(page).toHaveTitle(APP_NAME);
});

test("home page has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits).toBe(true);
});
