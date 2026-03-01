import { useTheme } from '../hooks/useTheme'

const darkStyles = {
  critical: 'bg-red-900/50 text-red-300 border-red-700',
  warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  info: 'bg-blue-900/50 text-blue-300 border-blue-700',
}

const lightStyles = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  info: 'bg-blue-100 text-blue-700 border-blue-300',
}

export default function SeverityBadge({ severity }) {
  const { dark } = useTheme()
  const styles = dark ? darkStyles : lightStyles
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${styles[severity] || styles.info}`}>
      {severity?.toUpperCase()}
    </span>
  )
}
