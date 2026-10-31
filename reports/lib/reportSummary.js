
function getTestId(test) {
  const file = (test.file || 'unknown-file')
    .replace(/\\/g, '/');

  // Convert absolute paths into paths relative to test-engine.
  const marker = '/test-engine/';
  const relativeFile = file.includes(marker)
    ? file.split(marker).pop()
    : file;

  return [
    relativeFile,
    test.line ?? 'unknown-line',
    test.title || 'unknown-test',
  ].join(':');
}

export function buildReportSummary(results = []) {
  const summary = {
    // Final outcomes: unique tests
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,

    // Retry and stability metrics
    totalAttempts: results.length,
    retriedTests: 0,
    flakyTests: 0,
    firstAttemptPassed: 0,

    // Individual attempt outcomes
    attemptResults: {
      passed: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
    },

    // Failure analytics
    failuresByClassification: {},
    failuresBySeverity: {},

    // Rates
    successRate: 0,
    firstAttemptPassRate: 0,
  };

  const groupedTests = new Map();

  // -----------------------------------------
  // STEP 1: Count attempts and group tests
  // -----------------------------------------

  for (const result of results) {
    const status = result.result?.status;

    if (
      Object.prototype.hasOwnProperty.call(
        summary.attemptResults,
        status
      )
    ) {
      summary.attemptResults[status]++;
    }

    const test = result.test || {};
    const testId = getTestId(test);

    if (!groupedTests.has(testId)) {
      groupedTests.set(testId, []);
    }

    groupedTests.get(testId).push(result);
  }

  // -----------------------------------------
  // STEP 2: Calculate unique test outcomes
  // -----------------------------------------

  for (const attempts of groupedTests.values()) {
    summary.total++;

    // Sort attempts by retry number.
    attempts.sort(
      (a, b) =>
        (a.result?.retry ?? 0) -
        (b.result?.retry ?? 0)
    );

    const firstAttempt = attempts[0];
    const finalAttempt = attempts[attempts.length - 1];

    const firstStatus = firstAttempt.result?.status;
    const finalStatus = finalAttempt.result?.status;

    // -----------------------------------------
    // Final test status
    // -----------------------------------------

    switch (finalStatus) {
      case 'passed':
        summary.passed++;
        break;

      case 'failed':
        summary.failed++;
        break;

      case 'skipped':
        summary.skipped++;
        break;

      case 'timedOut':
        summary.timedOut++;
        break;
    }

    // -----------------------------------------
    // First-attempt success
    // -----------------------------------------

    if (firstStatus === 'passed') {
      summary.firstAttemptPassed++;
    }

    // -----------------------------------------
    // Retry detection
    // -----------------------------------------

    const wasRetried = attempts.some(
      (attempt) =>
        (attempt.result?.retry ?? 0) > 0
    );

    if (wasRetried) {
      summary.retriedTests++;
    }

    // -----------------------------------------
    // Flaky test detection
    // Failed initially, passed eventually.
    // -----------------------------------------

    const hadFailure = attempts.some(
      (attempt) =>
        attempt.result?.status === 'failed' ||
        attempt.result?.status === 'timedOut'
    );

    if (hadFailure && finalStatus === 'passed') {
      summary.flakyTests++;
    }

    // -----------------------------------------
    // Failure classification and severity
    // Count only final unsuccessful outcomes.
    // -----------------------------------------

    if (
      finalStatus === 'failed' ||
      finalStatus === 'timedOut'
    ) {
      const failure = finalAttempt.failure;

      if (failure) {
        const classification =
          failure.classification || 'Unclassified';

        const severity =
          failure.severity || 'Unknown';

        summary.failuresByClassification[classification] =
          (summary.failuresByClassification[classification] || 0) + 1;

        summary.failuresBySeverity[severity] =
          (summary.failuresBySeverity[severity] || 0) + 1;
      }
    }
  }

  // -----------------------------------------
  // STEP 3: Calculate success rates
  // -----------------------------------------

  summary.successRate =
    summary.total > 0
      ? Number(
          ((summary.passed / summary.total) * 100).toFixed(2)
        )
      : 0;

  summary.firstAttemptPassRate =
    summary.total > 0
      ? Number(
          ((summary.firstAttemptPassed / summary.total) * 100).toFixed(2)
        )
      : 0;

  return summary;
}
