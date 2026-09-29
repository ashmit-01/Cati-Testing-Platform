import { useNavigate } from 'react-router-dom'
import SeverityBadge from './SeverityBadge.jsx'
import StatusBadge from './StatusBadge.jsx'
import EmptyState from './EmptyState.jsx'

export default function FailureTable({ failures, showSuite = true }) {
  const navigate = useNavigate()

  if (!failures || failures.length === 0) {
    return <EmptyState message="No test failures found." />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card scrollbar-thin">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
            <th className="px-4 py-3 font-medium">Test</th>
            {showSuite && <th className="px-4 py-3 font-medium">Suite</th>}
            <th className="px-4 py-3 font-medium">Severity</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((f) => (
            <tr
              key={f.id}
              onClick={() => navigate(`/failures/${f.id}`)}
              className="cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3 font-medium text-primary">{f.test}</td>
              {showSuite && <td className="px-4 py-3 text-secondary">{f.suite}</td>}
              <td className="px-4 py-3">
                <SeverityBadge severity={f.severity} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={f.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
