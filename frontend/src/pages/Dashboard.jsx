import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import StatCard from '../components/StatCard.jsx'
import SuiteTable from '../components/SuiteTable.jsx'
import FailureTable from '../components/FailureTable.jsx'
import RunTestsButton from '../components/RunTestsButton.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'

import { getDashboard } from '../services/api.js'

function normalizeSuiteName(suite) {
  if (!suite) {
    return 'Unknown'
  }

  const value = String(suite).toUpperCase()

  if (value === 'AI_VOICE') {
    return 'AI / Voice'
  }

  if (value === 'WEBSOCKET') {
    return 'WebSocket'
  }

  return value
}

function normalizeFailure(failure) {
  return {
    id:
      failure.id ||
      failure._id ||
      failure.testResultId,

    test:
      failure.test ||
      failure.testName ||
      failure.title ||
      'Unnamed test',

    /*
     * IMPORTANT:
     *
     * Suite comes from TestResult.suite.
     * Do NOT fall back to category here.
     */
    suite:
      normalizeSuiteName(
        failure.suite
      ),

    severity:
      failure.severity ||
      'MEDIUM',

    status:
      failure.status ||
      'OPEN',

    category:
      failure.category ||
      'OTHER',

    description:
      failure.description ||
      'No failure description available.',

    expected:
      failure.expected ??
      null,

    actual:
      failure.actual ??
      null,

    endpoint:
      failure.endpoint ??
      null,

    page:
      failure.page ??
      null,

    evidence:
      failure.evidence ||
      {}
  }
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null
  })

  const [failures, setFailures] = useState([])

  const load = useCallback(
    async () => {
      try {
        setState((previous) => ({
          ...previous,
          status:
            previous.data
              ? 'success'
              : 'loading',
          error: null
        }))

        const response =
          await getDashboard()

        console.log(
          'Dashboard API response:',
          response
        )

        const dashboard =
          response?.dashboard ||
          response ||
          {}

        setState({
          status: 'success',
          data: dashboard,
          error: null
        })

        const recentFailures =
          Array.isArray(
            dashboard.recentFailures
          )
            ? dashboard.recentFailures
            : []

        setFailures(
          recentFailures
            .slice(0, 4)
            .map(normalizeFailure)
        )
      } catch (error) {
        console.error(
          'Dashboard loading error:',
          error
        )

        setState((previous) => ({
          status:
            previous.data
              ? 'success'
              : 'error',

          data:
            previous.data,

          error:
            error?.message ||
            'Please check the QA backend connection.'
        }))
      }
    },
    []
  )

  useEffect(() => {
    load()
  }, [load])

  /*
   * Refresh dashboard periodically so new test runs and
   * failure records appear without manually refreshing.
   */
  useEffect(() => {
    const interval =
      setInterval(
        load,
        5000
      )

    return () => {
      clearInterval(interval)
    }
  }, [load])

  if (
    state.status ===
      'loading' &&
    !state.data
  ) {
    return (
      <LoadingState
        label="Loading dashboard..."
      />
    )
  }

  if (
    state.status ===
      'error' &&
    !state.data
  ) {
    return (
      <ErrorState
        title="Unable to load dashboard data."
        message={
          state.error ||
          'Please check the QA backend connection.'
        }
        onRetry={load}
      />
    )
  }

  const d =
    state.data || {}

  // ------------------------------------------------------------
  // Latest run
  // ------------------------------------------------------------

  const recentRuns =
    Array.isArray(
      d.recentRuns
    )
      ? d.recentRuns
      : []

  const lastRun =
    recentRuns.length > 0
      ? recentRuns[0]
      : null

  // ------------------------------------------------------------
  // Suites
  // ------------------------------------------------------------

  const suites =
    Array.isArray(
      d.suites
    )
      ? d.suites.map(
          (suite, index) => ({
            ...suite,

            id:
              suite.id ||
              suite._id ||
              suite.name ||
              `suite-${index}`,

            name:
              suite.name ||
              suite.suite ||
              'Unknown',

            total:
              Number(
                suite.total ??
                suite.totalTests ??
                0
              ),

            passed:
              Number(
                suite.passed ??
                suite.passedTests ??
                0
              ),

            failed:
              Number(
                suite.failed ??
                suite.failedTests ??
                0
              )
          })
        )
      : []

  // ------------------------------------------------------------
  // Statistics
  // ------------------------------------------------------------

  const totalTests =
    Number(
      d.totalTests ??
      d.total ??
      0
    )

  const passedTests =
    Number(
      d.passedTests ??
      d.passed ??
      0
    )

  const failedTests =
    Number(
      d.failedTests ??
      d.failed ??
      0
    )

  const skippedTests =
    Number(
      d.skippedTests ??
      d.skipped ??
      0
    )

  const calculatedPassRate =
    totalTests > 0
      ? Number(
          (
            (
              passedTests /
              totalTests
            ) *
            100
          ).toFixed(2)
        )
      : 0

  const passRate =
    Number(
      d.passRate ??
      calculatedPassRate
    )

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="space-y-8">

      {/* ====================================================== */}
      {/* LAST RUN + RUN TESTS */}
      {/* ====================================================== */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

        <div>

          {lastRun ? (
            <p className="text-sm text-secondary">

              Last run{' '}

              <button
                onClick={() => {

                  const runId =
                    lastRun.runId ||
                    lastRun.id

                  if (runId) {
                    navigate(
                      `/runs/${runId}`
                    )
                  }
                }}
                className="font-medium text-info hover:underline"
              >
                #
                {lastRun.runId ||
                  lastRun.id}
              </button>

              {' · '}

              {lastRun.startedAt ||
              lastRun.date
                ? new Date(
                    lastRun.startedAt ||
                    lastRun.date
                  ).toLocaleString()
                : 'Unknown date'}

            </p>
          ) : (
            <p className="text-sm text-secondary">
              No test runs yet
            </p>
          )}

        </div>

        <RunTestsButton />

      </div>

      {/* ====================================================== */}
      {/* STATISTICS */}
      {/* ====================================================== */}

      <section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

          <StatCard
            label="Total Tests"
            value={totalTests}
          />

          <StatCard
            label="Passed"
            value={passedTests}
            accent="success"
          />

          <StatCard
            label="Failed"
            value={failedTests}
            accent="failure"
          />

          <StatCard
            label="Skipped"
            value={skippedTests}
            accent="warning"
          />

          <StatCard
            label="Pass Rate"
            value={passRate}
            suffix="%"
            accent="info"
          />

        </div>

      </section>

      {/* ====================================================== */}
      {/* TEST SUITES */}
      {/* ====================================================== */}

      <section className="space-y-3">

        <div className="flex items-center justify-between">

          <h2 className="text-sm font-semibold text-primary">
            Test Suites
          </h2>

          <span className="text-xs text-secondary">
            {suites.length} suites
          </span>

        </div>

        {suites.length > 0 ? (
          <SuiteTable
            suites={suites}
          />
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-secondary">
            No suite data available.
          </div>
        )}

      </section>

      {/* ====================================================== */}
      {/* RECENT FAILURES */}
      {/* ====================================================== */}

      <section className="space-y-3">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-sm font-semibold text-primary">
              Recent Failures
            </h2>

            <p className="mt-1 text-xs text-secondary">
              Latest recorded test failures
            </p>

          </div>

          <button
            onClick={() =>
              navigate('/failures')
            }
            className="text-xs font-medium text-info hover:underline"
          >
            View all
          </button>

        </div>

        {failures.length > 0 ? (
          <FailureTable
            failures={failures}
          />
        ) : failedTests > 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">

            <p className="text-sm font-medium text-primary">
              {failedTests} tests have failed,
              but no recent failure details
              were returned.
            </p>

            <button
              onClick={() =>
                navigate('/failures')
              }
              className="mt-4 rounded-md border border-border px-4 py-2 text-xs font-medium text-primary hover:border-info hover:text-info"
            >
              Open Failures
            </button>

          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-secondary">
            No test failures found.
          </div>
        )}

      </section>

    </div>
  )
}