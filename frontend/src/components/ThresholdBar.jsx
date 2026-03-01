import { useTheme } from '../hooks/useTheme'

export default function ThresholdBar({ value, baseline, threshold, invert = false }) {
  const { dark } = useTheme()
  const maxVal = Math.max(value, baseline, threshold || 0) * 1.2
  const pct = (value / maxVal) * 100
  const basePct = (baseline / maxVal) * 100
  const threshPct = threshold ? (threshold / maxVal) * 100 : null
  const isBad = invert ? value > threshold : value < threshold
  const barColor = isBad ? '#ef4444' : '#10b981'
  const trackBg = dark ? '#1a1a2e' : '#e2e8f0'

  return (
    <div className="relative mt-2" style={{ height: 6 }}>
      <div className="absolute inset-0 rounded-sm" style={{ background: trackBg }} />
      <div
        className="absolute top-0 left-0 h-full rounded-sm transition-all duration-1000"
        style={{ width: `${pct}%`, background: barColor }}
      />
      <div
        className="absolute rounded-sm"
        style={{ left: `${basePct}%`, top: -2, width: 2, height: 10, background: '#64748b' }}
        title={`Baseline: ${baseline}`}
      />
      {threshPct != null && (
        <div
          className="absolute rounded-sm"
          style={{ left: `${threshPct}%`, top: -2, width: 2, height: 10, background: '#f59e0b' }}
          title={`Threshold: ${threshold}`}
        />
      )}
    </div>
  )
}
