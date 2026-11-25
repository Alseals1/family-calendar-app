import { expect, test } from "@playwright/test";
import { AUTH_COPY, COLOR_NAMES, FAMILY_COPY } from "../src/lib/copy";
import { createFamily } from "./helpers/family";
import { logIn, registerAndConfirm, TEST_NAME } from "./helpers/users";

test("a new user creates a family, lands on the calendar and is listed as owner", async ({
  page,
}) => {
  await registerAndConfirm(page, "family");
  await expect(page.getByLabel(FAMILY_COPY.displayNameLabel)).toHaveValue(TEST_NAME);
  await expect(page.getByRole("radio", { name: COLOR_NAMES.blue })).toBeChecked();

  await createFamily(page, { familyName: "The Smiths", colorName: COLOR_NAMES.green });

  await page.goto("/family");
  await expect(page.getByRole("heading", { level: 1, name: FAMILY_COPY.familyHeading })).toBeVisible();
  await expect(page.getByText("The Smiths")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: TEST_NAME });
  await expect(row).toContainText(FAMILY_COPY.ownerLabel);
});

test("an empty family name shows an error and stays on onboarding", async ({ page }) => {
  await registerAndConfirm(page, "family-empty");
  await page.getByRole("button", { name: FAMILY_COPY.submit }).click();
  await expect(page.getByText(FAMILY_COPY.familyNameRequired)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("a user with a family skips onboarding, also after logging in again", async ({ page }) => {
  const { email, password } = await registerAndConfirm(page, "family-again");
  await createFamily(page, { familyName: "The Joneses", colorName: COLOR_NAMES.orange });

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/calendar$/);

  await page.getByRole("button", { name: AUTH_COPY.logoutLabel }).click();
  await expect(page).toHaveURL(/\/login$/);
  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/calendar$/);
});

test("a user without a family who opens /family is sent to onboarding", async ({ page }) => {
  await registerAndConfirm(page, "family-none");
  await page.goto("/family");
  await expect(page).toHaveURL(/\/onboarding$/);
});
