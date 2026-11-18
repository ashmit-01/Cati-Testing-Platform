import { useState } from 'react'
import { Play, X } from 'lucide-react'

const RECENT_KEY = 'cati.recentTargets'

function readRecent() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function remember(url) {
  if (!url) return
  try {
    const next = [url, ...readRecent().filter((item) => item !== url)].slice(0, 8)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/**
 * Asks where to run the selected cases: an environment label and an optional
 * base URL (a branch deployment, staging, or a local backend). A blank URL
 * uses the platform default (CATI_API_URL / BACKEND_URL).
 */
export default function RunTargetDialog({ count, title, onRun, onCancel, busy }) {
  const [environment, setEnvironment] = useState('staging')
  const [targetUrl, setTargetUrl] = useState(() => readRecent()[0] || '')
  const recent = readRecent()

  function submit(event) {
    event.preventDefault()
    const url = targetUrl.trim()
    remember(url)
    onRun({ environment: environment.trim() || 'staging', targetUrl: url || undefined })
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="run-target-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="run-target-title" className="text-lg font-semibold text-primary">{title || `Run ${count} case${count === 1 ? '' : 's'}`}</h2>
            <p className="mt-1 text-sm text-secondary">Point API cases at any deployment or your local backend.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onCancel}><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-6 space-y-4">
          <label className="field-label">Target base URL <span className="font-normal text-secondary">(optional)</span>
            <input className="field" type="url" list="cati-recent-targets" placeholder="http://localhost:5000 or https://pr-42.example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
            <datalist id="cati-recent-targets">{recent.map((url) => <option key={url} value={url} />)}</datalist>
            <span className="field-help">Blank uses the platform default. The test login credentials are sent to this URL.</span>
          </label>
          <label className="field-label">Environment label
            <input className="field" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="staging, local, feature/x" />
            <span className="field-help">Shown on the run so results from different targets are easy to tell apart.</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy}><Play className="h-4 w-4" /> Run</button>
        </div>
      </form>
    </div>
  )
}
