export function buildReportSummary(results = []) {
  const summary = {
    total: results.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,

    failuresByClassification: {},
    failuresBySeverity: {},
  };

  for (const result of results) {
    const status = result.result.status;

    if (status === "passed") {
      summary.passed++;
    }

    if (status === "failed") {
      summary.failed++;
    }

    if (status === "skipped") {
      summary.skipped++;
    }

    if (status === "timedOut") {
      summary.timedOut++;
    }

    if (result.failure) {
      const classification = result.failure.classification;
      const severity = result.failure.severity;

      summary.failuresByClassification[classification] =
        (summary.failuresByClassification[classification] || 0) + 1;

      summary.failuresBySeverity[severity] =
        (summary.failuresBySeverity[severity] || 0) + 1;
    }
  }

  return summary;
}
