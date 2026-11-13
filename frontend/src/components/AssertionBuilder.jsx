import { CheckCircle2, Plus, Trash2 } from 'lucide-react'

const ASSERTION_TYPES = [
  { value: 'visibleText', label: 'Text is visible', placeholder: 'Success' },
  { value: 'visible', label: 'Element is visible', placeholder: 'Element locator' },
  { value: 'url', label: 'URL contains', placeholder: '/dashboard' },
  { value: 'status', label: 'Response status is', placeholder: '200' },
  { value: 'jsonPath', label: 'Response field equals', placeholder: '$.data.id' }
]

export default function AssertionBuilder({ assertions = [], onChange, compact = false }) {
  function update(index, field, value) {
    onChange(assertions.map((item, current) => (
      current === index ? { ...item, [field]: value } : item
    )))
  }

  function add(kind = 'visibleText') {
    onChange([...assertions, { kind, operator: 'equals', expected: '' }])
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div><p className="text-sm font-semibold text-primary">Define success</p><p className="mt-1 text-sm leading-6 text-secondary">Assertions tell CATI what must be true for this test to pass. Add at least one.</p></div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {assertions.map((assertion, index) => {
          const type = ASSERTION_TYPES.find((item) => item.value === assertion.kind) || ASSERTION_TYPES[0]
          return (
            <div key={index} className="grid gap-3 rounded-xl border border-border bg-bg p-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
              <label className="field-label"><span className="sr-only">Assertion {index + 1} type</span><select className="field" value={assertion.kind || 'visibleText'} onChange={(e) => update(index, 'kind', e.target.value)}>{ASSERTION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="field-label"><span className="sr-only">Assertion {index + 1} expected value</span><input required className="field" placeholder={type.placeholder} value={assertion.expected ?? assertion.path ?? ''} onChange={(e) => update(index, assertion.kind === 'jsonPath' ? 'path' : 'expected', e.target.value)} /></label>
              <button type="button" className="icon-button self-end" aria-label={`Remove assertion ${index + 1}`} onClick={() => onChange(assertions.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="secondary-button" onClick={() => add()}><Plus className="h-4 w-4" /> Add assertion</button>
        {!compact && <span className="self-center text-xs text-secondary">Examples: text, URL, visibility, status, or response field.</span>}
      </div>
    </div>
  )
}
