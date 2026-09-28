import { test, expect } from "../fixtures/evidence.js";

test.use({ storageState: undefined });

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/login", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const emailInput = page.getByRole("textbox", {
    name: "you@example.com",
  });

  await expect(emailInput).toBeVisible({
    timeout: 30_000,
  });

  await expect(emailInput).toBeEditable({
    timeout: 30_000,
  });
});

test("Login rejects invalid credentials", async ({ page }) => {
  const emailInput = page.getByRole("textbox", {
    name: "you@example.com",
  });

  const passwordInput = page.getByRole("textbox", {
    name: "Enter password",
  });

  await emailInput.fill("invalid@mail.com");

  await expect(passwordInput).toBeEditable({
    timeout: 30_000,
  });

  await passwordInput.fill("Wrong");

  await page.getByRole("button", {
    name: "Sign in",
  }).click();

  await expect(page.getByText(/invalid credential/i)).toBeVisible({
    timeout: 30_000,
  });
});

test("User can login successfully", async ({ page }) => {
  // Do not expose the actual password in logs.
  expect(EMAIL, "TEST_EMAIL must be configured").toBeTruthy();
  expect(PASSWORD, "TEST_PASSWORD must be configured").toBeTruthy();

  const emailInput = page.getByRole("textbox", {
    name: "you@example.com",
  });

  const passwordInput = page.getByRole("textbox", {
    name: "Enter password",
  });

  await emailInput.fill(EMAIL.trim());

  await expect(passwordInput).toBeEditable({
    timeout: 30_000,
  });

  await passwordInput.fill(PASSWORD);

  await page.getByRole("button", {
    name: "Sign in",
  }).click();

  await expect(page).toHaveURL(/\/dashboard/, {
    timeout: 30_000,
  });
});