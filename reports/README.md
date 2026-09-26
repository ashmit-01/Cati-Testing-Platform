# Reports

Owner: `feature/reporting`

This directory contains the reporting and evidence-processing layer of the CATI QA Testing Platform.

## Reporting Flow

Playwright executes the automated tests and produces:

- Test status: passed, failed, skipped, timed out
- Failure information
- Error stack
- Screenshot
- Video
- Trace
- Error context
- Console logs
- Request metadata
- Response metadata

The custom JSON reporter stores the Playwright results in:

```text
reports/playwright-results.json
```

The QA normalizer converts these results into the platform's normalized format and generates:

```text
reports/generated/qa-report.json
```

## QA Report

The normalized QA report contains:

- Test information
- Test result and duration
- Environment
- URL
- Failure message and stack
- Expected result
- Actual result
- Failure classification
- Severity
- Failure location
- Collected evidence

## Failure Classification

Failures are classified as:

- API
- UI
- E2E
- WebSocket
- AI
- Infrastructure
- Test Script
- Environment
- Unknown

A failed automated test is not automatically considered a CATI defect.

## Severity

The reporting layer supports:

- **CRITICAL** — core application, login, or voice system unavailable
- **HIGH** — major functionality such as agent creation, call initiation, or major API functionality unavailable
- **MEDIUM** — partial feature failure where a workaround may exist
- **LOW** — minor UI, text, or validation issue

## Evidence

Failure evidence is retained by Playwright and normalized into the QA report.
Supported evidence includes:

- Screenshot
- Video
- Trace
- Error context
- Console logs
- API request metadata
- API response metadata

Generated evidence is stored under:

```text
test-results/
```

and should not be committed to Git.

## Playwright HTML Report

Playwright also generates its detailed HTML report at:

```text
playwright-report/
```

The report can be opened with:

```bash
npm run test:report
```

## Generate QA Report

Run the complete reporting flow with:

```bash
npm run test:qa-report
```

This:

- Runs the Playwright test suite.
- Generates the Playwright HTML report.
- Collects failure evidence.
- Generates `reports/playwright-results.json`.
- Normalizes the results.
- Generates `reports/generated/qa-report.json`.

## CI

The GitHub Actions QA workflow runs the same reporting flow and uploads:

- Playwright HTML report
- Normalized QA report
- Failure evidence

Generated reports and evidence are intentionally excluded from Git.