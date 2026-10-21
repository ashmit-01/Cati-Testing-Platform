export default function ErrorState({
  title = 'Something went wrong.',
  message = 'Please check the QA backend connection.',
  onRetry
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-failure/30 bg-card px-6 py-16 text-center">
      <p className="text-sm font-semibold text-failure">{title}</p>
      <p className="max-w-sm text-sm text-secondary">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-info hover:text-info"
        >
          Retry
        </button>
      )}
    </div>
  )
}
