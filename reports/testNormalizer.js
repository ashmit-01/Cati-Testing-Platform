import "dotenv/config";
import fs from "fs";
import path from "path";

import { buildReportSummary } from "./lib/reportSummary.js";
import { normalizeTestResult } from "./lib/resultNormalizer.js";

const json = JSON.parse(
  fs.readFileSync("./reports/playwright-results.json", "utf-8"),
);

const normalizedResults = [];

for (const suite of json.suites || []) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      for (const result of test.results || []) {
        normalizedResults.push(normalizeTestResult(spec, result));
      }
    }
  }
}

console.log("Normalized results:", normalizedResults.length);

const summary = buildReportSummary(normalizedResults);
const report = {
  generatedAt: new Date().toISOString(),
  environment: process.env.TEST_ENV || "unknown",
  url: process.env.FRONTEND_URL || null,
  summary,
  results: normalizedResults,
};

const outputDir = "./reports/generated";

fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "qa-report.json"),
  JSON.stringify(report, null, 2),
  "utf-8",
);

console.log("QA report generated: reports/generated/qa-report.json");
console.log("Report summary:");
console.log(summary);
