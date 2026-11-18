import { ChevronDown, ChevronRight, Pencil, Play, Power, PowerOff, Trash2 } from 'lucide-react'
import CaseTable from './CaseTable.jsx'

const RUN_TONE = {
  COMPLETED: 'text-success',
  FAILED: 'text-failure',
  RUNNING: 'text-info',
  CANCELLING: 'text-secondary',
  CANCELLED: 'text-secondary'
}

/**
 * One collapsible group on the Test Cases page: a bundle/suite with its
 * actions, or the "Unassigned" cases (suite is null, so no suite actions).
 */
export default function SuiteGroup({
  suite, cases, expanded, onToggleExpanded,
  selected, onSelect, onRun, onSetActive, onRename, onDelete,
  onEdit, onDuplicate, onRemove, onToggle
}) {
  const ids = cases.map((testCase) => testCase._id)
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id))
  const source = suite?.source
  const Chevron = expanded ? ChevronDown : ChevronRight
  const name = suite ? suite.name : 'Unassigned'
  const total = suite ? suite.testCaseCount : cases.length
  const active = suite ? suite.activeCount : cases.filter((testCase) => testCase.active).length
  const lastRun = suite?.lastRun

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label={name}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <input type="checkbox" aria-label={`Select all in ${name}`} checked={allSelected} disabled={ids.length === 0} onChange={(e) => onSelect(ids, e.target.checked)} />
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded} onClick={onToggleExpanded}>
          <Chevron className="h-4 w-4 shrink-0 text-secondary" />
          <span className="truncate font-semibold text-primary">{name}</span>
          {source?.kind === 'openapi' && <span className="shrink-0 rounded border border-info/40 px-1.5 py-0.5 text-xs text-info">OpenAPI {source.specVersion}</span>}
          <span className="shrink-0 text-xs text-secondary">{active}/{total} active</span>
        </button>
        {lastRun && <a href={`/runs/${lastRun.runId}`} className={`text-xs ${RUN_TONE[lastRun.status] || 'text-secondary'}`}>Last run: {String(lastRun.status).toLowerCase()}{lastRun.targetUrl ? ` · ${lastRun.targetUrl}` : ''}</a>}
        {suite && (
          <div className="flex flex-wrap gap-1">
            <button className="primary-button" disabled={active === 0} title={active === 0 ? 'No active cases in this bundle' : undefined} onClick={() => onRun(suite)}><Play className="h-4 w-4" /> Run bundle</button>
            <button className="icon-button" aria-label={`Switch on all in ${name}`} title="Switch all on" onClick={() => onSetActive(suite, true)}><Power className="h-4 w-4" /></button>
            <button className="icon-button" aria-label={`Switch off all in ${name}`} title="Switch all off" onClick={() => onSetActive(suite, false)}><PowerOff className="h-4 w-4" /></button>
            <button className="icon-button" aria-label={`Rename ${name}`} title="Rename" onClick={() => onRename(suite)}><Pencil className="h-4 w-4" /></button>
            <button className="icon-button" aria-label={`Delete ${name}`} title="Delete bundle (cases are kept)" onClick={() => onDelete(suite)}><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="border-t border-border">
          {cases.length === 0
            ? <p className="p-4 text-sm text-secondary">No cases match the current filters.</p>
            : <CaseTable cases={cases} selected={selected} onSelect={onSelect} onEdit={onEdit} onDuplicate={onDuplicate} onRemove={onRemove} onToggle={onToggle} />}
        </div>
      )}
    </section>
  )
}
