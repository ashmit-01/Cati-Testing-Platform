# QA Test Engine Guide — CATI Testing Platform

## Overview

This guide documents the architecture, test suites, error capture pipeline, and reporting workflows implemented for the CATI Testing Platform test engine.

---

## 1. Architecture & Execution Flow

```
TEST START
  │
  ▼
Playwright Project Selection (api | ai | websocket | chromium)
  │
  ▼
Fixtures Initialization
  ├─ testUser (Authentication token acquisition & graceful skip handling)
  ├─ testAgent (Dynamic agent lifecycle: create -> run -> guaranteed teardown)
  └─ apiClient / wsClient (Instrumented clients with latency tracking)
  │
  ▼
Target Under Test Execution
  ├─ CATI Backend REST API (/api/ai-engine/providers, /query, /conversation)
  ├─ Direct External AI Engine (https://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io)
  └─ CATI WebSocket Server (/realtime, /ws/vobiz)
  │
  ▼
Response / Error / Frames Received
  │
  ▼
AI Engine Error & Runtime Evidence Capture (aiErrorCapture.js)
  ├─ Sanitization (tokens, passwords, API keys redacted)
  ├─ Deterministic Source Attribution (AI Engine vs CATI Backend vs Network)
  ├─ Distinction: Expected Error Response (test passes) vs Unexpected Failure (test fails)
  └─ Playwright testInfo.attach("AI Engine Error Evidence")
  │
  ▼
Playwright Test Results (playwright-results.json)
  │
  ▼
Result Normalizer & Failure Classifier (reports/testNormalizer.js)
  │
  ▼
Standardized QA Evidence Report (reports/generated/qa-report.json)
```

---

## 2. What Was Wrong in the Original Implementation

1. **Stale & Hardcoded Test Data**:
   - AI tests depended on a pre-existing `TEST_AGENT_ID`. If absent or pointing to an expired agent, tests either failed cryptically or were silently skipped without explanation.
   - Tests made assumptions about static server states and shared state across test boundaries.

2. **WebSocket Protocol Inconsistencies**:
   - WebSocket tests attempted to connect to generic `/` or mock endpoints rather than the actual CATI backend contract (`/realtime`, `/ws/vobiz` with `token` and `agentId` query parameters).
   - Frame structures used non-existent event schemas rather than real CATI frames (`connected`, `transcript`, `response`, `audio`, `error`).

3. **Missing Live AI Engine Error Capture**:
   - The original architecture had no mechanism to capture live HTTP status codes, error bodies, request latency, or WebSocket disconnect codes/error frames when communicating with the AI Engine.
   - There was a false assumption in early designs that AI Engine errors could be queried via a `/logs` endpoint; however, the AI Engine logs exclusively to stdout/stderr and immediate HTTP/WS failure responses.

4. **Reporting Pipeline Mismatch**:
   - `api.fixture.js` attached evidence as `"API Call Evidence"`, while `reports/lib/resultNormalizer.js` expected attachments named `"requests"` and `"responses"`. As a result, captured evidence was dropped during normalization.
   - `reports/testNormalizer.js` was looking for results at `./reports/playwright-results.json`, whereas Playwright output was saved to `./playwright-results.json`.

5. **Failure Classification Masking**:
   - `failureClassifier.js` matched `expect(`, which matches any Playwright assertion error. Consequently, almost all failures were generically classified as `Assertion`, obscuring AI Engine, Authentication, Network, or WebSocket root causes.

6. **Test Runner Service Subdirectory Blindness**:
   - `backend/services/testRunnerService.js` only checked the top-level directory when looking for spec files (missing `test-engine/api/specs/`), and defaulted to `--project=chromium` for every test suite, breaking API and WebSocket execution.

---

## 3. What Was Changed

1. **Created `test-engine/shared/aiErrorCapture.js`**:
   - Implements robust HTTP and WebSocket evidence capture.
   - Sanitizes sensitive credentials, tokens, and authorization headers (`[REDACTED]`).
   - Distinguishes expected error responses (e.g. 404 for missing agent, 400 for invalid query) from unexpected system failures.
   - Deterministically attributes errors to `AI Engine`, `CATI Backend`, or `Network`.

2. **Created `test-engine/fixtures/agent.fixture.js`**:
   - Reusable `testAgent` fixture that dynamically creates a test agent before tests, passes the agent ID to the test, and guarantees cleanup (`DELETE /api/agents/:id`) in a `finally` block even on failure.

3. **Aligned WebSocket Testing in `test-engine/websocket/`**:
   - `ws.config.js`: Defined true CATI WebSocket frame types (`connected`, `transcript`, `response`, `audio`, `error`) and endpoint paths (`/realtime`, `/ws/vobiz`).
   - `wsClient.helper.js`: Tracks full message history, error frames, connection status, and close codes via `WsSession`.
   - `ai-engine.spec.js`: Complete 7-scenario suite covering authentication, missing agent, transcript/response exchange, malformed frames, and disconnects.

4. **Upgraded AI Engine Specs & Helper**:
   - `aiEngine.helper.js`: Added latency measurement, multipart voice clone/preview support, and direct external AI host helpers (`checkDirectEngineHealth`, `getDirectEngineVoices`).
   - `ai-engine.spec.js`: Full matrix covering 401 unauthenticated access, schema validation, 404 nonexistent agents, 400 validation, live external host checks, and valid agent conversation flows.
   - `ai-engine-error-capture.spec.js`: Direct live validation tests verifying 405 Method Not Allowed capture, 404 Not Found capture, sensitive data redaction, and WebSocket handshake rejection against the live external AI Engine.

