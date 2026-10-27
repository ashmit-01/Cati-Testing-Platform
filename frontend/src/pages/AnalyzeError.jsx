
import ManualErrorAnalysis from '../components/ManualErrorAnalysis.jsx'

export default function AnalyzeError() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-primary">Analyse Error</h2>
        <p className="text-sm text-secondary">
          Hit an error in CATI AI? Paste a screenshot or the error text to
          see what it is and where it comes from.
        </p>
      </div>

      <ManualErrorAnalysis />
    </div>
  )
}



