import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import Sparkline from './Sparkline'
import ThresholdBar from './ThresholdBar'

const statusColors = {
  healthy: { text: 'text-green-400', bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  warning: { text: 'text-yellow-400', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  critical: { text: 'text-red-400', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
}

export default function MetricCard({
  title,
  value,
  unit,
  status = 'healthy',
  baseline,
  delta,
  deltaDir,
  sparkData,
  thresholdBar,
}) {
  const { dark } = useTheme()
  const [hovered, setHovered] = useState(false)
  const sc = statusColors[status] || statusColors.healthy
  const isCritical = status === 'critical'

  const deltaBad = (deltaDir === 'down' && title === 'F1 Score') || (deltaDir === 'up' && title === 'Drift Score')
  const deltaColor = deltaBad ? '#ef4444' : '#10b981'
  const deltaBg = deltaBad ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'

  const cardBg = dark
    ? isCritical ? 'rgba(239,68,68,0.04)' : '#0d0d1a'
    : isCritical ? 'rgba(239,68,68,0.03)' : '#ffffff'
  const cardBorder = dark
    ? isCritical ? 'rgba(239,68,68,0.25)' : '#1a1a2e'
    : isCritical ? 'rgba(239,68,68,0.3)' : '#e5e7eb'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl transition-all duration-200"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        padding: '16px 18px',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? dark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)'
          : 'none',
        ...(isCritical ? {
          animation: 'criticalGlow 3s ease infinite',
        } : {}),
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className={`text-[10px] uppercase tracking-wider mb-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            {title}
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-[28px] font-extrabold leading-none tracking-tight"
              style={{ color: isCritical ? '#fca5a5' : dark ? '#f8fafc' : '#0f172a' }}
            >
              {value != null ? value : '\u2014'}
            </span>
            {unit && <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{unit}</span>}
          </div>
        </div>
        {delta && (
          <div
            className="text-[10px] font-semibold rounded px-1.5 py-0.5"
            style={{ color: deltaColor, background: deltaBg }}
          >
            {delta}
          </div>
        )}
      </div>

      {sparkData && sparkData.length > 1 && (
        <Sparkline data={sparkData} color={sc.color} critical={isCritical} />
      )}

      <div className={`flex justify-between mt-2 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
        <span className="text-[9px]">
          Baseline: {baseline}{unit || ''}
        </span>
        <span
          className="text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: sc.color }}
        >
          {status}
        </span>
      </div>

      {thresholdBar && <ThresholdBar {...thresholdBar} />}
    </div>
  )
}