5. **Fixed Reporting & Normalization Pipeline**:
   - `resultNormalizer.js`: Normalized `"AI Engine Error Evidence"`, `"API Call Evidence"`, and `"WebSocket Evidence"` into `evidence.aiEngineError`, `evidence.apiCall`, `evidence.webSocket`.
   - `failureClassifier.js`: Prioritized specific classifications (`AI Engine`, `WebSocket`, `Authentication`, `Authorization`, `Validation`, `Network`, `API`) over generic `Assertion`.
   - `testNormalizer.js`: Reads `./playwright-results.json` directly, recursively parses test suites, and generates `reports/generated/qa-report.json`.

6. **Fixed Backend Test Runner**:
   - `testRunnerService.js`: Added recursive spec file discovery and automatic project routing (`api` -> `--project=api`, `websocket` -> `--project=websocket`, `ai` -> `--project=ai`, UI -> `--project=chromium`).

---

## 4. How AI Engine Errors Are Captured

### HTTP Error Capture
When an HTTP request is made to the CATI backend or directly to the external AI Engine:
1. The request URL, method, payload, and start timestamp are recorded.
2. The response status, headers, and body are retrieved.
3. If the status is >= 400:
   - Request and response data are sanitized using regex-based redaction.
   - Error source is attributed based on server headers and response shape (`gunicorn`/`uvicorn` -> AI Engine; `express` -> CATI Backend; `ECONNREFUSED` -> Network).
   - Expected status is evaluated: If the test expected 404, `expected: true` is flagged.
   - Structured JSON is attached to Playwright's test results under `"AI Engine Error Evidence"`.

### WebSocket Error Capture
When connecting to `/realtime` or `/ws/vobiz`:
1. Connection lifecycle events (`open`, `message`, `error`, `close`) are tracked.
2. If an error occurs during handshake or runtime:
   - Endpoint URL is sanitized (stripping JWT query parameters).
   - Handshake status or error message is captured.
   - Last received server error frame and recent message history are recorded.
   - Clean close code and reason (or failure code) are captured.
   - Evidence is attached to Playwright's test results under `"AI Engine Error Evidence"`.

---

## 5. Expected Negative Tests vs Unexpected Failures

| Scenario | HTTP / WS Status | Expected Flag | Test Assertion | Test Result | Evidence Recorded? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Invalid Agent Query | 404 Not Found | `expected: true` | `expect(status).toBe(404)` | **PASS** | Yes (`aiEngineError`) |
| Missing Required Field | 400 Bad Request | `expected: true` | `expect(status).toBe(400)` | **PASS** | Yes (`aiEngineError`) |
| Unauthenticated Token | 401 Unauthorized | `expected: true` | `expect(status).toBe(401)` | **PASS** | Yes (`aiEngineError`) |
| Engine Outage / Crash | 500 / 502 / 503 | `expected: false` | `expect(status).toBe(200)` | **FAIL** | Yes (`aiEngineError`) |
| WS Bad Auth Handshake | Connection Rejected | `expected: true` | Handshake rejected | **PASS** | Yes (`aiEngineError`) |

---

## 6. Environment Variables

| Variable | Required / Optional | Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `BACKEND_URL` | Optional | `http://localhost:5000` | URL of the CATI backend under test |
| `AI_ENGINE_URL` | Optional | `https://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io` | URL of the external AI Engine host |
| `AI_ENGINE_WS_URL`| Optional | `ws://localhost:5000` | WebSocket base URL for realtime audio/agent tests |
| `TEST_EMAIL` | Optional | `test@example.com` | Test user email for authentication |
| `TEST_PASSWORD` | Optional | `TestPassword123!` | Test user password for authentication |
| `TEST_AGENT_ID` | Optional | *(dynamically created)* | Pre-existing agent ID (if not using dynamic fixture) |
| `ALLOW_REAL_CALLS`| Safety Guard | `false` | When false, real telephony calls are skipped |
| `ALLOW_LIVE_PAYMENTS`| Safety Guard| `false` | When false, real payment orders are skipped |

---

## 7. How to Run the Tests

```bash
# 1. Verify test discovery across all projects
npx playwright test --list

# 2. Run AI Engine Error Capture validation suite (hits live external engine)
npx playwright test test-engine/api/specs/ai-engine-error-capture.spec.js --project=api

# 3. Run AI Engine API suite
npx playwright test test-engine/api/specs/ai-engine.spec.js --project=api

# 4. Run WebSocket test suite
npx playwright test --project=websocket

# 5. Run AI Behavioral test suite
npx playwright test --project=ai

# 6. Generate the normalized QA report
node reports/testNormalizer.js
```

---

## 8. What is Explicitly Out of Scope

- No LLM reasoning or diagnosis engines connected to Playwright failures.
- No modifications to the original CATI backend repository or external AI Engine code.
- No invented REST endpoints (e.g. `/logs`, `/errors`).
- No MongoDB storage created for AI Engine logs.
- No real phone calls or financial charges initiated during automated test runs.
