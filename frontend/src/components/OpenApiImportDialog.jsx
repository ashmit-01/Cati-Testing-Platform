import { useEffect, useState } from 'react'
import { FileCode2, X } from 'lucide-react'
import { importOpenApi } from '../services/api.js'

const BUCKETS = [
  { key: 'create', label: 'New cases', help: 'Operations without a case yet.' },
  { key: 'update', label: 'Refreshed', help: 'Generated cases nobody edited; updated from the spec.' },
  { key: 'keptEdited', label: 'Kept (edited)', help: 'Cases you changed by hand, or manual cases with the same id. Left as they are.' },
  { key: 'removed', label: 'Deactivated', help: 'Operations no longer in the spec. Turned off, not deleted.' }
]

/**
 * Previews an OpenAPI import with a dry run, then applies it on confirm.
 * `spec` is the parsed JSON object or the raw YAML text.
 */
export default function OpenApiImportDialog({ spec, fileName, onDone, onCancel }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [bundleName, setBundleName] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let active = true
    importOpenApi(spec, { dryRun: true })
      .then((summary) => { if (active) { setPreview(summary); setBundleName(summary.bundle.name) } })
      .catch((previewError) => { if (active) setError(previewError.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [spec])

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      const summary = await importOpenApi(spec, { fileName, ...(preview.bundle.created && bundleName.trim() ? { bundleName: bundleName.trim() } : {}) })
      onDone(summary)
    } catch (importError) {
      setError(importError.message)
      setBusy(false)
    }
  }

  const nothingToDo = preview && preview.created + preview.updated + preview.removed === 0

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="openapi-import-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileCode2 className="mt-0.5 h-5 w-5 shrink-0 text-info" />
            <div>
              <h2 id="openapi-import-title" className="text-lg font-semibold text-primary">Import OpenAPI spec</h2>
              <p className="mt-1 text-sm text-secondary">{fileName}{preview && ` · ${preview.spec.title} ${preview.spec.version} (OpenAPI ${preview.spec.openapi})`}</p>
            </div>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onCancel}><X className="h-4 w-4" /></button>
        </div>

        {busy && !preview && <p className="mt-6 text-sm text-secondary">Reading the spec…</p>}
        {error && <div role="alert" className="mt-4 rounded-md border border-failure/40 bg-failure/10 p-3 text-sm text-failure">{error}</div>}

        {preview && (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-secondary">{preview.total} operations found. {preview.unchanged} already up to date.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {BUCKETS.map((bucket) => (
                <details key={bucket.key} className="rounded-md border border-border bg-bg p-3">
                  <summary className="cursor-pointer text-sm text-primary"><strong>{preview.preview[bucket.key].length}</strong> {bucket.label}</summary>
                  <p className="mt-2 text-xs text-secondary">{bucket.help}</p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                    {preview.preview[bucket.key].map((item) => (
                      <li key={item.testCaseId} className="text-secondary"><span className="font-mono text-primary">{item.testCaseId}</span>{bucket.key === 'create' && !item.active && <span> · inactive ({item.risk.join(', ')})</span>}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
            {preview.inactiveForReview > 0 && (
              <p className="text-xs text-secondary">{preview.inactiveForReview} new cases start inactive: they change data, touch sensitive paths, or need path parameter values. Review them, fill variables, then switch them on.</p>
            )}
            {preview.bundle.created ? (
              <label className="field-label">Bundle name
                <input className="field" value={bundleName} onChange={(e) => setBundleName(e.target.value)} maxLength={120} />
                <span className="field-help">A new bundle is created and all cases are grouped under it. Run, switch on or off, and edit them together.</span>
              </label>
            ) : (
              <p className="rounded-md border border-border bg-bg p-3 text-sm text-secondary">Updates the existing bundle <strong className="text-primary">{preview.bundle.name}</strong>.{preview.adopted > 0 && ` ${preview.adopted} loose case${preview.adopted === 1 ? '' : 's'} will be moved into it.`}</p>
            )}
            {preview.bundle.created && preview.adopted > 0 && <p className="text-xs text-secondary">{preview.adopted} existing loose case{preview.adopted === 1 ? '' : 's'} with matching ids will be moved into the bundle.</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" disabled={busy || !preview || nothingToDo} onClick={confirm}>{nothingToDo ? 'Nothing to import' : 'Import'}</button>
        </div>
      </div>
    </div>
  )
}
