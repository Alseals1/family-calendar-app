import { expect, type Page } from "@playwright/test";
import { FAMILY_COPY } from "../../src/lib/copy";

/** On /onboarding, creates a family and waits for /calendar. Keeps the prefilled name. */
export async function createFamily(
  page: Page,
  { familyName, colorName }: { familyName: string; colorName: string },
) {
  await page.getByLabel(FAMILY_COPY.familyNameLabel).fill(familyName);
  await page.getByRole("radio", { name: colorName }).check({ force: true });
  await page.getByRole("button", { name: FAMILY_COPY.submit }).click();
  await expect(page).toHaveURL(/\/calendar$/);
}
