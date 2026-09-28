import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  FileBarChart,
  AlertTriangle
} from 'lucide-react'

import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import SeverityBadge from '../components/SeverityBadge.jsx'
import { getReports } from '../services/api.js'

export default function Reports() {
  const navigate = useNavigate()

  const [state, setState] = useState({
    status: 'loading',
    reports: [],
    error: null
  })

  const load = useCallback(async () => {
    setState({
      status: 'loading',
      reports: [],
      error: null
    })

    try {
      const reports = await getReports()

      setState({
        status: 'success',
        reports,
        error: null
      })
    } catch (error) {
      setState({
        status: 'error',
        reports: [],
        error: error.message
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state.status === 'loading') {
    return <LoadingState label="Loading reports..." />
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="Failed to load reports."
        message={
          state.error ||
          'Please check the QA backend connection.'
        }
        onRetry={load}
      />
    )
  }

  if (state.reports.length === 0) {
    return <EmptyState message="No reports available." />
  }

  const report = state.reports[0]

  const passRate =
    report.passRate ??
    (
      report.total > 0
        ? ((report.passed / report.total) * 100).toFixed(1)
        : 0
    )

  function formatDate(date) {
    if (!date) return 'N/A'

    return new Date(date).toLocaleString()
  }

  function formatDuration(ms) {
    if (!ms && ms !== 0) return 'N/A'

    if (ms < 1000) {
      return `${ms} ms`
    }

    const seconds = Math.floor(ms / 1000)

    if (seconds < 60) {
      return `${seconds}s`
    }

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-lg font-bold text-primary">
            Test Report
          </h1>

          <p className="mt-1 text-sm text-secondary">
            Run #{report.runId}
          </p>
        </div>

        <div className="flex gap-3">

          <button
            onClick={() => navigate(`/runs/${report.runId}`)}
            className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90"
          >
            <FileBarChart className="h-4 w-4" />
            View Run
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-primary hover:border-info hover:text-info"
          >
            <Download className="h-4 w-4" />
            Print / Save
          </button>

        </div>
      </div>

      {/* Run information */}
      <div className="rounded-lg border border-border bg-card p-5">

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div>
            <p className="text-xs uppercase text-secondary">
              Environment
            </p>

            <p className="mt-1 text-sm font-semibold text-primary">
              {report.environment || 'N/A'}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-secondary">
              Status
            </p>

            <div className="mt-1">
              <StatusBadge status={report.status} />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-secondary">
              Started
            </p>

            <p className="mt-1 text-sm text-primary">
              {formatDate(report.startedAt)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-secondary">
              Duration
            </p>

            <p className="mt-1 text-sm text-primary">
              {formatDuration(report.duration)}
            </p>
          </div>

        </div>

      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

        <StatCard
          label="Total"
          value={report.totalTests}
        />

        <StatCard
          label="Passed"
          value={report.passed}
          accent="success"
        />

        <StatCard
          label="Failed"
          value={report.failed}
          accent="failure"
        />

        <StatCard
          label="Skipped"
          value={report.skipped}
          accent="warning"
        />

        <StatCard
          label="Pass Rate"
          value={passRate}
          suffix="%"
          accent="info"
        />

      </div>

      {/* Failed tests */}
      <section className="space-y-3">

        <div className="flex items-center gap-2">

          <AlertTriangle className="h-4 w-4 text-failure" />

          <h2 className="text-sm font-semibold text-primary">
            Failed Tests
          </h2>

          <span className="text-xs text-secondary">
            ({report.failures?.length || 0})
          </span>

        </div>

        {!report.failures ||
        report.failures.length === 0 ? (

          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-secondary">
              No failed tests in this run.
            </p>
          </div>

        ) : (

          <div className="overflow-x-auto rounded-lg border border-border bg-card">

            <table className="w-full min-w-[700px] text-left text-sm">

              <thead>

                <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">

                  <th className="px-4 py-3 font-medium">
                    Test
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Category
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Severity
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody>

                {report.failures.map((failure, index) => (

                  <tr
                    key={`${failure.title}-${index}`}
                    className="border-b border-border/60 last:border-0"
                  >

                    <td className="px-4 py-3 font-medium text-primary">
                      {failure.title || 'Unnamed test'}
                    </td>

                    <td className="px-4 py-3 text-secondary">
                      {failure.category || 'OTHER'}
                    </td>

                    <td className="px-4 py-3">
                      <SeverityBadge
                        severity={failure.severity}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge
                        status={failure.status}
                      />
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* Completion */}
      <div className="rounded-lg border border-border bg-card p-5">

        <h2 className="text-sm font-semibold text-primary">
          Run Timeline
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">

          <div>
            <p className="text-xs uppercase text-secondary">
              Started
            </p>

            <p className="mt-1 text-sm text-primary">
              {formatDate(report.startedAt)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-secondary">
              Completed
            </p>

            <p className="mt-1 text-sm text-primary">
              {formatDate(report.completedAt)}
            </p>
          </div>

        </div>

      </div>

    </div>
  )
}