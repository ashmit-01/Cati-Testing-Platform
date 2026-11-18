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

## 5. Endpoint Import (API tests from the target backend)

The platform never reads the target backend's code. The backend exports its
endpoint list and the platform tests the deployed URL (`BACKEND_URL`).

```text
voice-ai-backend (any branch)             Testing platform
-----------------------------             ----------------
node scripts/exportEndpoints.js           Dashboard > Test Cases > Import
  --out endpoints.json  ---------------->   POST /api/test-cases/import-endpoints
(walks the Express route stack;             creates API smoke cases, skips
 nothing is started or connected)           ones that already exist
```

- Export format: `{ format: "cati-endpoints", version: 1, source, endpoints[] }`
  with `method`, `path`, `auth` (`public|jwt|admin|internal-key`), `bodyFields`,
  `queryFields`, `multipart` per endpoint. Run it per branch to match its routes.
- Safe by default: only plain GET endpoints with no path parameters and no
  sensitive keywords (payments, calls, webhooks, deletes, ...) are enabled.
  Everything else is created inactive with `definition.risk` tags for review.
- Imported cases use the smoke assertion `statusBelow 500`. Edit or add
  assertions per case in the designer; manual cases can target the same endpoint.
- Re-importing never overwrites a case with the same `testCaseId`
  (`EP-<METHOD>-<path>`), so manual edits survive.
- Credentials come from the platform `.env`: `TEST_EMAIL`/`TEST_PASSWORD`
  (optionally `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD`) for login tokens and
  `INTERNAL_API_KEY` for internal routes. Nothing secret is stored in a case.
- The case designer's API step has an Authentication dropdown. It lists the
  platform's configured options (`GET /api/test-cases/auth-options` reports which
  `.env` credentials exist) plus Custom: a bearer token, a header, or a login.
- Variables: `{{name}}` in the endpoint, body or auth values reads
  `definition.variables`; `/api/agents/:id` takes `id` from the same list;
  `{{env.NAME}}` reads `CATI_VAR_NAME` from the platform `.env` (only that
  prefix is readable). A missing variable fails the case before any request is sent.

## 6. OpenAPI Import and Target URLs

The target backend publishes an OpenAPI 3.x spec. Upload it (`.json`, `.yaml`)
from Dashboard > Test Cases > Import; the dialog shows a dry run before anything
is saved (`POST /api/test-cases/import-openapi?dryRun=true`, body `{ spec }`).

- One case per operation, id `OA-<operationId>` (or `OA-<METHOD>-<path>`),
  `definition.source = "openapi"`. Path `{id}` becomes `:id`; required query and
  header parameters become `{{variables}}` seeded from spec examples/defaults.
- Request bodies come from the JSON request example, or are generated from the
  schema. Auth maps from `security`: none -> `public`, http bearer -> `jwt`,
  apiKey `x-internal-api-key` -> `internal-key`, others -> `custom`. An
  operation can force it with `x-cati-auth: admin`.
- Assertions: `status` = lowest documented 2xx, plus `schema` when a JSON
  response schema exists. The schema is stored on the case
  (`definition.responseSchema`, refs inlined, 3.0 `nullable` converted) and
  validated with Ajv at run time. No 2xx documented -> `statusBelow`.
- Same safety rules as the endpoint import: mutating, sensitive, multipart,
  and path-parameter-without-example operations start inactive.
- Re-import: a fingerprint of the generated content is stored in
  `definition.openapi.fingerprint`. Untouched cases are refreshed, edited cases
  are kept, operations that left the spec are deactivated
  (`definition.openapi.removed`), never deleted. Switching a case on/off or
  moving it to a suite does not count as an edit.
- Manual API cases live beside generated ones and use the same executor.
- Bundles: an import creates (or reuses) a bundle, which is a `TestSuite` with
  `source: { kind: "openapi", specTitle, specVersion, fileName, importedAt }`.
  Reuse is keyed on the spec title, so a newer version of the same API lands in
  the same bundle. New cases join it; existing loose cases with a matching id
  are adopted, unless they already sit in another suite. Cases removed from the
  spec stay in the bundle, deactivated.
- Test Cases page groups cases per bundle. A bundle header can run the whole
  bundle (`POST /api/test-runs` with `suiteId`, active cases only, with the
  target URL dialog), switch all cases on/off (`POST /api/test-suites/:id/active`),
  rename it, or delete it (cases are detached, not deleted). Selected cases can be
  moved between bundles (`POST /api/test-suites/:id/assign`).

Target URL per run: "Run selected" asks for a base URL (e.g.
`http://localhost:5000`, a branch preview). It is stored as `TestRun.targetUrl`
and used for every API case in that run instead of `CATI_API_URL` /
`BACKEND_URL`. Test login credentials are sent to that URL, so set
`CATI_TARGET_ALLOWLIST` (comma-separated hosts, `*.` wildcard) to restrict it.
Real HTTP runs need `TEST_EXECUTION_MODE=playwright`.

## 7. Failure Model

A failed test is not automatically a CATI bug.

Possible classifications:
- CATI defect
- Test-script defect
- Network issue
- Authentication/test-data issue
- Environment/service outage
- Unknown

## 8. Severity

Critical = core service or major business capability unusable.

High = important functionality broken.

Medium = partial failure or workaround exists.

Low = minor functional, wording, or UI issue.
