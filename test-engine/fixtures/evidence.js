import { test as base } from "@playwright/test";
import { attachRuntimeEvidence } from "../../reports/lib/runtimeEvidence.js";

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const evidence = attachRuntimeEvidence(page, testInfo);

    await use(page);

    await evidence.save();
  },
});

export { expect } from "@playwright/test";
