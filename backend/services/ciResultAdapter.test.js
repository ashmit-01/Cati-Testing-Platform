import test from "node:test";
import assert from "node:assert/strict";

import { adaptCiReport } from "./ciResultAdapter.js";

function createAttempt({ title, line, status, retry = 0, failure = null }) {
  return {
    test: {
      title,
      file: "test-engine/api/specs/retry.spec.js",
      line,
    },
    result: {
      status,
      retry,
      duration: 100,
    },
    failure,
    evidence: {},
  };
}

test("counts only the final outcome of each test case", () => {
  const report = adaptCiReport({
    environment: "staging",
    results: [
      createAttempt({
        title: "Retry test",
        line: 10,
        status: "failed",
        retry: 0,
        failure: {
          message: "First attempt failed",
          stack: "",
        },
      }),

      createAttempt({
        title: "Retry test",
        line: 10,
        status: "passed",
        retry: 1,
      }),

      createAttempt({
        title: "Timeout test",
        line: 20,
        status: "timedOut",
        failure: {
          message: "Test timed out",
          stack: "",
        },
      }),

      createAttempt({
        title: "Skipped test",
        line: 30,
        status: "skipped",
      }),
    ],
  });

  assert.equal(report.results.length, 3);

  assert.deepEqual(report.summary, {
    total: 3,
    passed: 1,
    failed: 1,
    skipped: 1,
  });

  assert.deepEqual(
    report.results.map((item) => item.status),
    ["PASS", "FAIL", "SKIPPED"],
  );
});
