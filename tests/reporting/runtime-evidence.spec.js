import { test, expect } from "@playwright/test";
import { attachRuntimeEvidence } from "../../reports/lib/runtimeEvidence.js";

test("reporting - runtime evidence", async ({ page }, testInfo) => {
  const evidence = attachRuntimeEvidence(page, testInfo);

  await page.goto("/");

  await evidence.save();

  expect(evidence.requests.length).toBeGreaterThan(0);
});
