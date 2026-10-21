const ACCENTS = {
  default: 'text-primary',
  success: 'text-success',
  failure: 'text-failure',
  warning: 'text-warning',
  info: 'text-info'
}

export default function StatCard({ label, value, accent = 'default', suffix = '' }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-secondary">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${ACCENTS[accent] || ACCENTS.default}`}>
        {value}
        {suffix && <span className="text-base font-semibold">{suffix}</span>}
      </p>
    </div>
  )
}
