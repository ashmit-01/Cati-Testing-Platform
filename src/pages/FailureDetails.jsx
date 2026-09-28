import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Camera, FileText, Terminal, Code2, Download, Eye } from 'lucide-react'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SeverityBadge from '../components/SeverityBadge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { getFailure } from '../services/api.js'

const EVIDENCE_META = [
  { key: 'screenshot', label: 'Screenshot', icon: Camera, action: 'View' },
  { key: 'trace', label: 'Trace', icon: FileText, action: 'View' },
  { key: 'consoleLogs', label: 'Console Logs', icon: Terminal, action: 'View' },
  { key: 'response', label: 'Response', icon: Code2, action: 'Download' }
]

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-secondary">{label}</p>
      <div className="mt-1 text-sm text-primary">{children}</div>
    </div>
  )
}

export default function FailureDetails() {
  const { id } = useParams()
  const [state, setState] = useState({ status: 'loading', failure: null, error: null })

  const load = useCallback(async () => {
    setState({ status: 'loading', failure: null, error: null })
    try {
      const failure = await getFailure(id)
      setState({ status: 'success', failure, error: null })
    } catch (error) {
      setState({ status: 'error', failure: null, error: error.message })
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (state.status === 'loading') {
    return <LoadingState label="Loading failure details..." />
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="Failed to load this failure."
        message={state.error || 'Please check the QA backend connection.'}
        onRetry={load}
      />
    )
  }

  const f = state.failure
  const hasAnyEvidence = EVIDENCE_META.some((e) => f.evidence?.[e.key])

  return (
    <div className="space-y-6">
      <Link to="/failures" className="inline-flex items-center gap-1 text-sm text-secondary hover:text-primary">
        <ChevronLeft className="h-4 w-4" />
        Back to failures
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <h1 className="text-xl font-bold text-primary">{f.test}</h1>
        <div className="flex gap-2">
          <StatusBadge status={f.status} />
          <SeverityBadge severity={f.severity} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Test">{f.test}</Field>
        <Field label="Status">{f.status}</Field>
        <Field label="Severity">{f.severity}</Field>
        <Field label="Suite">{f.suite}</Field>
        <Field label="Environment">{f.environment}</Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Expected</p>
          <p className="mt-2 text-sm text-primary">{f.expected}</p>
        </div>
        <div className="rounded-lg border border-failure/30 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Actual</p>
          <p className="mt-2 text-sm text-failure">{f.actual}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-secondary">Endpoint</p>
        <p className="mt-2 font-mono text-sm text-primary">{f.endpoint}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-primary">Evidence</h2>
        {hasAnyEvidence ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {EVIDENCE_META.filter((e) => f.evidence?.[e.key]).map(({ key, label, icon: Icon, action }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-secondary" />
                  <span className="text-sm text-primary">{label}</span>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-info hover:text-info">
                  {action === 'View' ? <Eye className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  {action}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No evidence available." />
        )}
      </section>
    </div>
  )
}
