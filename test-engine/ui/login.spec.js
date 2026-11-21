import { test, expect } from "../fixtures/evidence.js";

test.use({ storageState: undefined });

test("Login rejects invalid credentials", async ({ page }) => {
  await page.goto("/auth/login", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page
    .getByRole("textbox", { name: "you@example.com" })
    .fill("invalid@example.test");
  await page.getByRole("textbox", { name: "Enter password" }).fill("Incorrect-Password-42!");

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/invalid (?:login )?credentials|(?:invalid|incorrect) email or password/i)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/auth\/login(?:[?#]|$)/);
});

test("User can login successfully", async ({ page }) => {
  await page.goto("/auth/login", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page
    .getByRole("textbox", { name: "you@example.com" })
    .fill(process.env.TEST_EMAIL);
  await page
    .getByRole("textbox", { name: "Enter password" })
    .fill(process.env.TEST_PASSWORD);

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/, {
    timeout: 30_000,
  });
});
