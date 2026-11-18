import { useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { getAuthOptions } from '../services/api.js'

const FALLBACK_OPTIONS = [
  { value: 'public', label: 'None (public endpoint)', available: true },
  { value: 'jwt', label: 'Test user login (TEST_EMAIL)', available: true },
  { value: 'admin', label: 'Admin login (TEST_ADMIN_EMAIL)', available: true },
  { value: 'internal-key', label: 'Internal API key (INTERNAL_API_KEY)', available: true },
  { value: 'custom', label: 'Custom (token, header or login)', available: true }
]

const CUSTOM_TYPES = [
  { value: 'bearer', label: 'Bearer token' },
  { value: 'header', label: 'Custom header' },
  { value: 'login', label: 'Login with email and password' }
]

export default function ApiRequestOptions({ definition = {}, endpoint = '', body = '', onChange }) {
  const [options, setOptions] = useState(FALLBACK_OPTIONS)
  const auth = definition.auth || 'public'
  const custom = definition.authCustom || { type: 'bearer' }
  const variables = definition.variables || {}

  useEffect(() => {
    let active = true
    getAuthOptions().then((next) => { if (active && next.length) setOptions(next) }).catch(() => {})
    return () => { active = false }
  }, [])

  const selected = options.find((option) => option.value === auth)
  const names = Object.keys(variables)

  // Names used by the request (:id in the path, {{name}} anywhere) that have no row yet.
  const detected = useMemo(() => {
    const text = `${endpoint} ${typeof body === 'string' ? body : JSON.stringify(body || '')} ${JSON.stringify(custom)}`
    const found = new Set()
    for (const match of endpoint.matchAll(/\/:([A-Za-z_]\w*)/g)) found.add(match[1])
    for (const match of text.matchAll(/\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g)) {
      if (!match[1].startsWith('env.')) found.add(match[1])
    }
    return [...found].filter((name) => !(name in variables))
  }, [endpoint, body, custom, variables])

  function patch(fields) {
    onChange({ ...definition, ...fields })
  }

  function setVariable(name, value) {
    patch({ variables: { ...variables, [name]: value } })
  }

  function renameVariable(oldName, newName) {
    const next = {}
    for (const [name, value] of Object.entries(variables)) next[name === oldName ? newName : name] = value
    patch({ variables: next })
  }

  function removeVariable(name) {
    const next = { ...variables }
    delete next[name]
    patch({ variables: next })
  }

  function setCustom(field, value) {
    patch({ authCustom: { ...custom, [field]: value } })
  }

  const customType = custom.type || 'bearer'

  return (
    <div className="space-y-5 rounded-xl border border-border bg-bg p-4">
      <section className="space-y-3">
        <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-info" /><h4 className="text-sm font-semibold text-primary">Authentication</h4></div>
        <label className="field-label">Run this request as
          <select className="field" value={auth} onChange={(e) => patch({ auth: e.target.value })}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}{option.available ? '' : ' - not configured'}</option>)}
          </select>
          {selected && !selected.available && <span className="field-help text-warning">{selected.hint || 'Not configured on this platform.'} The test will fail until it is set.</span>}
        </label>
        {auth === 'custom' && (
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field-label">Type
              <select className="field" value={customType} onChange={(e) => patch({ authCustom: { type: e.target.value } })}>
                {CUSTOM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            {customType === 'header' && <>
              <label className="field-label">Header name<input className="field" placeholder="x-api-key" value={custom.name || ''} onChange={(e) => setCustom('name', e.target.value)} /></label>
              <label className="field-label">Header value<input className="field" placeholder="{{env.API_KEY}}" value={custom.value || ''} onChange={(e) => setCustom('value', e.target.value)} /></label>
            </>}
            {customType === 'login' && <>
              <label className="field-label">Email<input className="field" placeholder="{{env.OWNER_EMAIL}}" value={custom.email || ''} onChange={(e) => setCustom('email', e.target.value)} /></label>
              <label className="field-label">Password<input className="field" placeholder="{{env.OWNER_PASSWORD}}" value={custom.password || ''} onChange={(e) => setCustom('password', e.target.value)} /></label>
            </>}
            {customType === 'bearer' && <label className="field-label md:col-span-2">Token<input className="field" placeholder="{{env.MY_TOKEN}}" value={custom.token || ''} onChange={(e) => setCustom('token', e.target.value)} /></label>}
            <p className="field-help md:col-span-3">Anything typed here is saved with the test case. To keep secrets out of it, use <code>{'{{env.NAME}}'}</code>, which reads CATI_VAR_NAME from the platform .env.</p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div><h4 className="text-sm font-semibold text-primary">Variables</h4><p className="field-help">Use <code>{'{{name}}'}</code> in the endpoint, body or auth values, or <code>:name</code> in a path such as <code>/api/agents/:id</code>. <code>{'{{env.NAME}}'}</code> reads CATI_VAR_NAME from the platform .env.</p></div>
        {names.map((name) => (
          <div key={name} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <input className="field" aria-label="Variable name" value={name} onChange={(e) => renameVariable(name, e.target.value.replace(/\s/g, ''))} />
            <input className="field" aria-label={`Value for ${name}`} placeholder="value or {{env.NAME}}" value={variables[name] ?? ''} onChange={(e) => setVariable(name, e.target.value)} />
            <button type="button" className="icon-button" aria-label={`Remove ${name}`} onClick={() => removeVariable(name)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {detected.map((name) => <button key={name} type="button" className="secondary-button" onClick={() => setVariable(name, '')}><Plus className="h-4 w-4" /> {name}</button>)}
          <button type="button" className="secondary-button" onClick={() => setVariable(`var${names.length + 1}`, '')}><Plus className="h-4 w-4" /> Add variable</button>
        </div>
      </section>
    </div>
  )
}
