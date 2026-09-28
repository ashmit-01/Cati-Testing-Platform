import { test as setup, expect } from "@playwright/test";
import path from "path";

setup.setTimeout(90_000);

const authFile = path.join(
  process.cwd(),
  "playwright",
  ".auth",
  "user.json"
);

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  expect(email, "TEST_EMAIL must be configured").toBeTruthy();
  expect(password, "TEST_PASSWORD must be configured").toBeTruthy();

  await page.goto("/auth/login", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const emailInput = page.getByRole("textbox", {
    name: "you@example.com",
  });

  const passwordInput = page.getByRole("textbox", {
    name: "Enter password",
  });

  await expect(emailInput).toBeVisible({
    timeout: 30_000,
  });

  await expect(emailInput).toBeEditable({
    timeout: 30_000,
  });

  await emailInput.fill(email.trim());

  await expect(passwordInput).toBeVisible({
    timeout: 30_000,
  });

  await expect(passwordInput).toBeEditable({
    timeout: 30_000,
  });

  await passwordInput.fill(password);

  await page.getByRole("button", {
    name: "Sign in",
  }).click();

  await expect(page).toHaveURL(/\/dashboard/, {
    timeout: 30_000,
  });

  await page.context().storageState({
    path: authFile,
  });
});