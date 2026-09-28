// -----------------------------------------------------------------------
// Central mock data store.
//
// The FastAPI QA backend may not be reachable while the dashboard is being
// built, so every page reads from here through src/services/api.js. Once
// the backend is live, only api.js needs to change - no component in
// src/pages or src/components should import this file directly.
// -----------------------------------------------------------------------

export const mockSuites = [
  { id: 'api', name: 'API Tests', total: 35, passed: 32, failed: 2, skipped: 1 },
  { id: 'ui', name: 'UI Tests', total: 30, passed: 26, failed: 3, skipped: 1 },
  { id: 'e2e', name: 'E2E Tests', total: 25, passed: 20, failed: 4, skipped: 1 },
  { id: 'websocket', name: 'WebSocket Tests', total: 15, passed: 13, failed: 1, skipped: 1 },
  { id: 'ai-voice', name: 'AI/Voice Tests', total: 20, passed: 17, failed: 2, skipped: 1 }
]

const suiteTotals = mockSuites.reduce(
  (acc, s) => ({
    total: acc.total + s.total,
    passed: acc.passed + s.passed,
    failed: acc.failed + s.failed,
    skipped: acc.skipped + s.skipped
  }),
  { total: 0, passed: 0, failed: 0, skipped: 0 }
)

export const mockDashboard = {
  totalTests: suiteTotals.total,
  passed: suiteTotals.passed,
  failed: suiteTotals.failed,
  skipped: suiteTotals.skipped,
  passRate: Number(((suiteTotals.passed / suiteTotals.total) * 100).toFixed(1)),
  environment: 'STAGING',
  lastRun: {
    id: 102,
    date: '2026-09-25T23:30:00',
    status: 'completed'
  },
  suites: mockSuites
}

export const mockFailures = [
  {
    id: 1,
    test: 'Login with invalid password',
    suite: 'API',
    severity: 'Medium',
    status: 'Failed',
    environment: 'STAGING',
    runId: 102,
    expected: 'API should return a 401 Unauthorized response with an "invalid credentials" error message.',
    actual: 'API returned a 500 Internal Server Error instead of a 401.',
    endpoint: 'POST /api/auth/login',
    evidence: { screenshot: false, trace: false, consoleLogs: true, response: true }
  },
  {
    id: 2,
    test: 'Create Agent',
    suite: 'E2E',
    severity: 'High',
    status: 'Failed',
    environment: 'STAGING',
    runId: 102,
    expected: 'Agent should be created successfully and appear in the agents list.',
    actual: '500 Internal Server Error',
    endpoint: 'POST /api/agents',
    evidence: { screenshot: true, trace: true, consoleLogs: true, response: true }
  },
  {
    id: 3,
    test: 'WebSocket connection',
    suite: 'WebSocket',
    severity: 'Critical',
    status: 'Failed',
    environment: 'STAGING',
    runId: 102,
    expected: 'WebSocket handshake should complete and the client should receive a "connected" event within 2s.',
    actual: 'Connection timed out after 10s. No "connected" event received.',
    endpoint: 'WSS /ws/agents',
    evidence: { screenshot: false, trace: true, consoleLogs: true, response: false }
  },
  {
    id: 4,
    test: 'Dashboard loading',
    suite: 'UI',
    severity: 'High',
    status: 'Failed',
    environment: 'STAGING',
    runId: 102,
    expected: 'Dashboard should render summary cards within 3s of navigation.',
    actual: 'Dashboard rendered a blank screen. Console shows a hydration error.',
    endpoint: 'GET /dashboard',
    evidence: { screenshot: true, trace: false, consoleLogs: true, response: false }
  },
  {
    id: 5,
    test: 'Voice intent recognition - billing query',
    suite: 'AI/Voice',
    severity: 'Medium',
    status: 'Failed',
    environment: 'STAGING',
    runId: 101,
    expected: 'Voice input should be classified as "billing" intent with confidence > 0.85.',
    actual: 'Classified as "general" intent with confidence 0.61.',
    endpoint: 'POST /api/voice/classify',
    evidence: { screenshot: false, trace: false, consoleLogs: true, response: true }
  },
  {
    id: 6,
    test: 'Bulk agent import',
    suite: 'API',
    severity: 'Low',
    status: 'Failed',
    environment: 'STAGING',
    runId: 101,
    expected: 'CSV import of 50 agents should complete in under 5s.',
    actual: 'Import completed in 11.2s, exceeding the performance threshold.',
    endpoint: 'POST /api/agents/import',
    evidence: { screenshot: false, trace: false, consoleLogs: false, response: true }
  }
]

export const mockRuns = [
  {
    id: 102,
    date: '2026-09-25T23:30:00',
    duration: '4m 32s',
    total: 125,
    passed: 108,
    failed: 12,
    skipped: 5,
    status: 'Completed',
    environment: 'STAGING',
    suites: mockSuites
  },
  {
    id: 101,
    date: '2026-09-24T21:05:00',
    duration: '4m 10s',
    total: 120,
    passed: 110,
    failed: 7,
    skipped: 3,
    status: 'Completed',
    environment: 'STAGING',
    suites: [
      { id: 'api', name: 'API Tests', total: 34, passed: 31, failed: 2, skipped: 1 },
      { id: 'ui', name: 'UI Tests', total: 29, passed: 27, failed: 1, skipped: 1 },
      { id: 'e2e', name: 'E2E Tests', total: 24, passed: 22, failed: 2, skipped: 0 },
      { id: 'websocket', name: 'WebSocket Tests', total: 14, passed: 13, failed: 1, skipped: 0 },
      { id: 'ai-voice', name: 'AI/Voice Tests', total: 19, passed: 17, failed: 1, skipped: 1 }
    ]
  },
  {
    id: 100,
    date: '2026-09-23T18:40:00',
    duration: '5m 02s',
    total: 118,
    passed: 100,
    failed: 15,
    skipped: 3,
    status: 'Completed',
    environment: 'STAGING',
    suites: [
      { id: 'api', name: 'API Tests', total: 33, passed: 28, failed: 4, skipped: 1 },
      { id: 'ui', name: 'UI Tests', total: 28, passed: 24, failed: 3, skipped: 1 },
      { id: 'e2e', name: 'E2E Tests', total: 24, passed: 20, failed: 4, skipped: 0 },
      { id: 'websocket', name: 'WebSocket Tests', total: 14, passed: 12, failed: 2, skipped: 0 },
      { id: 'ai-voice', name: 'AI/Voice Tests', total: 19, passed: 16, failed: 2, skipped: 1 }
    ]
  }
]

export const mockReports = [
  {
    id: 102,
    runId: 102,
    title: 'Run #102 Report',
    date: '2026-09-25T23:30:00',
    total: 125,
    passed: 108,
    failed: 12,
    skipped: 5,
    passRate: 86.4,
    trend: [
      { run: '#98', passRate: 79.2 },
      { run: '#99', passRate: 81.5 },
      { run: '#100', passRate: 84.7 },
      { run: '#101', passRate: 91.7 },
      { run: '#102', passRate: 86.4 }
    ],
    suites: mockSuites
  }
]

// Simulates the response of POST /api/test-runs once the backend accepts
// a new run. The real backend will hand this same shape back.
export function createMockTestRun() {
  return {
    id: 103,
    status: 'queued',
    date: new Date().toISOString(),
    environment: 'STAGING'
  }
}
