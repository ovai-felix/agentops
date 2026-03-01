import { useApp } from '../context/AppContext'

export function useTheme() {
  const { state } = useApp()
  const dark = state.theme === 'dark'
  return {
    dark,
    card: dark ? 'bg-gray-900' : 'bg-white shadow-sm',
    heading: dark ? 'text-white' : 'text-gray-900',
    text: dark ? 'text-gray-300' : 'text-gray-700',
    textMuted: dark ? 'text-gray-400' : 'text-gray-500',
    textFaint: dark ? 'text-gray-500' : 'text-gray-400',
    textDimmest: dark ? 'text-gray-600' : 'text-gray-300',
    border: dark ? 'border-gray-800' : 'border-gray-200',
    borderFaint: dark ? 'border-gray-800/50' : 'border-gray-100',
    input: dark
      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    progressBg: dark ? 'bg-gray-800' : 'bg-gray-200',
    hoverBg: dark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50',
    tooltipBg: dark ? '#1F2937' : '#ffffff',
    tooltipBorder: dark ? '#374151' : '#e5e7eb',
    tooltipLabel: dark ? '#9CA3AF' : '#6B7280',
    gridStroke: dark ? '#374151' : '#e5e7eb',
    tickFill: dark ? '#9CA3AF' : '#6B7280',
  }
}
