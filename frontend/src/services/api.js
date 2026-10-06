// -----------------------------------------------------------------------
// CATI QA Frontend API Service
//
// This is the ONLY place in the frontend that knows about:
// - Axios
// - Backend URL
// - HTTP endpoints
// - Backend response formatting
//
// React pages/components should only call the functions exported here.
// -----------------------------------------------------------------------

import axios from 'axios'

// -----------------------------------------------------------------------
// AXIOS INSTANCE
// -----------------------------------------------------------------------

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5001',

  timeout: 15000,

  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('adminToken');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// -----------------------------------------------------------------------
// ERROR HANDLING
// -----------------------------------------------------------------------

function toFriendlyError(error, fallbackMessage) {
  const backendMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error

  const friendly = new Error(
    backendMessage || fallbackMessage
  )

  friendly.status =
    error?.response?.status ?? null

  friendly.cause = error

  return friendly
}

export async function loginAdmin(email, password) {
    const response = await api.post('/api/auth/login', {
        email,
        password,
    });

    const { token, user } = response.data;

    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(user));

    return response.data;
}

// -----------------------------------------------------------------------
// TEST RUNS
// -----------------------------------------------------------------------

/**
 * Start a new test run.
 *
 * Example payload:
 *
 * {
 *   environment: "staging",
 *   suites: ["API", "UI", "E2E"]
 * }
 */
export async function startTestRun(
  payload = {
    environment: 'staging',
    suites: ['API']
  }
) {
  try {
    const { data } = await api.post(
      '/api/test-runs',
      payload
    )

    console.log('Started test run:', data)

    // Backend may return:
    //
    // {
    //   success: true,
    //   run: {...}
    // }
    //
    // or directly:
    //
    // {
    //   runId: "...",
    //   ...
    // }

    return data?.run || data
  } catch (error) {
    console.error(
      'Failed to start test run:',
      error
    )

    throw toFriendlyError(
      error,
      'Failed to start test run. Please check the QA backend connection.'
    )
  }
}

/**
 * Get all test runs.
 */
export async function getTestRuns() {
  try {
    const { data } = await api.get(
      '/api/test-runs'
    )

    console.log('Test runs response:', data)

    // Backend:
    //
    // {
    //   success: true,
    //   runs: [...]
    // }

    if (Array.isArray(data)) {
      return data
    }

    return data?.runs || []
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load test runs. Please check the QA backend connection.'
    )
  }
}

/**
 * Get one test run.
 *
 * IMPORTANT:
 * The application uses runId such as:
 *
 * RUN-20260928-004
 *
 * not MongoDB _id.
 */
export async function getTestRun(id) {
  if (!id || id === 'undefined') {
    throw new Error(
      'Invalid test run ID.'
    )
  }

  try {
    const { data } = await api.get(
      `/api/test-runs/${encodeURIComponent(id)}`
    )

    console.log(
      'Test run response:',
      data
    )

    // Support:
    //
    // { success: true, run: {...} }
    //
    // or:
    //
    // { runId: "...", ... }

    return data?.run || data
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load this test run. Please check the QA backend connection.'
    )
  }
}

// -----------------------------------------------------------------------
// DASHBOARD
// -----------------------------------------------------------------------

/**
 * Get dashboard statistics.
 */
export async function getDashboard() {
  try {
    const { data } = await api.get(
      '/api/dashboard'
    )

    console.log(
      'Dashboard response:',
      data
    )

    // Backend may return:
    //
    // {
    //   success: true,
    //   dashboard: {...}
    // }
    //
    // or directly:
    //
    // {...}

    return data?.dashboard || data
  } catch (error) {
    throw toFriendlyError(
      error,
      'Unable to load dashboard data. Please check the QA backend connection.'
    )
  }
}

// -----------------------------------------------------------------------
// FAILURES
// -----------------------------------------------------------------------

/**
 * Get failures.
 *
 * Supported filters:
 *
 * {
 *   search,
 *   suite,
 *   severity,
 *   status
 * }
 */
