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
├── artifacts/            # Screenshots, traces, videos, etc.
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

## Safety

Only run authorized tests against CATI environments. Destructive operations, real calls, paid operations, and production data changes should use approved test resources or a dedicated QA/staging environment.
