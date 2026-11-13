import { ArrowDown, ArrowUp, CheckCircle2, GripVertical, Plus, Trash2 } from 'lucide-react'

const ACTION_TYPES = [
  { value: 'navigate', label: 'Open page', description: 'Go to a URL or route' },
  { value: 'click', label: 'Click element', description: 'Press a button, link, or control' },
  { value: 'fill', label: 'Enter text', description: 'Type into an input or field' },
  { value: 'select', label: 'Select option', description: 'Choose an option from a list' },
  { value: 'press', label: 'Press key', description: 'Press Enter in a field' },
  { value: 'wait', label: 'Wait', description: 'Wait for a page or element state' }
]

const LOCATOR_TYPES = [
  { value: 'testId', label: 'Test ID', hint: 'Most stable' },
  { value: 'role', label: 'Role + name', hint: 'Accessible' },
  { value: 'label', label: 'Field label', hint: 'Form fields' },
  { value: 'text', label: 'Visible text', hint: 'Use carefully' },
  { value: 'css', label: 'CSS selector', hint: 'Last resort' }
]

const EMPTY_ACTION = {
  kind: 'click',
  locator: { strategy: 'testId', value: '' },
  value: ''
}

function getActionType(kind) {
  return ACTION_TYPES.find((type) => type.value === kind) || ACTION_TYPES[1]
}

export default function UiActionBuilder({ actions = [], onChange }) {

  function update(index, patch) {
    onChange(actions.map((action, current) => (
      current === index ? { ...action, ...patch } : action
    )))
  }

  function updateLocator(index, field, value) {
    update(index, { locator: { ...(actions[index].locator || {}), [field]: value } })
  }

  function addAction(kind = 'click') {
    onChange([...actions, { ...EMPTY_ACTION, kind, locator: { ...EMPTY_ACTION.locator } }])
  }

  function move(index, direction) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= actions.length) return
    const next = [...actions]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-bg p-4 text-sm leading-6 text-secondary">
        <span className="font-semibold text-primary">Tip:</span> record a journey on your own machine with <code className="rounded bg-card px-1.5 py-0.5 text-primary">npm run record -- &lt;url&gt;</code> in the backend folder, then use <strong>Import</strong> on the Test Cases page.
      </div>

      <div className="rounded-lg border border-info/30 bg-info/10 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <div>
            <p className="text-sm font-semibold text-primary">Review or adjust steps</p>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Recorded steps appear here. Edit, reorder or remove them, or add a step by hand.
            </p>
          </div>
        </div>
      </div>

      <ol className="space-y-3" aria-label="UI test steps">
        {actions.map((action, index) => {
          const actionType = getActionType(action.kind)
          return (
            <li key={`${index}-${action.kind}`} className="relative rounded-xl border border-border bg-bg p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1 text-secondary" aria-hidden="true">
                  <GripVertical className="h-4 w-4" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info/15 text-xs font-bold text-info">{index + 1}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="field-label flex-1">
                      <span className="sr-only">Step {index + 1} action</span>
                      <select className="field font-semibold" value={action.kind || 'click'} onChange={(e) => update(index, { kind: e.target.value, value: '' })}>
                        {ACTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </label>
                    <div className="flex gap-1">
                      <button type="button" className="icon-button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" className="icon-button" aria-label={`Move step ${index + 1} down`} disabled={index === actions.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" className="icon-button" aria-label={`Remove step ${index + 1}`} onClick={() => onChange(actions.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <p className="text-xs text-secondary">{actionType.description}</p>

                  {action.kind === 'navigate' ? (
                    <label className="field-label">
                      Page URL or route
                      <input className="field" placeholder="/customers" value={action.value || ''} onChange={(e) => update(index, { value: e.target.value })} />
                    </label>
                  ) : action.kind === 'wait' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="field-label">Wait for<select className="field" value={action.waitFor || 'visible'} onChange={(e) => update(index, { waitFor: e.target.value })}><option value="visible">Element visible</option><option value="hidden">Element hidden</option><option value="networkidle">Network idle</option></select></label>
                      <label className="field-label">Timeout (ms)<input type="number" min="100" className="field" value={action.timeout || 10000} onChange={(e) => update(index, { timeout: Number(e.target.value) })} /></label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <label className="field-label">
                          Find element by
                          <select className="field" value={action.locator?.strategy || 'testId'} onChange={(e) => updateLocator(index, 'strategy', e.target.value)}>
                            {LOCATOR_TYPES.map((locator) => <option key={locator.value} value={locator.value}>{locator.label} — {locator.hint}</option>)}
                          </select>
                        </label>
                        <label className="field-label">
                          Locator value
                          <input required className="field" placeholder={action.locator?.strategy === 'testId' ? 'add-customer' : 'Save'} value={action.locator?.value || ''} onChange={(e) => updateLocator(index, 'value', e.target.value)} />
                        </label>
                      </div>
                      {action.locator?.strategy === 'role' && (
                        <label className="field-label">
                          Role
                          <input className="field" placeholder="button" value={action.locator?.role || ''} onChange={(e) => updateLocator(index, 'role', e.target.value)} />
                        </label>
                      )}
                      {['fill', 'select', 'press'].includes(action.kind) && (
                        <label className="field-label">
                          {action.kind === 'fill' ? 'Text to enter' : action.kind === 'press' ? 'Key' : 'Option to select'}
                          <input required className="field" placeholder={action.kind === 'fill' ? 'Test Customer' : 'Active'} value={action.value || ''} onChange={(e) => update(index, { value: e.target.value })} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACTION_TYPES.map((type) => (
          <button key={type.value} type="button" className="secondary-button min-h-14 justify-start text-left" onClick={() => addAction(type.value)}>
            <Plus className="h-4 w-4 shrink-0 text-info" />
            <span><span className="block text-sm">{type.label}</span><span className="block text-xs font-normal text-secondary">{type.description}</span></span>
          </button>
        ))}
      </div>
    </div>
  )
}
