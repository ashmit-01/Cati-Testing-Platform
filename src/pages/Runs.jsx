import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import RunTestsButton from '../components/RunTestsButton.jsx'
import { getTestRuns } from '../services/api.js'

export default function Runs() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', runs: [], error: null })

  const load = useCallback(async () => {
    setState({ status: 'loading', runs: [], error: null })
    try {
      const runs = await getTestRuns()
      setState({ status: 'success', runs, error: null })
    } catch (error) {
      setState({ status: 'error', runs: [], error: error.message })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold text-primary">Test Runs</h1>
          <p className="text-sm text-secondary">History of all test executions.</p>
        </div>
        <RunTestsButton />
      </div>

      {state.status === 'loading' && <LoadingState label="Loading test runs..." />}

      {state.status === 'error' && (
        <ErrorState
          title="Failed to load test runs."
          message={state.error || 'Please check the QA backend connection.'}
          onRetry={load}
        />
      )}

      {state.status === 'success' && state.runs.length === 0 && (
        <EmptyState message="No test runs available." />
      )}

      {state.status === 'success' && state.runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card scrollbar-thin">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
                <th className="px-4 py-3 font-medium">Run</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Passed</th>
                <th className="px-4 py-3 font-medium">Failed</th>
                <th className="px-4 py-3 font-medium">Skipped</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => navigate(`/runs/${run.id}`)}
                  className="cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium text-info">#{run.id}</td>
                  <td className="px-4 py-3 text-secondary">
                    {new Date(run.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-secondary">{run.duration}</td>
                  <td className="px-4 py-3 text-primary">{run.total}</td>
                  <td className="px-4 py-3 text-success">{run.passed}</td>
                  <td className="px-4 py-3 text-failure">{run.failed}</td>
                  <td className="px-4 py-3 text-warning">{run.skipped}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
