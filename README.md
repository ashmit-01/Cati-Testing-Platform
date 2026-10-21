# CATI QA Test Platform

An independent automated QA platform for testing the deployed CATI AI system.

## Purpose

This repository is intentionally separate from the CATI application repositories.

Architecture:

QA Dashboard → QA Backend → Test Runner → CATI

The QA platform owns:
- Test execution
- Test results
- Failure evidence
- Bug/severity records
- Reports

CATI remains the System Under Test (SUT).

## Planned Test Types

- API
- UI
- End-to-End (E2E)
- WebSocket
- AI/Voice scenarios

## Repository Structure

```text
cati-test-platform/
├── frontend/             # QA dashboard
├── backend/              # QA backend/API
├── test-engine/          # Automated test suites
│   ├── api/
│   ├── ui/
│   ├── e2e/
│   ├── websocket/
│   └── ai/
├── reports/              # Generated reports
├── artifacts/            # Test artifacts, if supported by the current implementation
├── config/               # Environment/test configuration
├── tests/                # Base/smoke tests
├── .env.example
├── .gitignore
├── package.json
└── playwright.config.js
```

## Git Workflow

- `main` = stable/demo-ready branch
- `develop` = integration branch
- `feature/*` = individual team branches

Never push directly to `main`.
Use Pull Requests into `develop`.
After integration and validation, promote `develop` to `main`.

## Team Branches

```text
feature/dashboard
feature/qa-backend
feature/api-tests
feature/ui-e2e
feature/ai-websocket
feature/reporting
```

## Environment

Copy `.env.example` to `.env` and provide authorized test environment credentials.

Never commit `.env`, passwords, tokens, or API keys.

## Running the dashboard

`frontend/` is the only dashboard source (the older duplicate at the repo root was removed).

```bash
# terminal 1 - QA backend on port 5001 (needs backend/.env, see backend/.env.example)
cd backend && npm install
npm run create-admin     # once: creates the dashboard login from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev

# terminal 2 - dashboard on http://localhost:5173
cd frontend && npm install && npm run dev
```

The dashboard talks to `http://localhost:5001` by default; override with `VITE_API_BASE_URL` in `frontend/.env`. `npm run dev` at the repo root also starts `frontend/`.

## Quick Start

```bash
npm install
npx playwright install
npx playwright test
```

View the report:

```bash
npx playwright show-report
```

## AI Failure Analysis

When a test fails, the platform sends that failure's **text evidence** to an LLM and shows a **probable cause** and **suggested fix** on the Failure Details page.

**What is analysed (text evidence only):** test name, module (UI / API / E2E / WebSocket / AI-Voice), expected and actual result, error message, stack trace (when the runner provides one), endpoint/page, and any request/response, console, network or WebSocket log text. Obvious secrets (bearer tokens, JWTs, passwords, API keys) are redacted before anything is sent.

**Not supported yet:** screenshot, video and trace analysis. Playwright can capture these, but capture is currently turned `off` in `playwright.config.js`, and they are never sent to the LLM. This is listed as possible future work.

**How it works**

1. A test result is saved as `FAIL` and a `Failure` record is created (existing flow, unchanged).
2. The failure is queued for analysis in the background (`backend/services/aiFailureAnalysisService.js`). Only failures are analysed; passed tests never reach the LLM.
3. The analysis is stored on that failure as `aiAnalysis` (`status`: `PENDING` / `COMPLETED` / `ERROR`, `probableCause`, `supportingEvidence`, `suggestedFix`, `confidence`, `additionalInfoNeeded`).
4. The Failure Details page shows a loading state, the analysis, or the error, with a **Retry analysis** button.

**Safety rules**

- The test status is saved independently of the LLM. If the LLM is down, times out, is not configured, or returns something unusable, the failure stays saved and only `aiAnalysis.status` becomes `ERROR`.
- The LLM only *suggests*. It never edits code or changes a test or failure status.
- A failure is analysed once automatically; another LLM call happens only when a user clicks **Retry analysis** (`POST /api/failures/:id/analyze`).
- If the evidence is thin, the model is instructed to say so and list what is missing instead of guessing. The UI labels the output as a recommendation, not a confirmed root cause.

**Setup** — add to `backend/.env` (see `.env.example`):

```env
LLM_PROVIDER=anthropic        # or: openai (any OpenAI-compatible API)
LLM_API_KEY=your-key-here
# optional: LLM_MODEL, LLM_BASE_URL, LLM_TIMEOUT_MS, AI_ANALYSIS_ENABLED=false
```

Run the backend tests with `cd backend && npm install && npm test`.

## Safety

Only run authorized tests against CATI environments. Destructive operations, real calls, paid operations, and production data changes should use approved test resources or a dedicated QA/staging environment.

### API Testing Safety Classifications
All tests within the `test-engine/api` module are categorized by their side effects to ensure safe execution:

- **READ-ONLY**: Operations that fetch data without modifying state (e.g., `GET /api/agents`). Always safe.
- **TEST-DATA MUTATION**: Operations that modify data scoped strictly to the test user or mock data (e.g., `POST /api/agents`). Safe, but leaves isolated test data behind.
- **EXTERNAL SIDE EFFECT**: Operations that trigger third-party services (e.g., Twilio calls, Stripe charges). These are typically protected by environment flags (`ALLOW_REAL_CALLS`, `ALLOW_LIVE_PAYMENTS`) and are fail-closed.
- **STAGING/SANDBOX ONLY**: Operations safe to run only in isolated, non-production environments.
- **INTENTIONALLY SKIPPED**: Tests written for documentation/coverage but disabled in standard CI runs due to cost, destructiveness, or lack of mock capabilities.
- **MOCK REQUIRED**: Tests that rely on specific mocking behavior in the backend or an interception layer to pass safely.
