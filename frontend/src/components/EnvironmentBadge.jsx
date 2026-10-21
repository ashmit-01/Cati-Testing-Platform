export default function EnvironmentBadge({ environment = 'PRODUCTION', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium text-secondary ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {environment}
    </span>
  )
}
