export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-secondary">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-secondary/30 border-t-info" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
