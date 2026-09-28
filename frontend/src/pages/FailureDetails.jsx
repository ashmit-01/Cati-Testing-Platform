import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  FileText,
  RefreshCw,
  Video
} from 'lucide-react'

import {
  getFailure,
  getTestResult,
  getTestRun
} from '../services/api.js'


// ============================================================
// HELPERS
// ============================================================


function evidenceToUrl(value) {
  if (!value) {
    return null
  }

  const raw = String(value)

  // Already a browser URL
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://')
  ) {
    return raw
  }

  // Normalize Windows paths
  const normalized = raw.replaceAll('\\', '/')

  // Find the test-results folder
  const marker = '/test-results/'

  const index = normalized.indexOf(marker)

  if (index === -1) {
    return null
  }

  const relativePath =
    normalized.slice(
      index + marker.length
    )

  return `http://localhost:5001/test-results/${relativePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

function extractFailure(response) {
  return (
    response?.failure ||
    response?.data ||
    response ||
    null
  )
}


function extractResult(response) {
  return (
    response?.result ||
    response?.testResult ||
    response?.data ||
    response ||
    null
  )
}


function extractRun(response) {
  return (
    response?.run ||
    response?.data ||
    response ||
    null
  )
}


/*
 * Safely convert anything from MongoDB/API
 * into something React can render.
 */
function safeText(value, fallback = 'Not available') {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}


function normalizeSuite(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 'Not available'
  }

  if (typeof value === 'object') {
    return safeText(value)
  }

  const suite = String(value).toUpperCase()

  if (suite === 'AI_VOICE') {
    return 'AI / Voice'
  }

  if (suite === 'WEBSOCKET') {
    return 'WebSocket'
  }

  return suite
}


function getEvidenceValue(
  evidence,
  type
) {
  if (!evidence) {
    return null
  }

  const value = evidence[type]

  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object') {
    return (
      value.url ||
      value.path ||
      value.href ||
      value.location ||
      null
    )
  }

  return null
}


// ============================================================
// BADGES
// ============================================================

function Badge({
  children,
  type = 'default'
}) {
  const styles = {
    default:
      'border-gray-600 bg-gray-800 text-gray-300',

    open:
      'border-gray-600 bg-gray-800 text-gray-300',

    resolved:
      'border-green-500/40 bg-green-500/10 text-green-400',

    ignored:
      'border-gray-500/40 bg-gray-500/10 text-gray-400',

    medium:
      'border-blue-500/40 bg-blue-500/10 text-blue-400',

    high:
      'border-orange-500/40 bg-orange-500/10 text-orange-400',

    critical:
      'border-red-500/40 bg-red-500/10 text-red-400',

    low:
      'border-gray-500/40 bg-gray-500/10 text-gray-400'
  }

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${
        styles[type] || styles.default
      }`}
    >
      {safeText(children)}
    </span>
  )
}


function SeverityBadge({ severity }) {
  const value =
    String(severity || 'MEDIUM').toUpperCase()

  let type = 'medium'

  if (value === 'CRITICAL') {
    type = 'critical'
  } else if (value === 'HIGH') {
    type = 'high'
  } else if (value === 'LOW') {
    type = 'low'
  }

  return (
    <Badge type={type}>
      {value}
    </Badge>
  )
}


function StatusBadgeLocal({ status }) {
  const value =
    String(status || 'OPEN').toUpperCase()

  let type = 'open'

  if (value === 'RESOLVED') {
    type = 'resolved'
  } else if (value === 'IGNORED') {
    type = 'ignored'
  }

  return (
    <Badge type={type}>
      {value}
    </Badge>
  )
}


