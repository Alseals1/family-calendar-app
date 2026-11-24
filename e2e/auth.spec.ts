import { expect, test } from "@playwright/test";
import { AUTH_COPY } from "../src/lib/copy";
import { confirmPathFor } from "./helpers/mailpit";
import {
  fillRegister,
  logIn,
  registerAndConfirm,
  TEST_PASSWORD,
  uniqueEmail,
} from "./helpers/users";

test("register, confirm through the email, and land on onboarding", async ({ page }) => {
  const email = uniqueEmail("register");
  await fillRegister(page, email);
  await expect(page.getByText(email)).toBeVisible();
  await page.goto(await confirmPathFor(email));
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", { level: 1, name: AUTH_COPY.onboardingHeading }),
  ).toBeVisible();
});

test("log out sends the user to /login and protects /calendar", async ({ page }) => {
  await registerAndConfirm(page, "logout");
  await page.getByRole("button", { name: AUTH_COPY.logoutLabel }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login$/);
});

test("log in lands on onboarding for a user without a family", async ({ page }) => {
  const { email, password } = await registerAndConfirm(page, "login");
  await page.getByRole("button", { name: AUTH_COPY.logoutLabel }).click();
  await expect(page).toHaveURL(/\/login$/);
  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("a wrong password shows an error and stays on /login", async ({ page }) => {
  const { email } = await registerAndConfirm(page, "wrongpw");
  await page.getByRole("button", { name: AUTH_COPY.logoutLabel }).click();
  await logIn(page, email, "not-the-password");
  await expect(page.getByRole("alert")).toHaveText(AUTH_COPY.invalidCredentials);
  await expect(page).toHaveURL(/\/login$/);
});

test("an unconfirmed account cannot log in", async ({ page }) => {
  const email = uniqueEmail("unconfirmed");
  await fillRegister(page, email);
  await logIn(page, email, TEST_PASSWORD);
  await expect(page.getByRole("alert")).toHaveText(AUTH_COPY.emailNotConfirmed);
  await expect(page).toHaveURL(/\/login$/);
});

test("a bad confirmation link shows an error on /login", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bad&type=email");
  await expect(page).toHaveURL(/\/login\?error=confirm$/);
  await expect(page.getByRole("alert")).toHaveText(AUTH_COPY.confirmInvalid);
});

test("a signed-in visit to /login is sent on to onboarding", async ({ page }) => {
  await registerAndConfirm(page, "guest");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/onboarding$/);
});
