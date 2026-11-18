import { Copy, Edit3, ToggleLeft, Trash2 } from 'lucide-react'

/** Rows for one group of test cases. Selection is controlled by the page. */
export default function CaseTable({ cases, selected, onSelect, onEdit, onDuplicate, onRemove, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-secondary">
          <tr><th className="p-4"> </th><th className="p-4">Case</th><th className="p-4">Type</th><th className="p-4">Priority</th><th className="p-4">State</th><th className="p-4">Actions</th></tr>
        </thead>
        <tbody>
          {cases.map((testCase) => (
            <tr key={testCase._id} className="border-b border-border last:border-0">
              <td className="p-4"><input type="checkbox" aria-label={`Select ${testCase.name}`} checked={selected.includes(testCase._id)} onChange={(e) => onSelect([testCase._id], e.target.checked)} /></td>
              <td className="p-4">
                <div className="font-medium text-primary">{testCase.name}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                  <span>{testCase.testCaseId}</span>
                  {testCase.definition?.source === 'openapi' && <span className="rounded border border-info/40 px-1.5 py-0.5 text-info">OpenAPI</span>}
                  {testCase.definition?.openapi?.removed && <span className="rounded border border-failure/40 px-1.5 py-0.5 text-failure">removed from spec</span>}
                </div>
              </td>
              <td className="p-4 text-secondary">{testCase.type}</td>
              <td className="p-4 text-secondary">{testCase.priority}</td>
              <td className="p-4"><button className={testCase.active ? 'text-success' : 'text-secondary'} aria-label={testCase.active ? 'Switch off' : 'Switch on'} onClick={() => onToggle(testCase)}><ToggleLeft className="h-5 w-5" /></button></td>
              <td className="p-4">
                <div className="flex gap-1">
                  <button className="icon-button" aria-label="Edit" onClick={() => onEdit(testCase)}><Edit3 className="h-4 w-4" /></button>
                  <button className="icon-button" aria-label="Duplicate" onClick={() => onDuplicate(testCase)}><Copy className="h-4 w-4" /></button>
                  <button className="icon-button" aria-label="Delete" onClick={() => onRemove(testCase)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
