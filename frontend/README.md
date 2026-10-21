# QA Dashboard

Owner: `feature/dashboard`

Planned screens:
- Dashboard
- Test Suites
- Test Runs
- Failures / Bugs
- Reports
- Settings

The dashboard triggers tests through the QA backend. It does not execute tests directly in the browser.

## Running

This folder is the canonical dashboard (there is no other frontend in the repo).

```bash
npm install
npm run dev      # http://localhost:5173
```

It calls the QA backend at `http://localhost:5001` unless `VITE_API_BASE_URL` is set.

## AI failure analysis

The Failure Details page has an **AI Failure Analysis** panel showing the probable cause, supporting evidence, suggested fix and confidence, with a Retry analysis button. It refreshes automatically while the analysis is `PENDING`. The analysis is based on text evidence only; screenshots and videos are not analysed.

