import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import FailureTable from '../components/FailureTable.jsx'
import { getFailures } from '../services/api.js'

const SUITES = ['all', 'API', 'UI', 'E2E', 'WebSocket', 'AI/Voice']
const SEVERITIES = ['all', 'Critical', 'High', 'Medium', 'Low']
const STATUSES = ['all', 'Failed']

function Select({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-md border border-border bg-card px-3 py-2 text-sm text-primary outline-none focus:border-info"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === 'all' ? `All ${label}` : opt}
        </option>
      ))}
    </select>
  )
}

export default function Failures() {
  const [search, setSearch] = useState('')
  const [suite, setSuite] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [state, setState] = useState({ status: 'loading', failures: [], error: null })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      const failures = await getFailures({ search, suite, severity, status })
      setState({ status: 'success', failures, error: null })
    } catch (error) {
      setState({ status: 'error', failures: [], error: error.message })
    }
  }, [search, suite, severity, status])

  useEffect(() => {
    const timeout = setTimeout(load, 250) // light debounce for search
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-primary">Failures</h1>
        <p className="text-sm text-secondary">Investigate and triage failing tests.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search failures..."
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-primary outline-none placeholder:text-secondary focus:border-info"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={suite} onChange={setSuite} options={SUITES} label="Suite" />
          <Select value={severity} onChange={setSeverity} options={SEVERITIES} label="Severity" />
          <Select value={status} onChange={setStatus} options={STATUSES} label="Status" />
        </div>
      </div>

      {state.status === 'loading' && <LoadingState label="Loading failures..." />}

      {state.status === 'error' && (
        <ErrorState
          title="Failed to load failures."
          message={state.error || 'Please check the QA backend connection.'}
          onRetry={load}
        />
      )}

      {state.status === 'success' && <FailureTable failures={state.failures} />}
    </div>
  )
}
