import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import RunTestsButton from '../components/RunTestsButton.jsx'

import { getTestRuns } from '../services/api.js'


// ============================================================
// HELPERS
// ============================================================

function formatDate(date) {
  if (!date) {
    return '—'
  }

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return '—'
  }

  return parsedDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}


function formatDuration(duration) {
  const milliseconds = Number(duration)

  if (
    !Number.isFinite(milliseconds) ||
    milliseconds <= 0
  ) {
    return '0s'
  }

  const totalSeconds =
    Math.floor(milliseconds / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes =
    Math.floor(totalSeconds / 60)

  const seconds =
    totalSeconds % 60

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`
  }

  const hours =
    Math.floor(minutes / 60)

  const remainingMinutes =
    minutes % 60

  return `${hours}h ${remainingMinutes}m`
}


// ============================================================
// NORMALIZE BACKEND RUN
// ============================================================

function normalizeRun(run) {
  if (!run) {
    return null
  }

  /*
   * REAL BACKEND ID
   *
   * Example:
   *
   * RUN-20260928-011
   */
  const runId =
    run.runId ||
    run.id ||
    run._id ||
    null

  return {
    ...run,

    /*
     * Keep both fields so older components don't break.
     */
    id: runId,

    runId,

    /*
     * REAL BACKEND DATE
     */
    date:
      run.startedAt ||
      run.date ||
      run.createdAt ||
      null,

    /*
     * REAL BACKEND STATISTICS
     */
    totalTests:
      Number(
        run.totalTests ??
        run.total ??
        0
      ),

    passed:
      Number(
        run.passed ??
        run.passedTests ??
        0
      ),

    failed:
      Number(
        run.failed ??
        run.failedTests ??
        0
      ),

    skipped:
      Number(
        run.skipped ??
        run.skippedTests ??
        0
      ),

    duration:
      Number(
        run.duration
      ) || 0,

    status:
      run.status ||
      'UNKNOWN',

    environment:
      run.environment ||
      'N/A'
  }
}


// ============================================================
// COMPONENT
// ============================================================

export default function Runs() {

  const navigate = useNavigate()

  const [state, setState] =
    useState({
      status: 'loading',
      runs: [],
      error: null
    })

  const [refreshing, setRefreshing] =
    useState(false)


  // ==========================================================
  // LOAD RUNS
  // ==========================================================

  const load = useCallback(
    async (showLoading = true) => {

      try {

        if (showLoading) {
          setState((previous) => ({
            ...previous,

            status:
              previous.runs.length > 0
                ? 'success'
                : 'loading',

            error: null
          }))
        }

        setRefreshing(true)

        const response =
          await getTestRuns()

        /*
         * getTestRuns() currently returns the
         * array directly.
         *
         * These fallbacks also support:
         *
         * {
         *   runs: [...]
         * }
         */

        const rawRuns =
          Array.isArray(response)
            ? response
            : Array.isArray(
                response?.runs
              )
              ? response.runs
              : []

        const normalizedRuns =
          rawRuns
            .map(normalizeRun)
            .filter(Boolean)

        setState({
          status: 'success',
          runs: normalizedRuns,
          error: null
        })

      } catch (error) {

        console.error(
          'Test runs loading error:',
          error
        )

        setState((previous) => ({
          status:
            previous.runs.length > 0
              ? 'success'
              : 'error',

          runs:
            previous.runs,

          error:
            error?.message ||
            'Unable to load test runs.'
        }))

      } finally {

        setRefreshing(false)

      }
    },
    []
  )


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    load(true)
  }, [load])


  // ==========================================================
  // AUTO REFRESH WHILE A RUN IS ACTIVE
  // ==========================================================

  useEffect(() => {

    const hasRunningRun =
      state.runs.some(
        (run) =>
          String(
            run.status
          ).toUpperCase() ===
          'RUNNING'
      )

    if (!hasRunningRun) {
      return undefined
    }

    const interval =
      setInterval(() => {
        load(false)
      }, 3000)

    return () => {
      clearInterval(interval)
    }

  }, [
    state.runs,
    load
  ])


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    state.status === 'loading' &&
    state.runs.length === 0
  ) {
    return (
      <LoadingState
        label="Loading test runs..."
      />
    )
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    state.status === 'error' &&
    state.runs.length === 0
  ) {
    return (
      <ErrorState
        title="Failed to load test runs."
        message={
          state.error ||
          'Please check the QA backend connection.'
        }
        onRetry={() => load(true)}
      />
    )
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="space-y-6">


      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

        <div>

          <h1 className="text-lg font-bold text-primary">
            Test Runs
          </h1>

          <p className="text-sm text-secondary">
            History of all test executions.
          </p>

        </div>


        <div className="flex items-center gap-3">

          {/* REFRESH BUTTON */}

          <button
            type="button"
            onClick={() =>
              load(true)
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-info hover:text-info disabled:cursor-not-allowed disabled:opacity-50"
          >

            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? 'animate-spin'
                  : ''
              }`}
            />

            Refresh

          </button>


          {/* RUN TESTS */}

          <RunTestsButton />

        </div>

      </div>


      {/* ==================================================== */}
      {/* BACKEND ERROR WHILE OLD DATA EXISTS */}
      {/* ==================================================== */}

      {state.error && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          {state.error}
        </div>
      )}


      {/* ==================================================== */}
      {/* EMPTY */}
      {/* ==================================================== */}

      {state.status === 'success' &&
        state.runs.length === 0 && (
          <EmptyState
            message="No test runs available."
          />
        )}


      {/* ==================================================== */}
      {/* RUN TABLE */}
      {/* ==================================================== */}

      {state.runs.length > 0 && (

        <div className="overflow-x-auto rounded-lg border border-border bg-card scrollbar-thin">

          <table className="w-full min-w-[900px] text-left text-sm">


            {/* ============================================== */}
            {/* TABLE HEADER */}
            {/* ============================================== */}

            <thead>

              <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">

                <th className="px-4 py-3 font-medium">
                  Run
                </th>

                <th className="px-4 py-3 font-medium">
                  Date
                </th>

                <th className="px-4 py-3 font-medium">
                  Duration
                </th>

                <th className="px-4 py-3 font-medium">
                  Total
                </th>

                <th className="px-4 py-3 font-medium">
                  Passed
                </th>

                <th className="px-4 py-3 font-medium">
                  Failed
                </th>

                <th className="px-4 py-3 font-medium">
                  Skipped
                </th>

                <th className="px-4 py-3 font-medium">
                  Status
                </th>

              </tr>

            </thead>


            {/* ============================================== */}
            {/* TABLE BODY */}
            {/* ============================================== */}

            <tbody>

              {state.runs.map(
                (run, index) => {

                  const runId =
                    run.runId ||
                    run.id

                  const isRunning =
                    String(
                      run.status
                    ).toUpperCase() ===
                    'RUNNING'


                  return (

                    <tr
                      key={
                        runId ||
                        `run-${index}`
                      }

                      onClick={() => {

                        /*
                         * IMPORTANT:
                         *
                         * Never navigate to:
                         *
                         * /runs/undefined
                         */

                        if (!runId) {
                          console.error(
                            'Cannot open test run: missing runId',
                            run
                          )

                          return
                        }

                        navigate(
                          `/runs/${encodeURIComponent(
                            runId
                          )}`
                        )
                      }}

                      className={`cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-white/[0.03] ${
                        isRunning
                          ? 'bg-info/[0.02]'
                          : ''
                      }`}
                    >


                      {/* ================================== */}
                      {/* RUN ID */}
                      {/* ================================== */}

                      <td className="px-4 py-3 font-medium text-info">

                        {runId ? (
                          <button
                            type="button"

                            onClick={(event) => {

                              /*
                               * Prevent the row click from
                               * firing twice.
                               */
                              event.stopPropagation()

                              navigate(
                                `/runs/${encodeURIComponent(
                                  runId
                                )}`
                              )
                            }}

                            className="hover:underline"
                          >
                            #{runId}
                          </button>
                        ) : (
                          <span className="text-secondary">
                            —
                          </span>
                        )}

                      </td>


                      {/* ================================== */}
                      {/* DATE */}
                      {/* ================================== */}

                      <td className="px-4 py-3 text-secondary">

                        {formatDate(
                          run.startedAt ||
                          run.date
                        )}

                      </td>


                      {/* ================================== */}
                      {/* DURATION */}
                      {/* ================================== */}

                      <td className="px-4 py-3 text-secondary">

                        {isRunning
                          ? (
                            <span className="text-info">
                              Running...
                            </span>
                          )
                          : formatDuration(
                              run.duration
                            )}

                      </td>


                      {/* ================================== */}
                      {/* TOTAL */}
                      {/* ================================== */}

                      <td className="px-4 py-3 text-primary">
                        {run.totalTests}
                      </td>


                      {/* ================================== */}
                      {/* PASSED */}
                      {/* ================================== */}

                      <td className="px-4 py-3 text-success">
                        {run.passed}
                      </td>


                      {/* ================================== */}
                      {/* FAILED */}
                      {/* ================================== */}

                      <td className="px-4 py-3 text-failure">
                        {run.failed}
                      </td>


                      {/* ================================== */}
                      {/* SKIPPED */}
                      {/* ================================== */}

                      <td className="px-4 py-3 text-warning">
                        {run.skipped}
                      </td>


                      {/* ================================== */}
                      {/* STATUS */}
                      {/* ================================== */}

                      <td className="px-4 py-3">

                        <StatusBadge
                          status={
                            run.status ||
                            'UNKNOWN'
                          }
                        />

                      </td>

                    </tr>

                  )
                }
              )}

            </tbody>

          </table>

        </div>

      )}

    </div>
  )
}