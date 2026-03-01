import { useTheme } from '../hooks/useTheme'

function getLevel(confidence) {
  if (confidence >= 0.8) return { label: 'High', color: 'green' }
  if (confidence >= 0.5) return { label: 'Medium', color: 'yellow' }
  return { label: 'Low', color: 'red' }
}

const darkColors = {
  green: 'bg-green-900/50 text-green-300 border-green-700',
  yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  red: 'bg-red-900/50 text-red-300 border-red-700',
}

const lightColors = {
  green: 'bg-green-100 text-green-700 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  red: 'bg-red-100 text-red-700 border-red-300',
}

const barColors = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

export default function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null

  const pct = Math.round(confidence * 100)
  const { label, color } = getLevel(confidence)
  const { dark } = useTheme()
  const palette = dark ? darkColors : lightColors

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${palette[color]}`}>
      <span>{label} {pct}%</span>
      <div className={`w-12 h-1.5 rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-200'} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${barColors[color]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
