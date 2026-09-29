import { Menu } from 'lucide-react'
import EnvironmentBadge from './EnvironmentBadge.jsx'

export default function Header({ onMenuClick }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-bg/80 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md border border-border p-2 text-secondary hover:text-primary lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-primary sm:text-lg">CATI QA Dashboard</h1>
          <p className="text-xs text-secondary">Testing &amp; Monitoring Platform</p>
        </div>
      </div>
      <EnvironmentBadge environment="STAGING" className="hidden sm:inline-flex" />
    </header>
  )
}
