import { expect, type Page } from "@playwright/test";
import { AUTH_COPY } from "../../src/lib/copy";
import { confirmPathFor } from "./mailpit";

// Made-up test data only.
export const TEST_PASSWORD = "correct-horse-battery";
export const TEST_NAME = "Pat Example";

export function uniqueEmail(tag: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${tag}-${Date.now()}-${random}@example.test`;
}

export async function fillRegister(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel(AUTH_COPY.fullNameLabel).fill(TEST_NAME);
  await page.getByLabel(AUTH_COPY.emailLabel).fill(email);
  await page.getByLabel(AUTH_COPY.passwordLabel).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: AUTH_COPY.registerSubmit }).click();
  await expect(page.getByRole("heading", { name: AUTH_COPY.checkEmailTitle })).toBeVisible();
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(AUTH_COPY.emailLabel).fill(email);
  await page.getByLabel(AUTH_COPY.passwordLabel).fill(password);
  await page.getByRole("button", { name: AUTH_COPY.loginSubmit }).click();
}

/** Registers a fresh user, opens the emailed link, and ends signed in on /onboarding. */
export async function registerAndConfirm(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await fillRegister(page, email);
  await page.goto(await confirmPathFor(email));
  await expect(page).toHaveURL(/\/onboarding$/);
  return { email, password: TEST_PASSWORD };
}
