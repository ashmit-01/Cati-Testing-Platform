import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Loader2 } from 'lucide-react'
import { startTestRun } from '../services/api.js'

// Renders the primary "RUN TESTS" action.
//
// This component only ever calls startTestRun(), which posts to
// POST /api/test-runs on the FastAPI backend. It never touches Playwright,
// Selenium, pytest, or any test runner directly - the backend's Test Run
// Controller / Test Orchestrator own that.
export default function RunTestsButton({ suites = 'all', className = '' }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | starting | error
  const [message, setMessage] = useState('')

  async function handleClick() {
    if (status === 'starting') return // prevent duplicate requests
    setStatus('starting')
    setMessage('')
    try {
      const run = await startTestRun({ suites })
      setStatus('idle')
      navigate(`/runs/${run.id}`)
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Failed to start test run. Please check the QA backend connection.')
    }
  }

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={status === 'starting'}
        className="inline-flex items-center gap-2 rounded-md bg-info px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'starting' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Run Tests
          </>
        )}
      </button>

      {status === 'error' && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure">
          <span>{message}</span>
          <button onClick={handleClick} className="font-semibold underline underline-offset-2 hover:text-failure/80">
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
