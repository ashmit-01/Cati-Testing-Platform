import fs from "node:fs";

export default class JsonReporter {
  constructor() {
    this.results = [];
  }

  onTestEnd(test, result) {
    this.results.push({
      title: test.title,
      file: test.location.file,
      line: test.location.line,
      column: test.location.column,
      tests: [
        {
          results: [
            {
              status: result.status,
              duration: result.duration,
              retry: result.retry,
              startTime: result.startTime,
              error: result.error,
              errorLocation: result.errorLocation,
              attachments: result.attachments,
            },
          ],
        },
      ],
    });
  }

  onEnd() {
    fs.writeFileSync(
      "./reports/playwright-results.json",
      JSON.stringify(
        {
          suites: [
            {
              specs: this.results,
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );
  }
}
