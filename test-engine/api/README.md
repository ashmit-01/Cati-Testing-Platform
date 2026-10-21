# CATI QA Test Platform — API Testing Module

Independent, maintainable API testing module built using Playwright's native HTTP testing capabilities (`APIRequestContext`, `request` fixture).

Integrated into the existing Playwright test runner without external HTTP dependencies (no Axios, no Supertest, no Jest, no Mocha).

---

## 1. Directory Structure

```text
test-engine/api/
├── README.md               # Module architecture & usage guide
├── fixtures/
│   └── api.fixture.js      # Playwright test.extend fixture (apiContext, authToken, authContext)
├── helpers/
│   ├── auth.helper.js      # Pure HTTP wrappers for /api/auth/*
│   ├── agents.helper.js    # Pure HTTP wrappers for /api/agents/*
│   ├── agent-kb.helper.js  # Pure HTTP wrappers for /api/agents/:id/knowledge/*
│   ├── calls.helper.js     # Pure HTTP wrappers for /api/calls/*
│   ├── analytics.helper.js # Pure HTTP wrappers for /api/analytics/*
│   ├── billing.helper.js   # Pure HTTP wrappers for /api/billing/*
│   ├── payments.helper.js  # Pure HTTP wrappers for /api/payments/*
│   ├── wallet.helper.js    # Pure HTTP wrappers for /api/wallet/*
│   ├── aiEngine.helper.js  # Pure HTTP wrappers for /api/ai-engine/*
│   ├── vobiz.helper.js     # Pure HTTP wrappers for /api/vobiz/*
│   └── calling.helper.js   # Pure HTTP wrappers for /api/calling/*
├── data/
│   └── constants.js        # Safe non-secret test constants & boundary payloads
└── specs/
    ├── auth.spec.js        # Signup, login, current user, refresh & logout lifecycle
    ├── agents.spec.js      # Agent CRUD, prompt generation, edit, system prompt
    ├── agent-kb.spec.js    # Knowledge base queries, chunk deletion, scraping guards
    ├── calls.spec.js       # Call history, call details, recording download & stream
    ├── analytics.spec.js   # Overview, calls-per-day, calls-per-agent, recent-calls
    ├── billing.spec.js     # Balance inquiry and paginated transactions
    ├── payments.spec.js    # Order creation, verification validation, admin refund boundary
    ├── wallet.spec.js      # Wallet balance, currency, stats, renewal alerts
    ├── ai-engine.spec.js   # Provider catalog and query input validation
    ├── vobiz.spec.js       # Config, numbers inventory, routing, telephony guards
    ├── calling.spec.js     # Safe bulk CSV/Excel upload, campaigns, security checks
    └── validation.spec.js  # Cross-domain 400, 401, 403, 404 boundary validations
```

---

## 2. Authentication Lifecycle

API tests do **not** use or share browser `storageState` from `test-engine/auth.setup.js`.

Instead, authentication is independently handled via `test-engine/api/fixtures/api.fixture.js`:

```text
Test Invocation
      ↓
[api.fixture]
      ↓
Call POST /api/auth/login using TEST_EMAIL & TEST_PASSWORD
      ↓
Extract JWT from response ({ token })
      ↓
Create authenticated context (Authorization: Bearer <JWT>)
      ↓
Pass `authContext` to spec
      ↓
Execute Test Assertions
      ↓
Dispose context
```

### Safety & Secret Sanitization:
- No tokens or passwords are ever logged or checked into source files.
- The fixture exposes `attachApiEvidence()`, which automatically redacts `token`, `password`, `authorization`, `cookie`, `secret`, and `apiKey` fields before attaching request/response evidence to the Playwright HTML report.
- Each test gets an isolated fixture instance, preventing token blacklist conflicts (e.g. after testing `/api/auth/logout`).

---

## 3. Environment Configuration

Create or update `.env` in the repository root (see `.env.example`):

```bash
# Environment mode
TEST_ENV=staging

# CATI Backend API URL
BACKEND_URL=http://localhost:5000

# Dedicated Test Credentials
TEST_EMAIL=qa-test-user@usecati.com
TEST_PASSWORD=StrongTestPassword123!

# Safety Guards (DEFAULT: false — fails closed)
ALLOW_REAL_CALLS=false
ALLOW_LIVE_PAYMENTS=false
```

---

## 4. Execution Commands

Run all tests via standard npm scripts and the dedicated `api` Playwright project:

### Run the entire API test suite:
```bash
npx playwright test --project=api
```

### Run a specific domain spec:
```bash
# Auth tests
npx playwright test --project=api test-engine/api/specs/auth.spec.js

# Agent tests
npx playwright test --project=api test-engine/api/specs/agents.spec.js

# Analytics tests
npx playwright test --project=api test-engine/api/specs/analytics.spec.js

# Validation tests
npx playwright test --project=api test-engine/api/specs/validation.spec.js

# Billing & Wallet tests
npx playwright test --project=api test-engine/api/specs/billing.spec.js
npx playwright test --project=api test-engine/api/specs/wallet.spec.js
```

### View Playwright HTML Report:
```bash
npm run test:report
```

---

## 5. Safe vs. Side-Effecting Tests

To prevent accidental charges, live telephony calls, or destructive mutations, all side-effecting operations are **safe by default (fail-closed)**:

| Operation | Default Behavior | Guard Required to Enable |
| :--- | :--- | :--- |
| `POST /api/calls` (Live Call) | **Skipped** | `ALLOW_REAL_CALLS=true` |
| `POST /api/vobiz/call` (Live Call) | **Skipped** | `ALLOW_REAL_CALLS=true` |
| `POST /api/calling/single` (Live Call) | **Skipped** | `ALLOW_REAL_CALLS=true` |
| `POST /api/calling/bulk/start` (Bulk Calls) | **Skipped** | `ALLOW_REAL_CALLS=true` |
| `POST /api/calling/bulk/upload` (File Parse) | **Active** (Parses file in memory only, no calls initiated) | None |
| `POST /api/payments/:id/refund` (Real Refund) | **Protected** (Tests 403 Forbidden for non-admin) | `ALLOW_LIVE_PAYMENTS=true` |
| Agent Creation / Deletion | **Self-contained** (Created test agents are cleaned up in `finally`) | None |

---

## 6. How to Add a New API Test

1. **Add Pure HTTP Wrapper to Helper**:
   In `test-engine/api/helpers/<domain>.helper.js`, add a function that accepts `context` and payload/options and returns the raw `Promise<APIResponse>`. Do **not** place assertions in helpers.

2. **Add Spec in `test-engine/api/specs/`**:
   Import `test`, `expect`, and `attachApiEvidence` from `../fixtures/api.fixture.js`.
   Use `apiContext` for unauthenticated tests and `authContext` for authenticated tests:

   ```javascript
   import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
   import * as myHelper from '../helpers/myDomain.helper.js';

   test('POST /api/endpoint - should validate behavior', async ({ authContext }, testInfo) => {
       const start = Date.now();
       const response = await myHelper.doSomething(authContext, { foo: 'bar' });
       const durationMs = Date.now() - start;
       const body = await response.json().catch(() => ({}));

       await attachApiEvidence(testInfo, {
           method: 'POST',
           endpoint: '/api/endpoint',
           expectedStatus: 200,
           actualStatus: response.status(),
           durationMs,
           responseBody: body,
       });

       expect(response.status()).toBe(200);
       expect(body).toHaveProperty('success', true);
   });
   ```

3. **Verify Execution**:
   Run `npx playwright test --project=api test-engine/api/specs/<domain>.spec.js`.
