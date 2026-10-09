# CATI Test Engine

The CATI Test Engine contains automated test suites for the CATI platform, covering REST APIs, AI Behavioral flows, and WebSocket realtime protocols.

## Directory Structure

```
test-engine/
├── ai/                      # AI behavioral specs (context, greeting, guardrails, intent, language, rag)
├── api/                     # REST API test specs, fixtures, helpers, and data schemas
│   ├── fixtures/            # api.fixture.js (authenticated client & error capture)
│   ├── helpers/             # Endpoint helpers (aiEngine.helper.js, etc.)
│   └── specs/               # Test specs (ai-engine.spec.js, ai-engine-error-capture.spec.js, etc.)
├── fixtures/                # Shared fixtures (agent.fixture.js - dynamic test agent lifecycle)
├── shared/                  # Shared utilities (aiErrorCapture.js - runtime error & evidence capture)
├── websocket/               # WebSocket realtime protocol tests
│   ├── data/                # ws.config.js (endpoints, frame types, timeout defaults)
│   ├── fixtures/            # ws.fixture.js (WebSocket client fixture)
│   └── helpers/             # wsClient.helper.js (WsSession with latency & frame history tracking)
├── auth.helper.js           # Auth credentials helper
└── auth.setup.js            # Global setup for authentication state
```

## Running Tests

### By Project

```bash
# REST API Tests
npx playwright test --project=api

# AI Behavioral Tests
npx playwright test --project=ai

# WebSocket Tests
npx playwright test --project=websocket
```

### Direct AI Engine Error Capture Validation

```bash
npx playwright test test-engine/api/specs/ai-engine-error-capture.spec.js --project=api
```

### Report Generation

```bash
node reports/testNormalizer.js
```

Outputs normalized QA execution results with captured evidence to `reports/generated/qa-report.json`.
