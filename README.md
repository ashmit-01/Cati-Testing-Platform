# CATI QA Dashboard

A React frontend for the CATI AI QA testing platform. It monitors and controls
test runs through the FastAPI QA backend - it never executes Playwright,
Selenium, pytest, or any test framework itself.

```
React QA Dashboard
      |
    Axios
      |
FastAPI QA Backend
      |
Test Run Controller
      |
Test Orchestrator
      |
Playwright / API / WebSocket / AI tests
      |
    CATI
```

The React app only starts test runs through the backend (`POST /api/test-runs`)
and displays whatever the backend reports back.

## Project setup

```bash
npm install
```

## npm commands

| Command           | Description                          |
|--------------------|---------------------------------------|
| `npm run dev`      | Start the Vite dev server (port 5173) |
| `npm run build`    | Production build to `dist/`           |
| `npm run preview`  | Preview the production build locally  |
| `npm run lint`     | Run ESLint                            |

## Environment variables

Copy `.env.example` to `.env` and point it at your FastAPI backend:

```bash
cp .env.example .env
```

```
VITE_API_BASE_URL=http://localhost:8000
```

The base URL is never hardcoded anywhere else in the project - every request
goes through the shared Axios instance in `src/services/api.js`.

## Routes

| Route             | Page             |
|--------------------|------------------|
| `/`                 | Redirects to `/dashboard` |
| `/dashboard`         | Summary cards, suite breakdown, recent failures, Run Tests |
| `/runs`              | Table of all test runs |
| `/runs/:id`          | Detail view for a single run |
| `/failures`          | Searchable/filterable failure list |
| `/failures/:id`      | Detail view for a single failure, with evidence |
| `/reports`           | Latest report, charts (distribution, pass-rate trend, suite performance) |

## API endpoints (expected from the FastAPI backend)

| Method | Endpoint               | Used by                  |
|--------|-------------------------|---------------------------|
| POST   | `/api/test-runs`        | Run Tests button          |
| GET    | `/api/dashboard`        | Dashboard page            |
| GET    | `/api/test-runs`        | Test Runs page            |
| GET    | `/api/test-runs/:id`    | Run Details page          |
| GET    | `/api/failures`         | Failures page (supports `search`, `suite`, `severity`, `status` query params) |
| GET    | `/api/failures/:id`     | Failure Details page      |
| GET    | `/api/reports`          | Reports page               |

All of these are wrapped by functions in `src/services/api.js`:
`startTestRun`, `getDashboard`, `getTestRuns`, `getTestRun`, `getFailures`,
`getFailure`, `getReports`.

## Mock data

While the backend isn't available, every function in `src/services/api.js`
returns data from `src/data/mockData.js` instead of calling Axios. This is
controlled by a single flag:

```js
// src/services/api.js
const USE_MOCK_DATA = true
```

Mock data is centralized in one file - no component hardcodes numbers or
sample records directly.

## Connecting the real FastAPI backend

1. Set `VITE_API_BASE_URL` in `.env` to your backend's URL.
2. In `src/services/api.js`, set `USE_MOCK_DATA = false`.
3. Make sure the backend implements the endpoints listed above and returns
   data shaped like the objects in `src/data/mockData.js` (or update the
   mapping inside `api.js` to translate the backend's actual response shape -
   keep that mapping in the service layer, not in the UI).
4. No other file needs to change - pages and components only ever call the
   functions exported from `api.js`.

## Project structure

```
src/
├── components/       Reusable UI: Layout, Sidebar, Header, badges, tables,
│                      loading/error/empty states, RunTestsButton, StatCard
├── pages/             Dashboard, Runs, RunDetails, Failures, FailureDetails,
│                      Reports
├── services/
│   └── api.js         Single Axios instance + all backend calls + mock fallback
├── data/
│   └── mockData.js     Centralized mock data
├── App.jsx             Route definitions
├── main.jsx             App entry point
└── index.css            Tailwind entry point
```

## Notes on the 4-day MVP scope

- A single **Run Tests** button starts all suites. The payload shape
  (`{ suites: 'all' }`) is already structured so a future suite-selection
  UI (checkboxes for API / UI / E2E / WebSocket / AI-Voice) can pass a
  filtered array without changing anything else.
- Loading, error, and empty states are implemented on every API-driven page.
  Edge cases are never left blank, and raw Axios errors are never shown to the user.
- The UI is responsive: a collapsible sidebar on mobile/tablet, and tables
  scroll horizontally instead of breaking the layout.
