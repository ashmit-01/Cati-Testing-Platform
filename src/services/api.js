// -----------------------------------------------------------------------
// API service layer.
//
// This is the ONLY place in the app that knows about HTTP, Axios, the
// backend base URL, or mock-data fallbacks. Pages and components call the
// functions exported here and receive plain, predictable data shapes back
// - they never talk to Axios or mockData.js directly.
//
// Architecture reminder:
//   React QA Dashboard -> Axios -> FastAPI QA Backend -> Test Run
//   Controller -> Test Orchestrator -> Playwright / API / WebSocket /
//   AI tests -> CATI
//
// The React app never imports or executes Playwright, Selenium, pytest or
// any test framework. It only calls these HTTP endpoints and renders
// whatever the backend reports back.
// -----------------------------------------------------------------------

import axios from 'axios'
import {
  mockDashboard,
  mockRuns,
  mockFailures,
  mockReports,
  createMockTestRun
} from '../data/mockData.js'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000
})

// Toggle this off (or drive it from an env var) once the FastAPI backend
// is reachable in every environment you deploy to.
const USE_MOCK_DATA = true

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A single place to turn any Axios/network error into a message that is
// safe to show a user - never leak raw Axios/error internals into the UI.
function toFriendlyError(error, fallbackMessage) {
  const friendly = new Error(fallbackMessage)
  friendly.status = error?.response?.status ?? null
  friendly.cause = error
  return friendly
}

// ---------------------------------------------------------------------
// Test runs
// ---------------------------------------------------------------------

export async function startTestRun(payload = { suites: 'all' }) {
  if (USE_MOCK_DATA) {
    await delay(900)
    return createMockTestRun()
  }
  try {
    const { data } = await api.post('/api/test-runs', payload)
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Failed to start test run. Please check the QA backend connection.')
  }
}

export async function getDashboard() {
  if (USE_MOCK_DATA) {
    await delay(500)
    return mockDashboard
  }
  try {
    const { data } = await api.get('/api/dashboard')
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Unable to load dashboard data. Please check the QA backend connection.')
  }
}

export async function getTestRuns() {
  if (USE_MOCK_DATA) {
    await delay(500)
    return mockRuns
  }
  try {
    const { data } = await api.get('/api/test-runs')
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Failed to load test runs. Please check the QA backend connection.')
  }
}

export async function getTestRun(id) {
  if (USE_MOCK_DATA) {
    await delay(400)
    const run = mockRuns.find((r) => String(r.id) === String(id))
    if (!run) throw new Error('Run not found.')
    return run
  }
  try {
    const { data } = await api.get(`/api/test-runs/${id}`)
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Failed to load this test run. Please check the QA backend connection.')
  }
}

// ---------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------

export async function getFailures(params = {}) {
  if (USE_MOCK_DATA) {
    await delay(500)
    let results = [...mockFailures]
    if (params.search) {
      const q = params.search.toLowerCase()
      results = results.filter((f) => f.test.toLowerCase().includes(q))
    }
    if (params.suite && params.suite !== 'all') {
      results = results.filter((f) => f.suite === params.suite)
    }
    if (params.severity && params.severity !== 'all') {
      results = results.filter((f) => f.severity === params.severity)
    }
    if (params.status && params.status !== 'all') {
      results = results.filter((f) => f.status === params.status)
    }
    return results
  }
  try {
    const { data } = await api.get('/api/failures', { params })
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Failed to load failures. Please check the QA backend connection.')
  }
}

export async function getFailure(id) {
  if (USE_MOCK_DATA) {
    await delay(400)
    const failure = mockFailures.find((f) => String(f.id) === String(id))
    if (!failure) throw new Error('Failure not found.')
    return failure
  }
  try {
    const { data } = await api.get(`/api/failures/${id}`)
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Failed to load this failure. Please check the QA backend connection.')
  }
}

// ---------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------

export async function getReports() {
  if (USE_MOCK_DATA) {
    await delay(500)
    return mockReports
  }
  try {
    const { data } = await api.get('/api/reports')
    return data
  } catch (error) {
    throw toFriendlyError(error, 'Failed to load reports. Please check the QA backend connection.')
  }
}
