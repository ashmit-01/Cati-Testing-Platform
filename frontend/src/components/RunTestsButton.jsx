
import { useState } from 'react'
import {
  Play,
  Loader2,
  GitBranch,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import { api } from '../services/api.js'

const TEST_SUITES = [
  { label: 'All Tests', value: 'all' },
  { label: 'UI Tests', value: 'ui' },
  { label: 'API Tests', value: 'api' },
  { label: 'E2E Tests', value: 'e2e' },
  { label: 'WebSocket Tests', value: 'websocket' },
  { label: 'AI / Voice Tests', value: 'ai-voice' }
]

export default function RunTestsButton({ className = '' }) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [runUrl, setRunUrl] = useState('')
  const [testSuite, setTestSuite] = useState('all')

  async function handleRunTests() {
    if (status === 'starting') return

    setStatus('starting')
    setMessage('')
    setRunUrl('')

    try {
      const { data } = await api.post('/api/ci/trigger', {
        testSuite
      })

      setStatus('success')
      setMessage(
        data.message || 'GitHub Actions workflow triggered successfully.'
      )

      if (data.workflowUrl) {
    setRunUrl(data.workflowUrl)
}
    } catch (error) {
      console.error('GitHub Actions trigger failed:', error)

      setStatus('error')
      setMessage(
        error.response?.data?.message ||
        error.message ||
        'Unable to trigger GitHub Actions.'
      )
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">

        {/* Test Suite Selection */}
        <div className="relative">
          <select
            value={testSuite}
            onChange={(e) => setTestSuite(e.target.value)}
            disabled={status === 'starting'}
            className="appearance-none rounded-md border border-border bg-card px-4 py-2.5 pr-10 text-sm font-medium text-foreground outline-none focus:border-info disabled:opacity-60"
          >
            {TEST_SUITES.map((suite) => (
              <option key={suite.value} value={suite.value}>
                {suite.label}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Run Tests Button */}
        <button
          type="button"
          onClick={handleRunTests}
          disabled={status === 'starting'}
          className="inline-flex items-center gap-2 rounded-md bg-info px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'starting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Triggering GitHub Actions...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run GitHub Tests
              <GitBranch className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Execution Status */}
      {message && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            status === 'error'
              ? 'border-failure/30 bg-failure/10 text-failure'
              : 'border-success/30 bg-success/10 text-success'
          }`}
        >
          {message}

          {runUrl && (
            <a
              href={runUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 font-medium underline"
            >
              View GitHub Run
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
