import "dotenv/config";
import fs from "fs";
import path from "path";

import { buildReportSummary } from "./lib/reportSummary.js";
import { normalizeTestResult } from "./lib/resultNormalizer.js";

// Locate the most current Playwright JSON output
const candidatePaths = [
  process.env.PLAYWRIGHT_JSON_OUTPUT_FILE,
  "./playwright-results.json",
  "./reports/playwright-results.json",
].filter(Boolean);

let jsonPath = candidatePaths.find((p) => fs.existsSync(p));

if (!jsonPath) {
  console.error("No Playwright results JSON found in candidate locations:", candidatePaths);
  process.exit(1);
}

console.log("Reading Playwright results from:", jsonPath);
const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

const normalizedResults = [];

function walkSuite(node) {
  if (!node) return;

  if (node.specs) {
    for (const spec of node.specs) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          normalizedResults.push(normalizeTestResult(spec, result));
        }
      }
    }
  }

  for (const child of node.suites || []) {
    walkSuite(child);
  }
}

for (const rootSuite of json.suites || []) {
  walkSuite(rootSuite);
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
