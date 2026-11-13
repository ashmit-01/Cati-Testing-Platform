import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Code2, FileText, Globe2, Layers3, MousePointer2, Play, Sparkles } from 'lucide-react'
import AssertionBuilder from './AssertionBuilder.jsx'
import UiActionBuilder from './UiActionBuilder.jsx'

const TYPES = [
  { value: 'API', label: 'API test', description: 'Check an endpoint, response, and status.', icon: Globe2 },
  { value: 'UI', label: 'UI test', description: 'Walk through a browser journey.', icon: MousePointer2 },
  { value: 'E2E', label: 'End-to-end', description: 'Verify a complete user workflow.', icon: Layers3 },
  { value: 'WEBSOCKET', label: 'WebSocket', description: 'Validate real-time messages.', icon: Sparkles },
  { value: 'AI_VOICE', label: 'AI / Voice', description: 'Test an AI scenario or conversation.', icon: Sparkles }
]

const STEPS = ['Basics', 'Build flow', 'Check success', 'Review']

function initialCase(testCase) {
  return {
    testCaseId: testCase?.testCaseId || '',
    name: testCase?.name || '',
    type: testCase?.type || 'UI',
    suiteId: testCase?.suiteId || '',
    precondition: testCase?.precondition || '',
    priority: testCase?.priority || 'MEDIUM',
    active: testCase?.active ?? false,
    input: testCase?.input || { method: 'GET', endpoint: '', headers: {}, body: null },
    expectedResult: testCase?.expectedResult || [],
    definition: testCase?.definition || { actions: [], assertions: [] }
  }
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

export default function TestCaseForm({ testCase, draft, suites, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => initialCase(testCase || draft))
  const [step, setStep] = useState(0)
  const [advanced, setAdvanced] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const next = initialCase(testCase || draft)
    setForm(next)
    setStep(0)
    setJsonText(pretty({ input: next.input, expectedResult: next.expectedResult, definition: next.definition }))
  }, [testCase, draft])

  const selectedType = useMemo(() => TYPES.find((type) => type.value === form.type) || TYPES[0], [form.type])
  const isBrowser = ['UI', 'E2E'].includes(form.type)
  const assertions = isBrowser ? (form.definition?.assertions || []) : (Array.isArray(form.expectedResult) ? form.expectedResult : [])

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function setInput(field, value) {
    setForm((current) => ({ ...current, input: { ...(current.input || {}), [field]: value } }))
  }

  function setDefinition(field, value) {
    setForm((current) => ({ ...current, definition: { ...(current.definition || {}), [field]: value } }))
  }

  function selectType(type) {
    setField('type', type)
    if (['UI', 'E2E'].includes(type)) {
      setField('definition', form.definition || { actions: [], assertions: [] })
    }
  }

  function toggleAdvanced() {
    if (!advanced) {
      setJsonText(pretty({ input: form.input, expectedResult: form.expectedResult, definition: form.definition }))
      setJsonError('')
    }
    setAdvanced((value) => !value)
  }

  function validateStep(targetStep) {
    if (targetStep <= 0) return true
    if (!form.name.trim() || !form.testCaseId.trim()) {
      setFormError('Add a name and case ID before continuing.')
      setStep(0)
      return false
    }
    if (targetStep >= 1 && isBrowser && !String(form.input?.path || form.input?.url || '').trim()) {
      setFormError('Add the page where this journey starts.')
      setStep(1)
      return false
    }
    if (targetStep >= 2 && assertions.length === 0) {
      setFormError('Add at least one success check before reviewing.')
      setStep(2)
      return false
    }
    setFormError('')
    return true
  }

  function goTo(targetStep) {
    if (targetStep > step && !validateStep(targetStep)) return
    setStep(Math.max(0, Math.min(STEPS.length - 1, targetStep)))
  }

  function submit(event) {
    event.preventDefault()
    if (!validateStep(3)) return
    if (advanced) {
      try {
        const parsed = JSON.parse(jsonText)
        setJsonError('')
        onSave({ ...form, ...parsed })
      } catch {
        setJsonError('Definition must be valid JSON.')
      }
      return
    }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="border-b border-border bg-bg/60 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-info">{testCase ? 'Edit test case' : 'Test case designer'}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-primary">{testCase ? testCase.name : 'Create a new test'}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Describe what a user does, then define what success looks like. CATI turns the definition into a runnable test.</p>
          </div>
          <button type="button" className="secondary-button" onClick={toggleAdvanced}><Code2 className="h-4 w-4" /> {advanced ? 'Use designer' : 'Advanced JSON'}</button>
        </div>
        <nav className="mt-6 grid grid-cols-4 gap-1" aria-label="Test designer steps">
          {STEPS.map((label, index) => <button key={label} type="button" onClick={() => goTo(index)} className={`relative flex items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-left text-xs font-semibold transition-colors sm:text-sm ${index === step ? 'border-info text-info' : index < step ? 'border-success text-success' : 'border-transparent text-secondary hover:text-primary'}`}><span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span className="hidden sm:inline">{label}</span></button>)}
        </nav>
      </header>

      <div className="p-5 sm:p-7">
        {formError && <div role="alert" className="mb-5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-primary">{formError}</div>}
        {advanced ? (
          <label className="field-label">Definition JSON<textarea className="field min-h-[420px] font-mono text-xs leading-6" value={jsonText} onChange={(e) => setJsonText(e.target.value)} />{jsonError && <span role="alert" className="text-sm text-failure">{jsonError}</span>}</label>
        ) : (
          <>
            {step === 0 && <div className="space-y-7">
              <section><div className="mb-4 flex items-center gap-3"><FileText className="h-5 w-5 text-info" /><div><h3 className="text-base font-semibold text-primary">Start with the basics</h3><p className="text-sm text-secondary">Give your test a clear identity so the team can find it later.</p></div></div><div className="grid gap-4 md:grid-cols-2"><label className="field-label">Test name <span className="text-failure">*</span><input required className="field" placeholder="Customer can be created" value={form.name} onChange={(e) => setField('name', e.target.value)} /><span className="field-help">Use an outcome-focused name.</span></label><label className="field-label">Case ID <span className="text-failure">*</span><input required className="field" placeholder="CUSTOMER-001" value={form.testCaseId} onChange={(e) => setField('testCaseId', e.target.value)} /><span className="field-help">A unique ID used in reports.</span></label><label className="field-label">Suite<select className="field" value={form.suiteId} onChange={(e) => setField('suiteId', e.target.value)}><option value="">Unassigned</option>{suites.map((suite) => <option key={suite._id} value={suite._id}>{suite.name}</option>)}</select></label><label className="field-label">Priority<select className="field" value={form.priority} onChange={(e) => setField('priority', e.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => <option key={priority}>{priority}</option>)}</select></label></div></section>
              <section><h3 className="mb-3 text-sm font-semibold text-primary">What are you testing?</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{TYPES.map((type) => { const Icon = type.icon; const selected = form.type === type.value; return <button key={type.value} type="button" aria-pressed={selected} onClick={() => selectType(type.value)} className={`group rounded-xl border p-4 text-left transition-colors ${selected ? 'border-info bg-info/10' : 'border-border bg-bg hover:border-info/60'}`}><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${selected ? 'bg-info text-white' : 'bg-info/10 text-info'}`}><Icon className="h-5 w-5" /></div><p className="font-semibold text-primary">{type.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{type.description}</p></button> })}</div></section>
              <label className="field-label">Precondition <span className="font-normal text-secondary">(optional)</span><textarea className="field min-h-20" placeholder="User is signed in and has access to the customer area." value={form.precondition} onChange={(e) => setField('precondition', e.target.value)} /></label>
            </div>}

            {step === 1 && <div className="space-y-7">
              <section><div className="mb-4 flex items-center gap-3"><Play className="h-5 w-5 text-info" /><div><h3 className="text-base font-semibold text-primary">{isBrowser ? 'Build the user journey' : 'Define the test input'}</h3><p className="text-sm text-secondary">{isBrowser ? 'Add actions in the same order a user completes them.' : 'Enter the request that the runner should send.'}</p></div></div>
                {form.type === 'API' && <div className="space-y-4"><div className="grid gap-4 md:grid-cols-4"><label className="field-label">Method<select className="field" value={form.input?.method || 'GET'} onChange={(e) => setInput('method', e.target.value)}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}</select></label><label className="field-label md:col-span-3">Endpoint <span className="text-failure">*</span><input required className="field" value={form.input?.endpoint || ''} onChange={(e) => setInput('endpoint', e.target.value)} placeholder="/api/customers" /></label></div><label className="field-label">Request body <span className="font-normal text-secondary">(optional JSON)</span><textarea className="field min-h-28 font-mono text-xs" value={typeof form.input?.body === 'string' ? form.input.body : pretty(form.input?.body || {})} onChange={(e) => setInput('body', e.target.value)} /></label></div>}
                {isBrowser && <div className="space-y-5"><label className="field-label">Start page <span className="text-failure">*</span><input required className="field" value={form.input?.path || form.input?.url || ''} onChange={(e) => setInput('path', e.target.value)} placeholder="/customers" /><span className="field-help">The browser opens this page before running step 1.</span></label><UiActionBuilder actions={form.definition?.actions || []} onChange={(actions) => setDefinition('actions', actions)} /></div>}
                {!['API', 'UI', 'E2E'].includes(form.type) && <label className="field-label">Test definition JSON<textarea className="field min-h-48 font-mono text-xs" value={pretty(form.definition || {})} onChange={(e) => { try { setField('definition', JSON.parse(e.target.value)) } catch { setFormError('Finish the JSON definition before continuing.') } }} /></label>}
              </section>
            </div>}

            {step === 2 && <div className="space-y-7"><section><div className="mb-4 flex items-center gap-3"><Check className="h-5 w-5 text-success" /><div><h3 className="text-base font-semibold text-primary">Define success</h3><p className="text-sm text-secondary">Add checks that decide whether the test passes.</p></div></div><AssertionBuilder assertions={assertions} onChange={(value) => isBrowser ? setDefinition('assertions', value) : setField('expectedResult', value)} /></section></div>}

            {step === 3 && <div className="space-y-6"><section><h3 className="text-lg font-semibold text-primary">Review before saving</h3><p className="mt-1 text-sm text-secondary">Check the important pieces. You can return to any step to edit them.</p></section><div className="grid gap-4 md:grid-cols-2"><div className="summary-card"><span className="summary-label">Test</span><strong>{form.name || 'Unnamed test'}</strong><span>{form.testCaseId} · {selectedType.label}</span></div><div className="summary-card"><span className="summary-label">Organization</span><strong>{suites.find((suite) => suite._id === form.suiteId)?.name || 'Unassigned'}</strong><span>{form.priority} priority · {form.active ? 'Active' : 'Draft'}</span></div><div className="summary-card"><span className="summary-label">Flow</span><strong>{isBrowser ? `${form.definition?.actions?.length || 0} steps` : `${form.input?.method || 'GET'} ${form.input?.endpoint || 'No endpoint'}`}</strong><span>{isBrowser ? form.input?.path || 'No start page' : 'Request definition ready'}</span></div><div className="summary-card"><span className="summary-label">Success checks</span><strong>{assertions.length} assertion{assertions.length === 1 ? '' : 's'}</strong><span>Required for a passing result</span></div></div><label className="flex items-start gap-3 rounded-xl border border-border bg-bg p-4 text-sm text-primary"><input type="checkbox" className="mt-1 h-4 w-4 accent-info" checked={form.active} onChange={(e) => setField('active', e.target.checked)} /><span><strong>Make this test active</strong><span className="mt-1 block text-secondary">Active tests are included when their suite or case is run. Keep it off while you are still refining the flow.</span></span></label></div>}
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg/40 px-5 py-4 sm:px-7">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <div className="flex gap-2">{step > 0 && !advanced && <button type="button" className="secondary-button" onClick={() => goTo(step - 1)}><ChevronLeft className="h-4 w-4" /> Back</button>}{!advanced && step < STEPS.length - 1 ? <button type="button" className="primary-button" onClick={() => goTo(step + 1)}>Continue <ChevronRight className="h-4 w-4" /></button> : <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save test case'}</button>}</div>
      </footer>
    </form>
  )
}
