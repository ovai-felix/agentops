const styles = {
  critical: 'bg-red-900/50 text-red-300 border-red-700',
  warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  info: 'bg-blue-900/50 text-blue-300 border-blue-700',
}

export default function SeverityBadge({ severity }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${styles[severity] || styles.info}`}>
      {severity?.toUpperCase()}
    </span>
  )
}
