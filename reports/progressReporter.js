/**
 * Sends live Playwright progress to the CATI QA backend.
 *
 * The existing QA_INGEST_URL secret points to /api/test-runs/ci. The progress
 * endpoint is derived from that URL, so no additional repository secret is
 * required. When the workflow is started manually without PLATFORM_RUN_ID,
 * this reporter is not loaded by playwright.config.js.
 */
export default class ProgressReporter {
  constructor() {
    this.platformRunId = process.env.PLATFORM_RUN_ID || "";
    this.ingestUrl = process.env.QA_PROGRESS_INGEST_URL || "";
    this.token = process.env.CI_INGESTION_TOKEN || "";
    this.totalTests = 0;
    this.completed = new Map();
    this.attemptDurations = new Map();
    this.progressUrl = this.buildProgressUrl();
    this.progressPending = false;
    this.progressPromise = null;
    this.missingTokenWarned = false;
  }

  buildProgressUrl() {
    if (!this.platformRunId || !this.ingestUrl) {
      return null;
    }

    try {
      const url = new URL(this.ingestUrl);
      const ciEndpoint = /\/api\/test-runs\/ci\/?$/;

      if (!ciEndpoint.test(url.pathname)) {
        console.warn(
          "[CATI progress] QA_PROGRESS_INGEST_URL must point to /api/test-runs/ci; live progress is disabled.",
        );
        return null;
      }

      url.pathname = url.pathname.replace(
        ciEndpoint,
        `/api/test-runs/${encodeURIComponent(this.platformRunId)}/progress`,
      );
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch (error) {
      console.warn(
        "[CATI progress] Invalid QA progress ingestion URL:",
        error.message,
      );
      return null;
    }
  }

  getCounts() {
    const counts = {
      completedTests: this.completed.size,
      passed: 0,
      failed: 0,
      skipped: 0,
      completedDurationMs: 0,
    };

    for (const item of this.completed.values()) {
      counts[item.status.toLowerCase()] += 1;
      counts.completedDurationMs += item.duration;
    }

    return counts;
  }

  async sendProgress() {
    if (!this.progressUrl || !this.token) {
      return;
    }

    const counts = this.getCounts();
    const payload = {
      totalTests: this.totalTests,
      ...counts,
    };

    try {
      const response = await fetch(this.progressUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        // Do not let a slow telemetry endpoint stall the test suite.
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        console.warn(
          `[CATI progress] Backend returned ${response.status}. ${message}`,
        );
      }
    } catch (error) {
      // Progress telemetry must never cause the QA test process itself to fail.
      console.warn(
        "[CATI progress] Could not send progress update:",
        error.message,
      );
    }
  }

  scheduleProgress() {
    if (!this.progressUrl || !this.token) {
      if (this.platformRunId && !this.token && !this.missingTokenWarned) {
        this.missingTokenWarned = true;
        console.warn(
          "[CATI progress] CI_INGESTION_TOKEN is missing; live progress is disabled.",
        );
      }
      return;
    }

    // Coalesce updates while a request is in flight. This keeps the reporter
    // responsive without slowing tests or building a queue when the backend
    // is temporarily unavailable.
    this.progressPending = true;
    if (this.progressPromise) return;

    this.progressPromise = (async () => {
      try {
        while (this.progressPending) {
          this.progressPending = false;
          await this.sendProgress();
        }
      } finally {
        this.progressPromise = null;
        if (this.progressPending) this.scheduleProgress();
      }
    })();
  }

  async flushProgress() {
    while (this.progressPromise) {
      await this.progressPromise;
    }
  }

  onBegin(_config, suite) {
    this.totalTests = suite.allTests().length;
    this.scheduleProgress();
  }

  async onTestEnd(test, result) {
    const priorDuration = this.attemptDurations.get(test.id) || 0;
    const totalAttemptDuration = priorDuration + (Number(result.duration) || 0);
    this.attemptDurations.set(test.id, totalAttemptDuration);

    const retryableStatuses = new Set(["failed", "timedOut", "interrupted"]);
    const retryPending =
      retryableStatuses.has(result.status) && result.retry < test.retries;

    if (!retryPending) {
      let status = "failed";
      if (result.status === "passed") status = "passed";
      if (result.status === "skipped") status = "skipped";

      this.completed.set(test.id, {
        status,
        duration: totalAttemptDuration,
      });
    }

    this.scheduleProgress();
  }

  async onEnd() {
    this.scheduleProgress();
    await this.flushProgress();
  }
}
