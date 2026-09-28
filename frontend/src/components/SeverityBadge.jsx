const STYLES = {
  critical: 'bg-failure/15 text-failure border-failure/40',
  high: 'bg-warning/15 text-warning border-warning/40',
  medium: 'bg-info/15 text-info border-info/40',
  low: 'bg-secondary/15 text-secondary border-secondary/40'
}

export default function SeverityBadge({ severity }) {
  const key = String(severity).toLowerCase()
  const style = STYLES[key] || STYLES.low
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {severity}
    </span>
  )
}
