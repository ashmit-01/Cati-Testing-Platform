import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ListChecks, AlertTriangle, FileBarChart, X, TerminalSquare } from 'lucide-react'
import EnvironmentBadge from './EnvironmentBadge.jsx'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/runs', label: 'Test Runs', icon: ListChecks },
  { to: '/failures', label: 'Failures', icon: AlertTriangle },
  { to: '/reports', label: 'Reports', icon: FileBarChart }
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-info/15 text-info">
              <TerminalSquare className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide text-primary">CATI QA</p>
              <p className="text-[11px] text-secondary">Test Platform</p>
            </div>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-info/10 text-info'
                    : 'text-secondary hover:bg-white/[0.04] hover:text-primary'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-secondary">Environment</p>
          <EnvironmentBadge environment="PRODUCTION" />
        </div>
      </aside>
    </>
  )
}
