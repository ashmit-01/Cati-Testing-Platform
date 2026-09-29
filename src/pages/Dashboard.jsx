import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/StatCard.jsx'
import SuiteTable from '../components/SuiteTable.jsx'
import FailureTable from '../components/FailureTable.jsx'
import RunTestsButton from '../components/RunTestsButton.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getDashboard, getFailures } from '../services/api.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [failures, setFailures] = useState([])

  const load = useCallback(async () => {
    setState({ status: 'loading', data: null, error: null })
    try {
      const [dashboard, recentFailures] = await Promise.all([getDashboard(), getFailures()])
      setState({ status: 'success', data: dashboard, error: null })
      setFailures(recentFailures.slice(0, 4))
    } catch (error) {
      setState({ status: 'error', data: null, error: error.message })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state.status === 'loading') {
    return <LoadingState label="Loading dashboard..." />
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="Unable to load dashboard data."
        message={state.error || 'Please check the QA backend connection.'}
        onRetry={load}
      />
    )
  }

  const d = state.data

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-secondary">
            Last run{' '}
            <button
              onClick={() => navigate(`/runs/${d.lastRun.id}`)}
              className="font-medium text-info hover:underline"
            >
              #{d.lastRun.id}
            </button>{' '}
            &middot; {new Date(d.lastRun.date).toLocaleString()}
          </p>
        </div>
        <RunTestsButton />
      </div>

      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total Tests" value={d.totalTests} />
          <StatCard label="Passed" value={d.passed} accent="success" />
          <StatCard label="Failed" value={d.failed} accent="failure" />
          <StatCard label="Skipped" value={d.skipped} accent="warning" />
          <StatCard label="Pass Rate" value={d.passRate} suffix="%" accent="info" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Test Suites</h2>
        <SuiteTable suites={d.suites} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Recent Failures</h2>
          <button onClick={() => navigate('/failures')} className="text-xs font-medium text-info hover:underline">
            View all
          </button>
        </div>
        <FailureTable failures={failures} />
      </section>
    </div>
  )
}
