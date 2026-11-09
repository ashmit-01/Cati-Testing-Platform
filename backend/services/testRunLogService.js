export const TEST_LOG_RETENTION_DAYS = 30;

const RETENTION_MS = TEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function getTestLogExpiresAt(run) {
  const retentionAnchor = run?.completedAt || run?.startedAt || run?.createdAt;

  if (!retentionAnchor) {
    return null;
  }

  const anchorDate = new Date(retentionAnchor);
  if (Number.isNaN(anchorDate.getTime())) {
    return null;
  }

  return new Date(anchorDate.getTime() + RETENTION_MS);
}

export function isTestLogAvailable(run, now = new Date()) {
  if (!run || String(run.status).toUpperCase() === "RUNNING") {
    return false;
  }

  const expiresAt = getTestLogExpiresAt(run);
  return Boolean(expiresAt && now.getTime() < expiresAt.getTime());
}

function stringify(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(durationMs) {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value < 0) {
    return "N/A";
  }

  return `${(value / 1000).toFixed(2)}s`;
}

/** Build a human-readable, downloadable execution log from persisted run data. */
export function buildTestRunLog({ run, results = [], failures = [] }) {
  const lines = [
    "CATI QA TEST EXECUTION LOG",
    "=".repeat(72),
    `Run ID: ${run.runId}`,
    `Environment: ${run.environment || "N/A"}`,
    `Status: ${run.status || "N/A"}`,
    `Execution Mode: ${run.executionMode || "N/A"}`,
    `Workflow: ${run.ci?.workflow || "N/A"}`,
    `Branch: ${run.ci?.branch || "N/A"}`,
    `Commit: ${run.ci?.commit || "N/A"}`,
    `GitHub Actions Run: ${run.ci?.runUrl || "N/A"}`,
    `Started: ${run.startedAt ? new Date(run.startedAt).toISOString() : "N/A"}`,
    `Completed: ${run.completedAt ? new Date(run.completedAt).toISOString() : "N/A"}`,
    `Duration: ${formatDuration(run.duration)}`,
    "",
    "SUMMARY",
    "-".repeat(72),
    `Total tests: ${Number(run.totalTests) || 0}`,
    `Passed: ${Number(run.passed) || 0}`,
    `Failed: ${Number(run.failed) || 0}`,
    `Skipped: ${Number(run.skipped) || 0}`,
    `Progress: ${Number(run.progressPercent) || 0}%`,
    "",
    "TEST CASE RESULTS",
    "-".repeat(72),
  ];

  if (results.length === 0) {
    lines.push("No individual test case results were stored for this run.");
  }

  results.forEach((result, index) => {
    lines.push(
      `${index + 1}. [${result.status || "UNKNOWN"}] ${result.testName || "Unnamed test"}`,
    );
    lines.push(`   Suite: ${result.suite || "N/A"}`);
    lines.push(`   Duration: ${formatDuration(result.duration)}`);

    if (result.error) {
      lines.push(`   Error: ${result.error}`);
    }
    if (result.expected !== null && result.expected !== undefined) {
      lines.push(`   Expected: ${stringify(result.expected)}`);
    }
    if (result.actual !== null && result.actual !== undefined) {
      lines.push(`   Actual: ${stringify(result.actual)}`);
    }
    if (result.endpoint) {
      lines.push(`   Endpoint: ${result.endpoint}`);
    }
    if (result.page) {
      lines.push(`   File/Page: ${result.page}`);
    }
    if (result.stackTrace) {
      lines.push("   Stack trace:");
      lines.push(
        String(result.stackTrace)
          .split("\n")
          .map((line) => `     ${line}`)
          .join("\n"),
      );
    }

    lines.push("");
  });

  if (failures.length > 0) {
    lines.push("FAILURE RECORDS");
    lines.push("-".repeat(72));

    failures.forEach((failure, index) => {
      lines.push(`${index + 1}. ${failure.title || "Test failure"}`);
      lines.push(`   Severity: ${failure.severity || "N/A"}`);
      lines.push(`   Category: ${failure.category || "N/A"}`);
      lines.push(`   Status: ${failure.status || "N/A"}`);
      lines.push(`   Description: ${failure.description || "N/A"}`);
      lines.push("");
    });
  }

  if (run.error) {
    lines.push("RUN ERROR");
    lines.push("-".repeat(72));
    lines.push(run.error);
    lines.push("");
  }

  lines.push("=".repeat(72));
  lines.push("End of CATI QA test execution log.");

  return `${lines.join("\n")}\n`;
}
