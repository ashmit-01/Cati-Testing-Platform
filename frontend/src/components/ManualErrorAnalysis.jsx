import { useRef, useState } from 'react'
import { ImagePlus, Sparkles, X } from 'lucide-react'

import { analyzeManualError } from '../services/api.js'

const MAX_IMAGE_SIDE = 1600
const MAX_TEXT_CHARS = 8000

// Reads an image file and returns a JPEG data URL scaled down to
// MAX_IMAGE_SIDE, so large screenshots stay small and fast to analyse.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Could not read the image.'))

    reader.onload = () => {
      const img = new Image()

      img.onerror = () => reject(new Error('This file is not a valid image.'))

      img.onload = () => {
        const scale = Math.min(
          1,
          MAX_IMAGE_SIDE / Math.max(img.width, img.height)
        )

        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }

      img.src = reader.result
    }

    reader.readAsDataURL(file)
  })
}

function ResultField({ label, value }) {
  if (!value) {
    return null
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-200">
        {value}
      </p>
    </div>
  )
}

export default function ManualErrorAnalysis() {
  const fileInputRef = useRef(null)

  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function attachImage(file) {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WebP).')
      return
    }

    try {
      setError('')
      setImage(await fileToDataUrl(file))
    } catch (err) {
      setError(err?.message || 'Could not use this image.')
    }
  }

  // Ctrl+V / Cmd+V of a screenshot anywhere inside this card.
  function handlePaste(event) {
    const item = Array.from(event.clipboardData?.items || []).find(
      (entry) => entry.type.startsWith('image/')
    )

    if (item) {
      event.preventDefault()
      attachImage(item.getAsFile())
    }
  }

  async function handleAnalyze() {
    if (!text.trim() && !image) {
      setError('Paste the error text or add a screenshot first.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setResult(null)

      setResult(
        await analyzeManualError({
          text: text.trim(),
          image
        })
      )
    } catch (err) {
      setError(err?.message || 'Failed to analyse the error.')
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setText('')
    setImage(null)
    setResult(null)
    setError('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <section
      onPaste={handlePaste}
      className="rounded-lg border border-gray-700 bg-[#111827] p-5"
    >

      <div className="flex items-center gap-2">

        <Sparkles className="h-4 w-4 text-blue-400" />

        <h2 className="text-sm font-semibold text-white">
          Analyse an error (screenshot / text)
        </h2>

      </div>

      <p className="mt-2 text-xs text-gray-500">
        Got an error in CATI AI? Paste the error text or a screenshot
        (Ctrl+V works) and the AI will tell you what the error is and
        where it comes from. Screenshots are sent to the AI provider and
        are not saved.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_TEXT_CHARS}
        rows={5}
        placeholder="Paste the error message here..."
        className="mt-4 w-full rounded-md border border-gray-700 bg-[#0b1220] p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => attachImage(e.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition hover:border-blue-500 hover:text-blue-400"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Add screenshot
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={handleAnalyze}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? 'Analysing...' : 'Analyse error'}
        </button>

        {(text || image || result) && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        )}

      </div>

      {image && (
        <div className="relative mt-4 inline-block">

          <img
            src={image}
            alt="Error screenshot"
            className="max-h-48 rounded-md border border-gray-700"
          />

          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label="Remove screenshot"
            className="absolute -right-2 -top-2 rounded-full border border-gray-600 bg-gray-900 p-1 text-gray-300 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>

        </div>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-5 flex items-center gap-3 text-sm text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
          Analysing the error...
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-5">

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Confidence:</span>
            <span className="rounded-md border border-gray-600 bg-gray-800 px-2 py-0.5 font-medium text-gray-200">
              {result.confidence || 'Low'}
            </span>
            {result.model && <span>· Model: {result.model}</span>}
          </div>

          <ResultField label="What the error is" value={result.whatHappened} />

          <ResultField label="Where it comes from" value={result.whereFrom} />

          <ResultField label="Suggested fix" value={result.suggestedFix} />

          <p className="text-xs text-gray-500">
            This is an AI recommendation, not a confirmed root cause.
          </p>

        </div>
      )}

    </section>
  )
}