// ============================================================
// EVIDENCE CARD
// ============================================================
function EvidenceCard({
  icon: Icon,
  title,
  value,
  type
}) {
  const url = evidenceToUrl(value)

  const handleView = () => {
    if (!url) {
      return
    }

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#111827] px-4 py-4">

      <div className="flex min-w-0 items-center gap-3">

        <Icon className="h-5 w-5 shrink-0 text-gray-400" />

        <div className="min-w-0">

          <p className="text-sm font-medium text-white">
            {title}
          </p>

          {value ? (
            <p className="mt-1 truncate text-xs text-gray-500">
              {String(value)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-600">
              Not available
            </p>
          )}

        </div>

      </div>

      <button
        type="button"
        disabled={!url}
        onClick={handleView}
        className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition hover:border-blue-500 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        View
      </button>

    </div>
  )
}

// ============================================================
// MAIN
// ============================================================

export default function FailureDetails() {

  const { id } = useParams()

  const navigate = useNavigate()

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [failure, setFailure] =
    useState(null)

  const [result, setResult] =
    useState(null)

  const [run, setRun] =
    useState(null)


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadFailure = useCallback(
    async () => {

      if (!id) {

        setError(
          'Failure ID is missing.'
        )

        setLoading(false)

        return
      }

      try {

        setLoading(true)
        setError('')


        // ====================================================
        // 1. LOAD FAILURE
        // ====================================================

        const failureResponse =
          await getFailure(id)

        const failureData =
          extractFailure(
            failureResponse
          )

        if (!failureData) {
          throw new Error(
            'Failure record was not returned by the backend.'
          )
        }

        console.log(
          'Failure response:',
          failureData
        )

        setFailure(
          failureData
        )


        // ====================================================
        // 2. TEST RESULT
        // ====================================================

        /*
         * IMPORTANT:
         *
         * Your backend is already returning:
         *
         * testResultId: {
         *   _id,
         *   testName,
         *   suite,
         *   expected,
         *   actual,
         *   endpoint,
         *   evidence,
         *   ...
         * }
         *
         * Therefore DON'T call:
         *
         * getTestResult(object)
         *
         * because that causes the 404.
         */

        if (
          failureData.testResultId &&
          typeof failureData.testResultId === 'object'
        ) {

          console.log(
            'Using populated TestResult directly:',
            failureData.testResultId
          )

          setResult(
            failureData.testResultId
          )

        } else if (
          failureData.testResultId
        ) {

          /*
           * Fallback for cases where the backend
           * returns only the ObjectId.
           */

          try {

            const resultResponse =
              await getTestResult(
                failureData.testResultId
              )

            const resultData =
              extractResult(
                resultResponse
              )

            setResult(
              resultData
            )

          } catch (resultError) {

            console.warn(
              'TestResult could not be loaded:',
              resultError
            )

            setResult(null)
          }
        }


        // ====================================================
        // 3. TEST RUN
        // ====================================================

        if (
          failureData.runId
        ) {

          try {

            const runResponse =
              await getTestRun(
                failureData.runId
              )

            const runData =
              extractRun(
                runResponse
              )

            console.log(
              'TestRun response:',
              runData
            )

            setRun(
              runData
            )

          } catch (runError) {

            console.warn(
              'TestRun could not be loaded:',
              runError
            )

            setRun(null)
          }
        }

      } catch (err) {

        console.error(
          'Failure details error:',
          err
        )

        setError(
          err?.message ||
          'Failed to load failure details.'
        )

      } finally {

        setLoading(false)
      }

    },
    [id]
  )


  useEffect(() => {
    loadFailure()
  }, [loadFailure])


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <div className="flex min-h-[70vh] items-center justify-center">

        <div className="text-center">

          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />

          <p className="text-sm text-gray-400">
            Loading failure details...
          </p>

        </div>

      </div>
    )
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {

    return (
      <div className="flex min-h-[70vh] items-center justify-center">

        <div className="max-w-lg rounded-lg border border-red-500/30 bg-[#111827] p-6 text-center">

          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-red-400" />

          <h2 className="text-lg font-semibold text-white">
            Failed to load failure
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            {safeText(error)}
          </p>

          <div className="mt-5 flex justify-center gap-3">

            <button
              type="button"
              onClick={loadFailure}
              className="inline-flex items-center gap-2 rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-blue-500 hover:text-blue-400"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>

            <Link
              to="/failures"
              className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-blue-500 hover:text-blue-400"
            >
              Back to failures
            </Link>

          </div>

        </div>

      </div>
    )
  }


  // ==========================================================
  // NORMALIZED DATA
  // ==========================================================

  const testName =
    safeText(
      result?.testName ||
      failure?.testName ||
      failure?.title,
      'Unnamed test'
    )


  const suite =
    normalizeSuite(
      result?.suite ||
      failure?.suite ||
      failure?.category
    )


  const environment =
    safeText(
      result?.environment ||
      run?.environment ||
      failure?.environment,
      'Not available'
    )


  const severity =
    safeText(
      failure?.severity,
      'MEDIUM'
    )


  const status =
    safeText(
      failure?.status,
      'OPEN'
    )


  const category =
    safeText(
      failure?.category,
      'OTHER'
    )


  // ==========================================================
  // IMPORTANT TEST RESULT FIELDS
  // ==========================================================

  const expected =
    safeText(
      result?.expected ||
      failure?.expected,
      'Not available'
    )


  const actual =
    safeText(
      result?.actual ||
      failure?.actual,
      'Not available'
    )


  const endpoint =
    safeText(
      result?.endpoint ||
      result?.url ||
      result?.page ||
      failure?.endpoint ||
      failure?.page,
      'Not available'
    )


  const description =
    safeText(
      failure?.description ||
      failure?.error ||
      result?.error,
      'No failure description available.'
    )


  // ==========================================================
  // EVIDENCE
  // ==========================================================

  const evidence =
    result?.evidence ||
    failure?.evidence ||
    {}


  const screenshot =
    getEvidenceValue(
      evidence,
      'screenshot'
    )


  const trace =
    getEvidenceValue(
      evidence,
      'trace'
    )


  const video =
    getEvidenceValue(
      evidence,
      'video'
    )


  // ==========================================================
  // OTHER DATA
  // ==========================================================

  const failureId =
    safeText(
      failure?._id ||
      failure?.id ||
      id
    )


  const runId =
    safeText(
      failure?.runId ||
      run?.runId
    )


  const testResultId =
    safeText(
      result?._id ||
      failure?.testResultId
    )


  const duration =
    result?.duration ??
    failure?.duration ??
    null


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6">

      {/* ==================================================== */}
      {/* BACK */}
      {/* ==================================================== */}

      <Link
        to="/failures"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to failures
      </Link>


      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}

      <div className="flex flex-col justify-between gap-4 md:flex-row">

        <div className="min-w-0">

          <div className="flex items-start gap-3">

            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-400" />

            <div className="min-w-0">

              <h1 className="break-words text-xl font-bold text-white">
                {testName}
              </h1>

              <p className="mt-1 break-all text-xs text-gray-500">
                Failure ID: {failureId}
              </p>

            </div>

          </div>

        </div>


        <div className="flex shrink-0 items-center gap-2">

          <StatusBadgeLocal
            status={status}
          />

          <SeverityBadge
            severity={severity}
          />

        </div>

      </div>


      {/* ==================================================== */}
      {/* SUMMARY */}
      {/* ==================================================== */}

      <div className="rounded-lg border border-gray-700 bg-[#111827] p-5">

        <div className="grid gap-6 md:grid-cols-5">

          <div className="min-w-0">

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Test
            </p>

            <p className="mt-2 break-words text-sm text-white">
              {testName}
            </p>

          </div>


          <div>

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Status
            </p>

            <div className="mt-2">
              <StatusBadgeLocal
                status={status}
              />
            </div>

          </div>


          <div>

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Severity
            </p>

            <div className="mt-2">
              <SeverityBadge
                severity={severity}
              />
            </div>

          </div>


          <div>

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Suite
            </p>

            <p className="mt-2 break-words text-sm text-white">
              {suite}
            </p>

          </div>


          <div>

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Environment
            </p>

            <p className="mt-2 text-sm uppercase text-white">
              {environment}
            </p>

          </div>

        </div>

      </div>


      {/* ==================================================== */}
      {/* CATEGORY / RUN */}
      {/* ==================================================== */}

      <div className="rounded-lg border border-gray-700 bg-[#111827] p-5">

        <div className="grid gap-6 md:grid-cols-2">

          <div>

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Failure Category
            </p>

            <p className="mt-2 break-words text-sm text-white">
              {category}
            </p>

          </div>


          <div>

            <p className="text-xs uppercase tracking-wide text-gray-500">
              Test Run
            </p>

            {runId !== 'Not available' ? (

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/runs/${encodeURIComponent(runId)}`
                  )
                }
                className="mt-2 text-sm text-blue-400 hover:underline"
              >
                {runId}
              </button>

            ) : (

              <p className="mt-2 text-sm text-gray-500">
                Not available
              </p>

            )}

          </div>

        </div>

      </div>


      {/* ==================================================== */}
      {/* DESCRIPTION */}
      {/* ==================================================== */}

      <div className="rounded-lg border border-gray-700 bg-[#111827] p-5">

        <h2 className="text-sm font-semibold text-white">
          Failure Description
        </h2>

        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-gray-700 bg-[#0b1220] p-4 text-sm text-gray-300">
          {description}
        </pre>

      </div>


      {/* ==================================================== */}
      {/* EXPECTED / ACTUAL */}
      {/* ==================================================== */}

      <div className="grid gap-4 md:grid-cols-2">

        <div className="rounded-lg border border-gray-700 bg-[#111827] p-5">

          <p className="text-xs uppercase tracking-wide text-gray-500">
            Expected
          </p>

          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#0b1220] p-4 text-sm text-gray-300">
            {expected}
          </pre>

        </div>


        <div className="rounded-lg border border-red-500/30 bg-[#111827] p-5">

          <p className="text-xs uppercase tracking-wide text-gray-500">
            Actual
          </p>

          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#0b1220] p-4 text-sm text-gray-300">
            {actual}
          </pre>

        </div>

      </div>


      {/* ==================================================== */}
      {/* ENDPOINT */}
      {/* ==================================================== */}

      <div className="rounded-lg border border-gray-700 bg-[#111827] p-5">

        <p className="text-xs uppercase tracking-wide text-gray-500">
          Endpoint / Page
        </p>

        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#0b1220] p-4 text-sm text-gray-300">
          {endpoint}
        </pre>

      </div>


      {/* ==================================================== */}
      {/* EVIDENCE */}
      {/* ==================================================== */}

      <section>

        <div className="mb-3 flex items-center justify-between">

          <h2 className="text-sm font-semibold text-white">
            Evidence
          </h2>

          <button
            type="button"
            onClick={loadFailure}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

        </div>


        <div className="grid gap-3 md:grid-cols-2">

          <EvidenceCard
            icon={Camera}
            title="Screenshot"
            value={screenshot}
          />

          <EvidenceCard
            icon={FileText}
            title="Trace"
            value={trace}
          />

          <EvidenceCard
            icon={Video}
            title="Video"
            value={video}
          />

        </div>

      </section>


      {/* ==================================================== */}
      {/* EXECUTION INFORMATION */}
      {/* ==================================================== */}

      <div className="rounded-lg border border-gray-700 bg-[#111827] p-5">

        <h2 className="mb-4 text-sm font-semibold text-white">
          Execution Information
        </h2>

        <div className="grid gap-5 md:grid-cols-4">

          <div>

            <p className="text-xs text-gray-500">
              Test Result ID
            </p>

            <p className="mt-1 break-all text-sm text-gray-300">
              {testResultId}
            </p>

          </div>


          <div>

            <p className="text-xs text-gray-500">
              Duration
            </p>

            <p className="mt-1 text-sm text-gray-300">
              {duration !== null
                ? `${duration} ms`
                : 'Not available'}
            </p>

          </div>


          <div>

            <p className="text-xs text-gray-500">
              Created
            </p>

            <p className="mt-1 text-sm text-gray-300">
              {failure?.createdAt
                ? new Date(
                    failure.createdAt
                  ).toLocaleString()
                : 'Not available'}
            </p>

          </div>


          <div>

            <p className="text-xs text-gray-500">
              Environment
            </p>

            <p className="mt-1 text-sm uppercase text-gray-300">
              {environment}
            </p>

          </div>

        </div>

      </div>


      {/* ==================================================== */}
      {/* BACK */}
      {/* ==================================================== */}

      <Link
        to="/failures"
        className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-[#111827] px-4 py-2 text-sm text-gray-300 hover:border-blue-500 hover:text-blue-400"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to failures
      </Link>

    </div>
  )
}