export async function getFailures(
  params = {}
) {
  try {
    const cleanParams = {}

    // Search
    if (params.search) {
      cleanParams.search =
        params.search
    }

    // Suite
    if (
      params.suite &&
      params.suite !== 'all'
    ) {
      cleanParams.suite =
        params.suite
    }

    // Severity
    if (
      params.severity &&
      params.severity !== 'all'
    ) {
      cleanParams.severity =
        params.severity
    }

    // Status
    if (
      params.status &&
      params.status !== 'all'
    ) {
      cleanParams.status =
        params.status
    }

    const { data } =
      await api.get(
        '/api/failures',
        {
          params: cleanParams
        }
      )

    console.log(
      'Failures response:',
      data
    )

    // Backend:
    //
    // {
    //   success: true,
    //   count: 4,
    //   failures: [...]
    // }

    const failures =
      Array.isArray(data)
        ? data
        : data?.failures || []

    // Normalize backend Failure
    // documents for the frontend.
    return failures.map(
      (failure) => ({
        id:
          failure._id ||
          failure.id,

        test:
          failure.test ||
          failure.testName ||
          failure.title ||
          'Unknown test',

        suite:
          failure.suite ||
          failure.category ||
          'OTHER',

        severity:
          failure.severity ||
          'LOW',

        status:
          failure.status ||
          'OPEN',

        description:
          failure.description ||
          '',

        runId:
          failure.runId,

        testResultId:
          failure.testResultId,

        environment:
          failure.environment ||
          '',

        expected:
          failure.expected,

        actual:
          failure.actual,

        endpoint:
          failure.endpoint ||
          '',

        page:
          failure.page ||
          '',

        category:
          failure.category ||
          '',

        evidence:
          failure.evidence ||
          {},

        createdAt:
          failure.createdAt,

        updatedAt:
          failure.updatedAt
      })
    )
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load failures. Please check the QA backend connection.'
    )
  }
}

/**
 * Get a single failure.
 */
export async function getFailure(id) {
  if (!id || id === 'undefined') {
    throw new Error(
      'Invalid failure ID.'
    )
  }

  try {
    const { data } =
      await api.get(
        `/api/failures/${encodeURIComponent(id)}`
      )

    console.log(
      'Failure response:',
      data
    )

    return data?.failure || data
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load this failure. Please check the QA backend connection.'
    )
  }
}

// -----------------------------------------------------------------------
// REPORTS
// -----------------------------------------------------------------------

/**
 * Get list of reports.
 */
export async function getReports() {
  try {
    const { data } =
      await api.get(
        '/api/reports'
      )

    console.log(
      'Reports response:',
      data
    )

    // Backend:
    //
    // {
    //   success: true,
    //   count: 5,
    //   reports: [...]
    // }

    if (Array.isArray(data)) {
      return data
    }

    return data?.reports || []
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load reports. Please check the QA backend connection.'
    )
  }
}

/**
 * Get detailed report for one run.
 *
 * Example:
 *
 * getReport("RUN-20260928-004")
 */
export async function getReport(runId) {
  if (!runId || runId === 'undefined') {
    throw new Error(
      'Invalid run ID.'
    )
  }

  try {
    const { data } =
      await api.get(
        `/api/reports/${encodeURIComponent(runId)}`
      )

    console.log(
      'Report response:',
      data
    )

    // Backend:
    //
    // {
    //   success: true,
    //   report: {...}
    // }

    return data?.report || data
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load the report. Please check the QA backend connection.'
    )
  }
}

// -----------------------------------------------------------------------
// TEST RESULTS
// -----------------------------------------------------------------------

/**
 * Get test results.
 *
 * Optional:
 *
 * {
 *   runId: "RUN-20260928-004",
 *   status: "FAIL",
 *   suite: "API"
 * }
 */
export async function getTestResults(
  params = {}
) {
  try {
    const { data } =
      await api.get(
        '/api/results',
        {
          params
        }
      )

    console.log(
      'Test results response:',
      data
    )

    if (Array.isArray(data)) {
      return data
    }

    return data?.results || []
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load test results. Please check the QA backend connection.'
    )
  }
}

/**
 * Get one test result.
 */
export async function getTestResult(id) {
  if (!id || id === 'undefined') {
    throw new Error(
      'Invalid test result ID.'
    )
  }

  try {
    const { data } =
      await api.get(
        `/api/results/${encodeURIComponent(id)}`
      )

    console.log(
      'Test result response:',
      data
    )

    return data?.result || data
  } catch (error) {
    throw toFriendlyError(
      error,
      'Failed to load this test result. Please check the QA backend connection.'
    )
  }
}

// -----------------------------------------------------------------------
// HEALTH
// -----------------------------------------------------------------------

/**
 * Check whether the QA backend is running.
 */
export async function getHealth() {
  try {
    const { data } =
      await api.get(
        '/api/health'
      )

    return data
  } catch (error) {
    throw toFriendlyError(
      error,
      'QA backend is unavailable.'
    )
  }
}