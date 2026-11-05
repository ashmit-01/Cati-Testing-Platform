
import { useState } from 'react'
import { Play, Loader2, GitBranch, ExternalLink } from 'lucide-react'
import { api } from '../services/api.js'

export default function RunTestsButton({ className = '' }) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [runUrl, setRunUrl] = useState('')

  async function handleRunTests() {
    if (status === 'starting') return

    setStatus('starting')
    setMessage('')
    setRunUrl('')

    try {
      const { data } = await api.post('/api/ci/trigger')

      setStatus('success')
      setMessage(
        data.message || 'GitHub Actions workflow triggered successfully.'
      )

      if (data.runUrl) {
        setRunUrl(data.runUrl)
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
