# CATI QA Test Platform — Architecture

## 1. High-Level Architecture

```text
                         QA USER
                            |
                            | HTTPS
                            v
                 +----------------------+
                 |     QA DASHBOARD     |
                 |      React/Next      |
                 |                      |
                 | Run Tests            |
                 | Test Runs            |
                 | Failures / Bugs      |
                 | Reports              |
                 +----------+-----------+
                            |
                            | REST
                            v
                 +----------------------+
                 |      QA BACKEND      |
                 |    Node / Express    |
                 |                      |
                 | Orchestration        |
                 | Result processing    |
                 | Failure management   |
                 +----+------------+----+
                      |            |
                      v            v
              +-----------+   +-------------+
              | QA DB     |   | TEST RUNNER |
              | MongoDB   |   | Playwright  |
              |           |   |             |
              | Runs      |   | API         |
              | Results   |   | UI          |
              | Failures  |   | E2E         |
              | Severity  |   | WebSocket   |
              +-----------+   | AI/Voice    |
                              +------+------+
                                     |
                         HTTP / HTTPS / WebSocket
                                     |
                                     v
                    +-------------------------------+
                    |          CATI SYSTEM          |
                    |        SYSTEM UNDER TEST     |
                    |                               |
                    | Frontend                     |
                    | Backend APIs                 |
                    | AI Engine / WebSocket        |
                    | Existing services            |
                    +-------------------------------+
```

## 2. Core Rule

The QA platform is completely independent from CATI.

CATI should not receive:
- QA dashboard code
- QA-specific routes
- QA database models
- Test result storage
- Test-run UI
- QA-specific business logic

The QA platform interacts with CATI externally through its existing interfaces.

## 3. Test Execution

```text
User
  |
  v
Dashboard
  |
  | Run Tests
  v
QA Backend
  |
  v
Test Runner
  |
  +--> API Tests -------> CATI Backend
  |
  +--> UI Tests --------> CATI Frontend
  |
  +--> E2E Tests -------> CATI complete workflows
  |
  +--> WebSocket -------> CATI AI Engine
  |
  +--> AI/Voice --------> CATI AI scenarios
  |
  v
Results
  |
  +--> PASS
  |
  +--> FAIL --> Text evidence (error, stack, logs) --> AI analysis (text only)
  |             (Screenshot / Trace / Video only if enabled; not AI-analysed)
  |
  v
QA Database
  |
  v
Dashboard / Reports
```

## 4. Test Case Authoring

Test cases are stored in the QA database. UI/E2E cases hold a declarative
`definition` (`actions` + `assertions`) that the runner replays with Playwright.

UI cases can be authored two ways:

```text
Local machine                               Deployed QA platform
-------------                               --------------------
npm run record -- <url>                     Dashboard > Test Cases > Import
  |                                           |
  | real browser, user performs the flow      | review in the test case designer
  | steps captured (click/type/select/Enter)  v
  v                                         QA Backend --> QA Database
<case-id>.cati.json  -- upload ------------>   |
(autosaved on browser close)                   v
                                           Test Runner replays actions,
                                           then checks assertions
```

- Recording happens only on the tester's machine. The backend has no recorder,
  so it stays deployable on serverless platforms.
- The recorder (`backend/scripts/record.js`, `backend/services/recorderCore.js`)
  needs only `@playwright/test` and Chrome/Edge or Chromium. It does not need
  the backend, database or `.env`.
- Start page and navigation steps are saved as paths (e.g. `/login`), so the
  runner resolves them against its own `FRONTEND_URL`.
- Steps can also be built or edited by hand in the dashboard's test case designer.
- Typed values (including passwords) are stored in the file as typed.
- Running UI cases needs `TEST_EXECUTION_MODE=playwright`, `FRONTEND_URL`, and
  Chromium on the machine that runs the tests. Serverless platforms such as
  Vercel cannot host this part; it needs a long-lived worker or CI.

## 5. Failure Model

A failed test is not automatically a CATI bug.

Possible classifications:
- CATI defect
- Test-script defect
- Network issue
- Authentication/test-data issue
- Environment/service outage
- Unknown

## 6. Severity

Critical = core service or major business capability unusable.

High = important functionality broken.

Medium = partial failure or workaround exists.

Low = minor functional, wording, or UI issue.
