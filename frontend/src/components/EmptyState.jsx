export default function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16">
      <p className="text-sm text-secondary">{message}</p>
    </div>
  )
}
