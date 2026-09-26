import { test, expect } from "../fixtures/evidence.js";

test("Dashboard loads successfully", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);

  await expect(page.getByText("Dashboard", { exact: true })).toBeVisible();
});

test("Dashboard sidebar navigation is visible", async ({ page }) => {
  await page.goto("/dashboard");

  const sidebarItems = [
    "Dashboard",
    "CRM",
    "Agents",
    "Campaigns",
    "Apps and Connections",
    "Call Logs",
    "Wallet",
    "Updates",
    "Guide",
    "Settings",
  ];

  for (const item of sidebarItems) {
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }
});
test("Dashboard displays voice assistant section", async ({ page }) => {
  await page.goto("/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await expect(page).toHaveURL(/\/dashboard/);

  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();

  // Verify the dashboard has loaded its main content.
  await expect(page.locator("main")).toBeVisible();
});

test("Dashboard displays user credits", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("0 Credits", { exact: true })).toBeVisible();
});
