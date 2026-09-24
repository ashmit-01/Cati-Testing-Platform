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
  +--> FAIL --> Screenshot / Trace / Video / Logs
  |
  v
QA Database
  |
  v
Dashboard / Reports
```

## 4. Failure Model

A failed test is not automatically a CATI bug.

Possible classifications:
- CATI defect
- Test-script defect
- Network issue
- Authentication/test-data issue
- Environment/service outage
- Unknown

## 5. Severity

Critical = core service or major business capability unusable.

High = important functionality broken.

Medium = partial failure or workaround exists.

Low = minor functional, wording, or UI issue.
