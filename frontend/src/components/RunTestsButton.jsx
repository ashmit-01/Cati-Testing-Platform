import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Loader2, Check, ChevronDown } from 'lucide-react'
import { startTestRun } from '../services/api.js'

const SUITES = [
  {
    id: 'API',
    label: 'API',
    description: 'REST API and endpoint tests'
  },
  {
    id: 'UI',
    label: 'UI',
    description: 'Browser UI tests'
  },
  {
    id: 'E2E',
    label: 'E2E',
    description: 'End-to-end user workflows'
  },
  {
    id: 'WEBSOCKET',
    label: 'WebSocket',
    description: 'Real-time WebSocket tests'
  },
  {
    id: 'AI_VOICE',
    label: 'AI / Voice',
    description: 'AI and voice functionality'
  }
]

export default function RunTestsButton({ className = '' }) {
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)

  const [environment, setEnvironment] = useState('Production')

  const [selectedSuites, setSelectedSuites] = useState([
    'API',
    'UI',
    'E2E',
    'WEBSOCKET',
    'AI_VOICE'
  ])

  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  // ------------------------------------------------------------
  // Toggle suite
  // ------------------------------------------------------------

  function toggleSuite(suite) {
    setSelectedSuites((current) => {
      if (current.includes(suite)) {
        return current.filter((item) => item !== suite)
      }

      return [...current, suite]
    })
  }

  // ------------------------------------------------------------
  // Select all suites
  // ------------------------------------------------------------

  function selectAll() {
    setSelectedSuites(
      SUITES.map((suite) => suite.id)
    )
  }

  // ------------------------------------------------------------
  // Clear all suites
  // ------------------------------------------------------------

  function clearAll() {
    setSelectedSuites([])
  }

  // ------------------------------------------------------------
  // Start selected tests
  // ------------------------------------------------------------

  async function handleRunTests() {
    if (status === 'starting') {
      return
    }

    if (!environment) {
      setStatus('error')
      setMessage('Please select an environment.')
      return
    }

    if (selectedSuites.length === 0) {
      setStatus('error')
      setMessage('Please select at least one test suite.')
      return
    }

    setStatus('starting')
    setMessage('')

    try {
      const payload = {
        environment,
        suites: selectedSuites
      }

      console.log('Starting test run:', payload)

      const run = await startTestRun(payload)

      console.log('Test run created:', run)

      const runId = run?.runId || run?.id

      if (!runId) {
        throw new Error(
          'Test run was created but no run ID was returned by the backend.'
        )
      }

      setStatus('idle')
      setOpen(false)

      navigate(`/runs/${runId}`)
    } catch (error) {
      console.error(
        'Failed to start test run:',
        error
      )

      setStatus('error')

      setMessage(
        error.message ||
          'Failed to start test run. Please check the QA backend connection.'
      )
    }
  }

  return (
    <div className={className}>

      {/* ========================================================
          MAIN RUN TESTS BUTTON
      ======================================================== */}

      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current)
          setStatus('idle')
          setMessage('')
        }}
        className="inline-flex items-center gap-2 rounded-md bg-info px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info/90"
      >
        <Play className="h-4 w-4" />

        {open ? 'Close' : 'Run Tests'}
      </button>

      {/* ========================================================
          TEST SELECTION PANEL
      ======================================================== */}

      {open && (
        <div className="mt-4 w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl">

          {/* ----------------------------------------------------
              HEADER
          ----------------------------------------------------- */}

          <div className="mb-5">
            <h2 className="text-base font-semibold text-primary">
              Select Tests to Run
            </h2>

            <p className="mt-1 text-sm text-secondary">
              Choose the environment and test suites you want to execute.
            </p>
          </div>

          {/* ----------------------------------------------------
              ENVIRONMENT
          ----------------------------------------------------- */}

          <div className="mb-6">

            <label
              htmlFor="environment"
              className="mb-2 block text-sm font-medium text-primary"
            >
              Environment
            </label>

            <div className="relative">

              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                disabled={status === 'starting'}
                style={{
                  colorScheme: 'dark'
                }}
                className="w-full appearance-none rounded-md border border-border bg-[#111827] px-3 py-2.5 pr-10 text-sm text-white outline-none transition-colors focus:border-info disabled:cursor-not-allowed disabled:opacity-60"
              >

                <option
                  value="staging"
                  className="bg-[#111827] text-white"
                >
                  Staging
                </option>

                <option
                  value="production"
                  className="bg-[#111827] text-white"
                >
                  Production
                </option>

                <option
                  value="development"
                  className="bg-[#111827] text-white"
                >
                  Development
                </option>

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />

            </div>

          </div>

          {/* ----------------------------------------------------
              TEST SUITES HEADER
          ----------------------------------------------------- */}

          <div className="mb-3 flex items-center justify-between">

            <div>

              <h3 className="text-sm font-semibold text-primary">
                Test Suites
              </h3>

              <p className="text-xs text-secondary">
                {selectedSuites.length} of {SUITES.length} selected
              </p>

            </div>

            <div className="flex gap-3 text-xs">

              <button
                type="button"
                onClick={selectAll}
                disabled={status === 'starting'}
                className="font-medium text-info hover:underline disabled:opacity-50"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={clearAll}
                disabled={status === 'starting'}
                className="font-medium text-secondary hover:text-primary disabled:opacity-50"
              >
                Clear
              </button>

            </div>

          </div>

          {/* ----------------------------------------------------
              SUITE OPTIONS
          ----------------------------------------------------- */}

          <div className="space-y-2">

            {SUITES.map((suite) => {

              const selected =
                selectedSuites.includes(suite.id)

              return (
                <button
                  key={suite.id}
                  type="button"
                  onClick={() =>
                    toggleSuite(suite.id)
                  }
                  disabled={status === 'starting'}
                  className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors ${
                    selected
                      ? 'border-info bg-info/10'
                      : 'border-border bg-background hover:border-info/50'
                  } ${
                    status === 'starting'
                      ? 'cursor-not-allowed opacity-60'
                      : ''
                  }`}
                >

                  {/* Suite information */}

                  <div>

                    <div className="text-sm font-medium text-primary">
                      {suite.label}
                    </div>

                    <div className="mt-0.5 text-xs text-secondary">
                      {suite.description}
                    </div>

                  </div>

                  {/* Checkbox */}

                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? 'border-info bg-info'
                        : 'border-secondary/50 bg-transparent'
                    }`}
                  >

                    {selected && (
                      <Check className="h-3.5 w-3.5 text-white" />
                    )}

                  </div>

                </button>
              )
            })}

          </div>

          {/* ----------------------------------------------------
              ERROR MESSAGE
          ----------------------------------------------------- */}

          {status === 'error' && (
            <div className="mt-4 rounded-md border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure">
              {message}
            </div>
          )}

          {/* ----------------------------------------------------
              FOOTER BUTTONS
          ----------------------------------------------------- */}

          <div className="mt-5 flex justify-end gap-3">

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setStatus('idle')
                setMessage('')
              }}
              disabled={status === 'starting'}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleRunTests}
              disabled={
                status === 'starting' ||
                selectedSuites.length === 0
              }
              className="inline-flex items-center gap-2 rounded-md bg-info px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-info/90 disabled:cursor-not-allowed disabled:opacity-60"
            >

              {status === 'starting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Selected Tests
                </>
              )}

            </button>

          </div>

        </div>
      )}

    </div>
  )
}