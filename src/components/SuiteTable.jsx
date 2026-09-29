function passRateOf(s) {
  return s.total > 0 ? ((s.passed / s.total) * 100).toFixed(1) : '0.0'
}

export default function SuiteTable({ suites }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card scrollbar-thin">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-secondary">
            <th className="px-4 py-3 font-medium">Suite</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Passed</th>
            <th className="px-4 py-3 font-medium">Failed</th>
            <th className="px-4 py-3 font-medium">Pass Rate</th>
          </tr>
        </thead>
        <tbody>
          {suites.map((s) => (
            <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-medium text-primary">{s.name}</td>
              <td className="px-4 py-3 text-secondary">{s.total}</td>
              <td className="px-4 py-3 text-success">{s.passed}</td>
              <td className="px-4 py-3 text-failure">{s.failed}</td>
              <td className="px-4 py-3 text-secondary">{passRateOf(s)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
