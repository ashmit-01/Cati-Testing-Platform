
import { useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import EnvironmentBadge from './EnvironmentBadge.jsx'

export default function Header({ onMenuClick }) {
  const navigate = useNavigate()

  function handleLogout() {
    // Clear locally stored authentication/session data.
    localStorage.clear()
    sessionStorage.clear()

    // Return to the admin login screen.
    navigate('/auth/login', { replace: true })
  }

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
          <h1 className="text-base font-bold text-primary sm:text-lg">
            CATI QA Dashboard
          </h1>
          <p className="text-xs text-secondary">
            Testing &amp; Monitoring Platform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <EnvironmentBadge
          environment="PRODUCTION"
          className="hidden sm:inline-flex"
        />

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-secondary transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  )
}
