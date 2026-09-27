import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileBarChart } from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import StatCard from '../components/StatCard.jsx'
import { getReports } from '../services/api.js'

const DISTRIBUTION_COLORS = ['#22C55E', '#EF4444', '#F59E0B']

export default function Reports() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', reports: [], error: null })

  const load = useCallback(async () => {
    setState({ status: 'loading', reports: [], error: null })
    try {
      const reports = await getReports()
      setState({ status: 'success', reports, error: null })
    } catch (error) {
      setState({ status: 'error', reports: [], error: error.message })
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
        message={state.error || 'Please check the QA backend connection.'}
        onRetry={load}
      />
    )
  }

  if (state.reports.length === 0) {
    return <EmptyState message="No reports available." />
  }

  const report = state.reports[0]
  const distribution = [
    { name: 'Passed', value: report.passed },
    { name: 'Failed', value: report.failed },
    { name: 'Skipped', value: report.skipped }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-primary">Latest Report</h1>
        <p className="text-sm text-secondary">
          Run #{report.runId} &middot;{' '}
          {new Date(report.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total" value={report.total} />
        <StatCard label="Passed" value={report.passed} accent="success" />
        <StatCard label="Failed" value={report.failed} accent="failure" />
        <StatCard label="Skipped" value={report.skipped} accent="warning" />
        <StatCard label="Pass Rate" value={report.passRate} suffix="%" accent="info" />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/runs/${report.runId}`)}
          className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-info/90"
        >
          <FileBarChart className="h-4 w-4" />
          View Report
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-info hover:text-info"
        >
          <Download className="h-4 w-4" />
          Download Report
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-primary">Pass / Fail / Skipped Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {distribution.map((entry, index) => (
                    <Cell key={entry.name} fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-primary">Pass Rate Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="run" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} domain={[60, 100]} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="passRate" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-primary">Suite Performance</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={report.suites.map((s) => ({ name: s.name, passRate: Number(((s.passed / s.total) * 100).toFixed(1)) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="passRate" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
