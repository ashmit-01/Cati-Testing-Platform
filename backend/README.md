# QA Backend

Owner: `feature/qa-backend`

Node.js / Express / MongoDB backend for the CATI QA Test Platform.

Responsibilities:
- Test-run orchestration (`POST /api/test-runs`)
- Test suite APIs (`/api/test-runs`, `/api/results`, `/api/failures`)
- Result processing and normalization
- Failure/bug detection, classification, and severity scoring
- Report APIs (`/api/reports`)
- QA database integration (MongoDB via Mongoose)

Target flow:

Dashboard → QA Backend → Test Runner (Playwright) → CATI

See the root [README.md](../README.md) for full setup instructions, API
documentation, environment variables, and the severity/evidence model.

## Structure

```text
backend/
├── config/db.js              # Mongoose connection
├── models/                   # TestCase, TestSuite, TestRun, TestResult, Failure schemas
├── controllers/               # Thin request handlers
├── routes/                    # Route -> controller wiring
├── services/                  # Business logic (runner, results, failures, severity, reports, result checker)
├── middleware/                 # Error handling + request validation
├── utils/                      # Logger, async handler, runId generator
├── app.js                      # Express app factory
└── server.js                   # Entry point (loads env, connects DB, starts listener)
```

`services/resultCheckerService.js` is the shared expected-vs-actual
comparator used when a run is driven by stored `TestCase` documents
(`suiteId`/`testCaseIds` on `POST /api/test-runs`) rather than the legacy
Playwright-suite-folder path.
