import { expect, test, type Page } from "@playwright/test";
import { AUTH_COPY } from "../src/lib/copy";
import { recoveryPathFor } from "./helpers/mailpit";
import { logIn, registerAndConfirm, uniqueEmail } from "./helpers/users";

// Made-up test data only.
const NEW_PASSWORD = "a-brand-new-passphrase";

// Next.js adds its own empty role="alert" route announcer, so match by text.
async function expectAlert(page: Page, text: string) {
  await expect(page.getByRole("alert").filter({ hasText: text })).toHaveText(text);
}

async function requestReset(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("link", { name: AUTH_COPY.forgotPasswordLink }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel(AUTH_COPY.emailLabel).fill(email);
  await page.getByRole("button", { name: AUTH_COPY.forgotPasswordSubmit }).click();
  await expect(page.getByRole("heading", { name: AUTH_COPY.checkEmailTitle })).toBeVisible();
}

test("reset the password through the email and log in with the new one", async ({ page }) => {
  const { email, password } = await registerAndConfirm(page, "reset");
  await page.getByRole("button", { name: AUTH_COPY.logoutLabel }).click();
  await expect(page).toHaveURL(/\/login$/);

  await requestReset(page, email);
  await expect(page.getByRole("status")).toContainText(email);

  await page.goto(await recoveryPathFor(email));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel(AUTH_COPY.newPasswordLabel).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: AUTH_COPY.resetPasswordSubmit }).click();
  await expect(page).toHaveURL(/\/login\?reset=done$/);
  await expect(page.getByRole("status").filter({ hasText: AUTH_COPY.passwordResetDone })).toBeVisible();

  await logIn(page, email, password);
  await expectAlert(page, AUTH_COPY.invalidCredentials);

  await logIn(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("an unknown email gets the same confirmation", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel(AUTH_COPY.emailLabel).fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: AUTH_COPY.forgotPasswordSubmit }).click();
  await expect(page.getByRole("heading", { name: AUTH_COPY.checkEmailTitle })).toBeVisible();
});

test("a bad reset link sends the user to /forgot-password with an error", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bad&type=recovery");
  await expect(page).toHaveURL(/\/forgot-password\?error=link$/);
  await expectAlert(page, AUTH_COPY.resetLinkInvalid);
});

test("the reset page needs a session", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login$/);
});
