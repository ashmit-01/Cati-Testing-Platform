import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import SuiteTable from '../components/SuiteTable.jsx'
import { getTestRun } from '../services/api.js'

export default function RunDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', run: null, error: null })

  const load = useCallback(async () => {
    setState({ status: 'loading', run: null, error: null })
    try {
      const run = await getTestRun(id)
      setState({ status: 'success', run, error: null })
    } catch (error) {
      setState({ status: 'error', run: null, error: error.message })
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (state.status === 'loading') {
    return <LoadingState label="Loading run details..." />
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="Failed to load this test run."
        message={state.error || 'Please check the QA backend connection.'}
        onRetry={load}
      />
    )
  }

  const run = state.run

  return (
    <div className="space-y-6">
      <Link to="/runs" className="inline-flex items-center gap-1 text-sm text-secondary hover:text-primary">
        <ChevronLeft className="h-4 w-4" />
        Back to test runs
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Run #{run.id}</h1>
          <p className="mt-1 text-sm text-secondary">
            Started {new Date(run.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; Duration {run.duration}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={run.total} />
        <StatCard label="Passed" value={run.passed} accent="success" />
        <StatCard label="Failed" value={run.failed} accent="failure" />
        <StatCard label="Skipped" value={run.skipped} accent="warning" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Suite Breakdown</h2>
        <SuiteTable suites={run.suites} />
      </section>

      <button
        onClick={() => navigate('/reports')}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-info hover:text-info"
      >
        View Report
      </button>
    </div>
  )
}
