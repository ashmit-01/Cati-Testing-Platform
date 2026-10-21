import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  RefreshCw
} from 'lucide-react'

import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import FailureTable from '../components/FailureTable.jsx'

import { getTestRun } from '../services/api.js'

const POLL_INTERVAL = 2000

function formatDate(date) {
  if (!date) {
    return 'N/A'
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleString()
}

function formatDuration(duration) {
  const ms = Number(duration)

  if (!Number.isFinite(ms) || ms <= 0) {
    return '0s'
  }

  const totalSeconds =
    Math.floor(ms / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes =
    Math.floor(
      totalSeconds / 60
    )

  const seconds =
    totalSeconds % 60

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`
  }

  const hours =
    Math.floor(
      minutes / 60
    )

  const remainingMinutes =
    minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

function normalizeFailure(failure) {
  if (!failure) {
    return null
  }

  return {
    ...failure,

    id:
      failure.id ||
      failure._id ||
      failure.testResultId ||
      null,

    test:
      failure.test ||
      failure.testName ||
      failure.title ||
      'Unknown test',

    suite:
      failure.suite ||
      failure.suiteName ||
      'Unknown',

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
      failure.error ||
      'No failure description available.',

    evidence:
      failure.evidence ||
      {}
  }
}

function extractFailures(run) {
  if (!run) {
    return []
  }

  const rawFailures =
    Array.isArray(
      run.recentFailures
    )
      ? run.recentFailures
      : Array.isArray(
          run.failures
        )
        ? run.failures
        : []

  return rawFailures
    .map(normalizeFailure)
    .filter(Boolean)
}

export default function RunDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [state, setState] =
    useState({
      status: 'loading',
      run: null,
      error: null
    })

  const [refreshing, setRefreshing] =
    useState(false)

  const load = useCallback(
    async (showLoading = true) => {

      /*
       * This prevents requests such as:
       *
       * /api/test-runs/undefined
       */
      if (!id || id === 'undefined' || id === 'null') {
        setState({
          status: 'error',
          run: null,
          error: 'Invalid test run ID.'
        })

        return
      }

      try {

        if (showLoading) {
          setState(
            (previous) => ({
              ...previous,
              status:
                previous.run
                  ? 'success'
                  : 'loading',
              error: null
            })
          )
        }

        setRefreshing(true)

        const data =
          await getTestRun(
            decodeURIComponent(id)
          )

        if (!data) {
          throw new Error(
            'Test run data was not returned by the backend.'
          )
        }

        setState({
          status: 'success',
          run: data,
          error: null
        })

      } catch (error) {

        console.error(
          'Run details loading error:',
          error
        )

        setState(
          (previous) => ({
            status:
              previous.run
                ? 'success'
                : 'error',

            run:
              previous.run,

            error:
              error?.message ||
              'Unable to load run details.'
          })
        )

      } finally {
        setRefreshing(false)
      }
    },
    [id]
  )

  /*
   * Initial request.
   */
  useEffect(() => {
    load(true)
  }, [load])

  /*
   * Poll while RUNNING.
   */
  useEffect(() => {

    if (!state.run) {
      return undefined
    }

    const status =
      String(
        state.run.status
      ).toUpperCase()

    if (status !== 'RUNNING') {
      return undefined
    }

    const interval =
      setInterval(() => {
        load(false)
      }, POLL_INTERVAL)

    return () => {
      clearInterval(interval)
    }

  }, [
    state.run?.status,
    load
  ])

  /*
   * Loading state.
   */
  if (
    state.status ===
      'loading' &&
    !state.run
  ) {
    return (
      <LoadingState
        label="Loading run details..."
      />
    )
  }

  /*
   * Error state.
   */
  if (
    state.status ===
      'error' &&
    !state.run
  ) {
    return (
      <ErrorState
        title="Failed to load this test run."
        message={
          state.error ||
          'Unable to load run details.'
        }
        onRetry={() =>
          load(true)
        }
      />
    )
  }

  const run =
    state.run

  if (!run) {
    return (
      <ErrorState
        title="Run not found."
        message="The requested test run could not be loaded."
        onRetry={() =>
          load(true)
        }
      />
    )
  }

  /*
   * REAL BACKEND FIELDS
   *
   * runId
   * startedAt
   * completedAt
   * duration
   * totalTests
   * passed
   * failed
   * skipped
   * status
   * executionMode
   */

  const totalTests =
    Number(
      run.totalTests
    ) || 0

  const passed =
    Number(
      run.passed
    ) || 0

  const failed =
    Number(
      run.failed
    ) || 0

  const skipped =
    Number(
      run.skipped
    ) || 0

  const passRate =
    totalTests > 0
      ? Number(
          (
            (
              passed /
              totalTests
            ) *
            100
          ).toFixed(2)
        )
      : 0

  const failures =
    extractFailures(run)

  const isRunning =
    String(
      run.status
    ).toUpperCase() ===
    'RUNNING'

  return (
    <div className="space-y-6">

      {/* ====================================================== */}
      {/* BACK */}
      {/* ====================================================== */}

      <Link
        to="/runs"
        className="inline-flex items-center gap-1 text-sm text-secondary hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />

        Back to test runs
      </Link>

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">

        <div>

          <div className="flex items-center gap-3">

            <h1 className="text-xl font-bold text-primary">
              Run #
              {run.runId ||
                id}
            </h1>

            {isRunning && (
              <RefreshCw
                className={`h-4 w-4 text-info ${
                  refreshing
                    ? 'animate-spin'
                    : ''
                }`}
              />
            )}

          </div>

          <p className="mt-1 text-sm text-secondary">
            Environment:{' '}
            {run.environment ||
              'N/A'}
          </p>

          <p className="mt-1 text-sm text-secondary">
            Started:{' '}
            {formatDate(
              run.startedAt
            )}
          </p>

          {run.completedAt && (
            <p className="mt-1 text-sm text-secondary">
              Completed:{' '}
              {formatDate(
                run.completedAt
              )}
            </p>
          )}

          {isRunning && (
            <p className="mt-2 text-xs text-info">
              Test execution is in progress.
              This page updates automatically.
            </p>
          )}

        </div>

        <StatusBadge
          status={
            run.status ||
            'UNKNOWN'
          }
        />

      </div>

      {/* ====================================================== */}
      {/* STATS */}
      {/* ====================================================== */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

        <StatCard
          label="Total"
          value={totalTests}
        />

        <StatCard
          label="Passed"
          value={passed}
          accent="success"
        />

        <StatCard
          label="Failed"
          value={failed}
          accent="failure"
        />

        <StatCard
          label="Skipped"
          value={skipped}
          accent="warning"
        />

        <StatCard
          label="Pass Rate"
          value={passRate}
          suffix="%"
          accent="info"
        />

      </div>

      {/* ====================================================== */}
      {/* EXECUTION INFORMATION */}
      {/* ====================================================== */}

      <section className="rounded-lg border border-border bg-card p-5">

        <h2 className="mb-4 text-sm font-semibold text-primary">
          Execution Information
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div>
            <p className="text-xs text-secondary">
              Environment
            </p>

            <p className="mt-1 text-sm font-medium text-primary">
              {run.environment ||
                'N/A'}
            </p>
          </div>

          <div>
            <p className="text-xs text-secondary">
              Execution Mode
            </p>

            <p className="mt-1 text-sm font-medium text-primary">
              {run.executionMode ||
                'N/A'}
            </p>
          </div>

          <div>
            <p className="text-xs text-secondary">
              Duration
            </p>

            <p className="mt-1 text-sm font-medium text-primary">
              {isRunning
                ? 'Running...'
                : formatDuration(
                    run.duration
                  )}
            </p>
          </div>

          <div>
            <p className="text-xs text-secondary">
              Run ID
            </p>

            <p className="mt-1 break-all text-sm font-medium text-primary">
              {run.runId ||
                'N/A'}
            </p>
          </div>

        </div>

      </section>

      {/* ====================================================== */}
      {/* FAILED TESTS */}
      {/* ====================================================== */}

      <section className="space-y-3">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-sm font-semibold text-primary">
              Failed Tests
            </h2>

            {!isRunning && (
              <p className="mt-1 text-xs text-secondary">
                {failures.length}{' '}
                failure
                {failures.length === 1
                  ? ''
                  : 's'} returned
              </p>
            )}

          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                '/failures'
              )
            }
            className="text-xs font-medium text-info hover:underline"
          >
            View all failures
          </button>

        </div>

        {/* RUNNING */}

        {isRunning ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">

            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-info" />

            <p className="mt-3 text-sm text-secondary">
              Playwright tests are still running...
            </p>

            <p className="mt-1 text-xs text-secondary">
              Results will appear automatically when execution finishes.
            </p>

          </div>
        ) : failures.length > 0 ? (

          /* FAILURES */

          <FailureTable
            failures={
              failures
            }
          />

        ) : failed > 0 ? (

          /* FAILURES EXIST BUT WERE NOT RETURNED */

          <div className="rounded-lg border border-border bg-card p-8 text-center">

            <p className="text-sm font-medium text-primary">
              {failed} test
              {failed === 1
                ? ''
                : 's'} failed,
              but failure details
              were not returned
              with this run.
            </p>

            <p className="mt-2 text-xs text-secondary">
              The test execution completed,
              but the failure records are not
              available in the run response.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  '/failures'
                )
              }
              className="mt-4 rounded-md border border-border px-4 py-2 text-xs font-medium text-primary transition-colors hover:border-info hover:text-info"
            >
              Open Failures
            </button>

          </div>

        ) : (

          /* NO FAILURES */

          <div className="rounded-lg border border-border bg-card p-8 text-center">

            <p className="text-sm text-secondary">
              No test failures found.
            </p>

          </div>

        )}

      </section>

      {/* ====================================================== */}
      {/* FULL REPORT */}
      {/* ====================================================== */}

      <button
        type="button"
        onClick={() =>
          navigate(
            `/reports/${encodeURIComponent(
              run.runId || id
            )}`
          )
        }
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-info hover:text-info"
      >
        View Full Report
      </button>

    </div>
  )
}