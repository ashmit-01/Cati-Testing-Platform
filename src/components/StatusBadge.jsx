const STYLES = {
  completed: 'bg-success/10 text-success border-success/30',
  passed: 'bg-success/10 text-success border-success/30',
  failed: 'bg-failure/10 text-failure border-failure/30',
  running: 'bg-info/10 text-info border-info/30',
  queued: 'bg-info/10 text-info border-info/30',
  skipped: 'bg-secondary/10 text-secondary border-secondary/30'
}

export default function StatusBadge({ status }) {
  const key = String(status).toLowerCase()
  const style = STYLES[key] || STYLES.skipped
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {status}
    </span>
  )
}
