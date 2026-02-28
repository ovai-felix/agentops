const borderColors = {
  healthy: 'border-green-500',
  warning: 'border-yellow-500',
  critical: 'border-red-500',
}

const statusLabels = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
}

const statusTextColors = {
  healthy: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
}

export default function MetricCard({ title, value, unit, status = 'healthy', subtitle }) {
  return (
    <div className={`bg-gray-900 rounded-lg p-5 border-l-4 ${borderColors[status] || 'border-gray-600'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-400">{title}</span>
        <span className={`text-xs font-medium ${statusTextColors[status] || 'text-gray-500'}`}>
          {statusLabels[status] || status}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white">
          {value != null ? value : '—'}
        </span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  )
}
