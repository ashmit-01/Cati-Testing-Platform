import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { Upload, Copy, Edit3, Plus, RefreshCw, Search, Trash2, ToggleLeft, Play } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import LoadingState from '../components/LoadingState.jsx'
import TestCaseForm from '../components/TestCaseForm.jsx'
import { createTestCase, deleteTestCase, getTestCases, getTestSuites, startTestRun, updateTestCase } from '../services/api.js'

export default function TestCases() {
  const [cases, setCases] = useState([])
  const [suites, setSuites] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [selected, setSelected] = useState([])
  const importRef = useRef(null)

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (data?.format !== 'cati-testcase' || !data.testCase) throw new Error('not a CATI test case file')
      setError('')
      setEditing({ ...data.testCase })
    } catch (importError) {
      setError(`Could not import "${file.name}": ${importError.message}. Use a file made by "npm run record".`)
    }
  }

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const [nextCases, nextSuites] = await Promise.all([getTestCases({ active: undefined }), getTestSuites()])
      setCases(nextCases)
      setSuites(nextSuites)
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message)
      setStatus('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => cases.filter((testCase) => (
    (!type || testCase.type === type) &&
    (!query || `${testCase.name} ${testCase.testCaseId}`.toLowerCase().includes(query.toLowerCase()))
  )), [cases, query, type])

  async function save(testCase) {
    setSaving(true)
    try {
      const saved = editing?._id ? await updateTestCase(editing._id, testCase) : await createTestCase(testCase)
      setCases((current) => editing?._id ? current.map((item) => item._id === saved._id ? saved : item) : [saved, ...current])
      setEditing(null)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(testCase) {
    if (!window.confirm(`Delete "${testCase.name}"?`)) return
    try {
      await deleteTestCase(testCase._id)
      setCases((current) => current.filter((item) => item._id !== testCase._id))
    } catch (removeError) {
      setError(removeError.message)
    }
  }

  async function toggleActive(testCase) {
    try {
      const saved = await updateTestCase(testCase._id, { active: !testCase.active })
      setCases((current) => current.map((item) => item._id === saved._id ? saved : item))
    } catch (toggleError) {
      setError(toggleError.message)
    }
  }

  async function runSelected() {
    if (selected.length === 0) return
    try {
      const run = await startTestRun({ environment: 'staging', testCaseIds: selected })
      window.location.assign(`/runs/${run.runId || run.id}`)
    } catch (runError) {
      setError(runError.message)
    }
  }

  if (status === 'loading') return <LoadingState />
  if (status === 'error') return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-primary">Test Cases</h1><p className="mt-1 text-sm text-secondary">Create and manage runnable cases without editing test files.</p></div>
        <div className="flex gap-2"><button className="secondary-button" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</button><input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={importFile} /><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Import</button><button className="primary-button" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New test case</button></div>
      </div>
      {error && <div role="alert" className="rounded-md border border-failure/40 bg-failure/10 p-3 text-sm text-failure">{error}</div>}
      {editing ? <TestCaseForm testCase={editing._id ? editing : null} draft={editing._id ? null : editing} suites={suites} onSave={save} onCancel={() => setEditing(null)} saving={saving} /> : (
        <>
          <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
            <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary" /><input className="field pl-9" placeholder="Search cases" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <select className="field w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{['API', 'UI', 'E2E', 'WEBSOCKET', 'AI_VOICE'].map((item) => <option key={item}>{item}</option>)}</select>
            <button className="primary-button" disabled={!selected.length} onClick={runSelected}><Play className="h-4 w-4" /> Run selected ({selected.length})</button>
          </div>
          {filtered.length === 0 ? <EmptyState message="No test cases match these filters." /> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase text-secondary"><tr><th className="p-4"> </th><th className="p-4">Case</th><th className="p-4">Type</th><th className="p-4">Suite</th><th className="p-4">Priority</th><th className="p-4">State</th><th className="p-4">Actions</th></tr></thead><tbody>{filtered.map((testCase) => <tr key={testCase._id} className="border-b border-border last:border-0"><td className="p-4"><input type="checkbox" checked={selected.includes(testCase._id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, testCase._id] : current.filter((id) => id !== testCase._id))} /></td><td className="p-4"><div className="font-medium text-primary">{testCase.name}</div><div className="text-xs text-secondary">{testCase.testCaseId}</div></td><td className="p-4 text-secondary">{testCase.type}</td><td className="p-4 text-secondary">{suites.find((suite) => suite._id === testCase.suiteId)?.name || 'Unassigned'}</td><td className="p-4 text-secondary">{testCase.priority}</td><td className="p-4"><button className={testCase.active ? 'text-success' : 'text-secondary'} onClick={() => toggleActive(testCase)}><ToggleLeft className="h-5 w-5" /></button></td><td className="p-4"><div className="flex gap-1"><button className="icon-button" aria-label="Edit" onClick={() => setEditing(testCase)}><Edit3 className="h-4 w-4" /></button><button className="icon-button" aria-label="Duplicate" onClick={() => setEditing({ ...testCase, _id: undefined, testCaseId: `${testCase.testCaseId}-COPY`, name: `${testCase.name} copy`, active: false })}><Copy className="h-4 w-4" /></button><button className="icon-button" aria-label="Delete" onClick={() => remove(testCase)}><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}
        </>
      )}
    </div>
  )
}
