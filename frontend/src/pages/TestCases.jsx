import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { Upload, Plus, RefreshCw, Search, Play, Trash2 } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import LoadingState from '../components/LoadingState.jsx'
import TestCaseForm from '../components/TestCaseForm.jsx'
import OpenApiImportDialog from '../components/OpenApiImportDialog.jsx'
import RunTargetDialog from '../components/RunTargetDialog.jsx'
import SuiteGroup from '../components/SuiteGroup.jsx'
import { assignCasesToSuite, createTestCase, deleteTestCase, deleteTestCases, deleteTestSuite, getTestCases, getTestSuites, importEndpoints, setSuiteActive, startTestRun, updateTestCase, updateTestSuite } from '../services/api.js'

const COLLAPSED_KEY = 'cati.collapsedGroups'
const UNASSIGNED = 'unassigned'

function readCollapsed() {
  try {
    const value = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

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
  const [notice, setNotice] = useState('')
  const [openApi, setOpenApi] = useState(null)
  // null = closed; { suite } = run a whole bundle; { suite: null } = run the ticked cases.
  const [runDialog, setRunDialog] = useState(null)
  const [starting, setStarting] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [moveTarget, setMoveTarget] = useState('')

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      // YAML specs are sent as text and parsed by the backend.
      if (/\.ya?ml$/i.test(file.name)) {
        if (!/^\s*(openapi|swagger)\s*:/m.test(text)) throw new Error('not an OpenAPI document')
        setError('')
        setOpenApi({ spec: text, fileName: file.name })
        return
      }
      const data = JSON.parse(text)
      if (data?.openapi || data?.swagger) {
        setError('')
        setOpenApi({ spec: data, fileName: file.name })
        return
      }
      if (data?.format === 'cati-endpoints') {
        const summary = await importEndpoints(data)
        setError('')
        setNotice(`Imported ${summary.created} new API cases (${summary.enabled} enabled, ${summary.flagged} inactive for review); ${summary.skipped} already existed.`)
        await load()
        return
      }
      if (data?.format !== 'cati-testcase' || !data.testCase) throw new Error('not a CATI test case file')
      setError('')
      setEditing({ ...data.testCase })
    } catch (importError) {
      setError(`Could not import "${file.name}": ${importError.message}. Use an OpenAPI 3.x spec (.json/.yaml), a file made by "npm run record", or the backend's endpoint export.`)
    }
  }

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const [nextCases, nextSuites] = await Promise.all([getTestCases({ limit: 500 }), getTestSuites()])
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

  async function save(rawTestCase) {
    // The form uses '' for "Unassigned"; the API expects no suite as null.
    const testCase = { ...rawTestCase, suiteId: rawTestCase.suiteId || null }
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

  async function startRun({ environment, targetUrl }) {
    const suite = runDialog?.suite
    if (!suite && selected.length === 0) return
    setStarting(true)
    try {
      const run = await startTestRun({ environment, targetUrl, ...(suite ? { suiteId: suite._id } : { testCaseIds: selected }) })
      window.location.assign(`/runs/${run.runId || run.id}`)
    } catch (runError) {
      setError(runError.message)
      setRunDialog(null)
    } finally {
      setStarting(false)
    }
  }

  function setGroupExpanded(key, expanded) {
    setCollapsed((current) => {
      const next = expanded ? current.filter((item) => item !== key) : [...new Set([...current, key])]
      try { window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  function select(ids, checked) {
    setSelected((current) => checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)))
  }

  // Reload data without flipping the page to its loading state.
  async function refreshQuietly() {
    const [nextCases, nextSuites] = await Promise.all([getTestCases({ limit: 500 }), getTestSuites()])
    setCases(nextCases)
    setSuites(nextSuites)
  }

  async function runAction(action, message) {
    try {
      await action()
      setNotice(message || '')
      setError('')
      await refreshQuietly()
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  function setBundleActive(suite, active) {
    if (!active && !window.confirm(`Switch off every case in "${suite.name}"?`)) return
    runAction(() => setSuiteActive(suite._id, active), `Switched ${active ? 'on' : 'off'} all cases in "${suite.name}".`)
  }

  function renameBundle(suite) {
    const name = window.prompt('Bundle name', suite.name)?.trim()
    if (!name || name === suite.name) return
    runAction(() => updateTestSuite(suite._id, { name }), `Renamed to "${name}".`)
  }

  function deleteBundle(suite) {
    // OK = delete bundle and cases; Cancel then offers to keep the cases.
    const withCases = suite.testCaseCount > 0 && window.confirm(`Delete bundle "${suite.name}" AND its ${suite.testCaseCount} test cases?\n\nThis cannot be undone. Past run results are kept.\n\nPress Cancel to choose keeping the cases instead.`)
    if (withCases) {
      runAction(async () => {
        await deleteTestSuite(suite._id, { deleteCases: true })
        setSelected([])
      }, `Bundle "${suite.name}" and its cases deleted.`)
      return
    }
    if (!window.confirm(`Delete only the bundle "${suite.name}"? Its ${suite.testCaseCount} cases are kept and become unassigned.`)) return
    runAction(() => deleteTestSuite(suite._id), `Bundle "${suite.name}" deleted; its cases were kept.`)
  }

  function deleteSelected() {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} selected test case${selected.length === 1 ? '' : 's'}? This cannot be undone. Past run results are kept.`)) return
    runAction(async () => {
      await deleteTestCases(selected)
      setSelected([])
    }, `Deleted ${selected.length} test case${selected.length === 1 ? '' : 's'}.`)
  }

  function moveSelected() {
    if (!moveTarget || selected.length === 0) return
    runAction(async () => {
      if (moveTarget === UNASSIGNED) {
        const bySuite = new Map()
        for (const testCase of cases.filter((item) => selected.includes(item._id) && item.suiteId)) {
          bySuite.set(testCase.suiteId, [...(bySuite.get(testCase.suiteId) || []), testCase._id])
        }
        for (const [suiteId, ids] of bySuite) await assignCasesToSuite(suiteId, ids, { remove: true })
      } else {
        await assignCasesToSuite(moveTarget, selected)
      }
      setSelected([])
      setMoveTarget('')
    }, 'Moved the selected cases.')
  }

  async function finishOpenApiImport(summary) {
    setOpenApi(null)
    setNotice(`Bundle "${summary.bundle.name}" ${summary.bundle.created ? 'created' : 'updated'} from ${summary.spec.title} ${summary.spec.version}: ${summary.created} new (${summary.inactiveForReview} inactive for review), ${summary.updated} refreshed, ${summary.keptEdited} edited cases kept, ${summary.removed} deactivated${summary.adopted ? `, ${summary.adopted} loose cases moved in` : ''}.`)
    if (summary.bundle.id) setGroupExpanded(summary.bundle.id, true)
    await load()
  }

  const groups = useMemo(() => {
    const filtering = Boolean(query || type)
    const bySuite = new Map()
    for (const testCase of filtered) {
      const key = testCase.suiteId && suites.some((suite) => suite._id === testCase.suiteId) ? testCase.suiteId : UNASSIGNED
      bySuite.set(key, [...(bySuite.get(key) || []), testCase])
    }
    const ordered = [...suites].sort((a, b) => Number(Boolean(b.source)) - Number(Boolean(a.source)))
    const list = ordered
      .map((suite) => ({ key: suite._id, suite, cases: bySuite.get(suite._id) || [] }))
      .filter((group) => !filtering || group.cases.length > 0)
    const loose = bySuite.get(UNASSIGNED) || []
    if (loose.length > 0) list.push({ key: UNASSIGNED, suite: null, cases: loose })
    return list
  }, [filtered, suites, query, type])

  if (status === 'loading') return <LoadingState />
  if (status === 'error') return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-primary">Test Cases</h1><p className="mt-1 text-sm text-secondary">Create and manage runnable cases without editing test files.</p></div>
        <div className="flex gap-2"><button className="secondary-button" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</button><input ref={importRef} type="file" accept=".json,.yaml,.yml,application/json" className="hidden" onChange={importFile} /><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Import</button><button className="primary-button" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New test case</button></div>
      </div>
      {openApi && <OpenApiImportDialog spec={openApi.spec} fileName={openApi.fileName} onDone={finishOpenApiImport} onCancel={() => setOpenApi(null)} />}
      {runDialog && <RunTargetDialog count={selected.length} title={runDialog.suite ? `Run bundle "${runDialog.suite.name}" (${runDialog.suite.activeCount} active)` : undefined} busy={starting} onRun={startRun} onCancel={() => setRunDialog(null)} />}
      {notice && <div role="status" className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-failure/40 bg-failure/10 p-3 text-sm text-failure">{error}</div>}
      {editing ? <TestCaseForm testCase={editing._id ? editing : null} draft={editing._id ? null : editing} suites={suites} onSave={save} onCancel={() => setEditing(null)} saving={saving} /> : (
        <>
          <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
            <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary" /><input className="field pl-9" placeholder="Search cases" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <select className="field w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{['API', 'UI', 'E2E', 'WEBSOCKET', 'AI_VOICE'].map((item) => <option key={item}>{item}</option>)}</select>
            <button className="primary-button" disabled={!selected.length} onClick={() => setRunDialog({ suite: null })}><Play className="h-4 w-4" /> Run selected ({selected.length})</button>
            {selected.length > 0 && <button className="secondary-button text-failure" onClick={deleteSelected}><Trash2 className="h-4 w-4" /> Delete selected ({selected.length})</button>}
            {selected.length > 0 && <span className="flex gap-2"><select className="field w-auto" aria-label="Move selected cases to" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}><option value="">Move selected to…</option>{suites.map((suite) => <option key={suite._id} value={suite._id}>{suite.name}</option>)}<option value={UNASSIGNED}>Remove from bundle</option></select><button className="secondary-button" disabled={!moveTarget} onClick={moveSelected}>Move</button></span>}
          </div>
          {groups.length === 0 ? <EmptyState message="No test cases match these filters." /> : (
            <div className="space-y-4">
              {groups.map((group) => (
                <SuiteGroup
                  key={group.key}
                  suite={group.suite}
                  cases={group.cases}
                  expanded={!collapsed.includes(group.key)}
                  onToggleExpanded={() => setGroupExpanded(group.key, collapsed.includes(group.key))}
                  selected={selected}
                  onSelect={select}
                  onRun={(suite) => setRunDialog({ suite })}
                  onSetActive={setBundleActive}
                  onRename={renameBundle}
                  onDelete={deleteBundle}
                  onEdit={setEditing}
                  onDuplicate={(testCase) => setEditing({ ...testCase, _id: undefined, testCaseId: `${testCase.testCaseId}-COPY`, name: `${testCase.name} copy`, active: false })}
                  onRemove={remove}
                  onToggle={toggleActive}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
