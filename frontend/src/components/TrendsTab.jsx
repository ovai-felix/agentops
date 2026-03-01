import { useEffect, useState, useMemo } from 'react'
import { useTheme } from '../hooks/useTheme'
import { fetchJSON } from '../api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from 'recharts'

const METRIC_GROUPS = [
  {
    title: 'Model Performance',
    metrics: [
      { key: 'f1_score', label: 'F1 Score', color: '#3b82f6', threshold: { y: 0.88, label: 'Min' } },
      { key: 'precision_score', label: 'Precision', color: '#8b5cf6' },
      { key: 'recall_score', label: 'Recall', color: '#06b6d4' },
      { key: 'auc_roc', label: 'AUC-ROC', color: '#10b981' },
    ],
  },
  {
    title: 'Latency',
    unit: 'ms',
    metrics: [
      { key: 'latency_p50_ms', label: 'P50', color: '#10b981' },
      { key: 'latency_p95_ms', label: 'P95', color: '#f59e0b' },
      { key: 'latency_p99_ms', label: 'P99', color: '#ef4444', threshold: { y: 500, label: 'SLA' } },
    ],
  },
  {
    title: 'Volume & Anomalies',
    metrics: [
      { key: 'prediction_count', label: 'Prediction Count', color: '#6366f1', area: true },
      { key: 'anomaly_rate', label: 'Anomaly Rate', color: '#ef4444', threshold: { y: 0.05, label: 'Alert' } },
      { key: 'drift_score', label: 'Drift Score', color: '#f59e0b', threshold: { y: 0.25, label: 'Threshold' } },
    ],
  },
]

const ALL_METRICS = METRIC_GROUPS.flatMap(g => g.metrics)

const TIME_RANGES = [
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
]

function formatTime(ts, hours) {
  const d = new Date(ts)
  if (hours <= 48) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/* ---------- Single trend chart ---------- */
function TrendChart({ data, metric, hours, dark, t }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#475569' : '#94a3b8', fontSize: 12 }}>
        No data available
      </div>
    )
  }

  const chartData = data.map(d => ({
    time: formatTime(d.ts, hours),
    value: d.value,
  }))

  const Chart = metric.area ? AreaChart : LineChart

  return (
    <ResponsiveContainer width="100%" height={180}>
      <Chart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
        <XAxis
          dataKey="time"
          tick={{ fill: t.tickFill, fontSize: 10 }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fill: t.tickFill, fontSize: 10 }}
          width={45}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: t.tooltipBg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: t.tooltipLabel }}
          itemStyle={{ color: metric.color }}
          formatter={v => [typeof v === 'number' ? v.toFixed(4) : v, metric.label]}
        />
        {metric.threshold && (
          <ReferenceLine
            y={metric.threshold.y}
            stroke="#EAB308"
            strokeDasharray="5 5"
            label={{ value: metric.threshold.label, fill: '#EAB308', fontSize: 10 }}
          />
        )}
        {metric.area ? (
          <Area
            type="monotone"
            dataKey="value"
            stroke={metric.color}
            strokeWidth={2}
            fill={metric.color}
            fillOpacity={0.1}
          />
        ) : (
          <Line
            type="monotone"
            dataKey="value"
            stroke={metric.color}
            strokeWidth={2}
            dot={false}
          />
        )}
      </Chart>
    </ResponsiveContainer>
  )
}

/* ---------- Sparkline summary for metric ---------- */
function MetricSummary({ data, metric, dark }) {
  if (!data || data.length === 0) return null
  const latest = data[data.length - 1]?.value
  const first = data[0]?.value
  const delta = latest - first
  const pctChange = first !== 0 ? ((delta / Math.abs(first)) * 100) : 0
  const isUp = delta > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 18,
        fontWeight: 700,
        color: dark ? '#f8fafc' : '#0f172a',
      }}>
        {typeof latest === 'number' ? (latest >= 100 ? Math.round(latest).toLocaleString() : latest.toFixed(4)) : '—'}
      </span>
      {data.length > 1 && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 4,
          background: isUp
            ? (metric.key.includes('latency') || metric.key === 'drift_score' || metric.key === 'anomaly_rate'
              ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)')
            : (metric.key.includes('latency') || metric.key === 'drift_score' || metric.key === 'anomaly_rate'
              ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'),
          color: isUp
            ? (metric.key.includes('latency') || metric.key === 'drift_score' || metric.key === 'anomaly_rate'
              ? '#ef4444' : '#10b981')
            : (metric.key.includes('latency') || metric.key === 'drift_score' || metric.key === 'anomaly_rate'
              ? '#10b981' : '#ef4444'),
        }}>
          {isUp ? '↑' : '↓'} {Math.abs(pctChange).toFixed(1)}%
        </span>
      )}
    </div>
  )
}

/* ========== Main Component ========== */
export default function TrendsTab() {
  const { dark, ...t } = useTheme()
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(48)
  const [trendData, setTrendData] = useState({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const results = await Promise.all(
          ALL_METRICS.map(m =>
            fetchJSON(`/api/metrics/trend/${m.key}?hours=${hours}`)
              .then(d => [m.key, Array.isArray(d) ? d : []])
              .catch(() => [m.key, []])
          )
        )
        if (!cancelled) {
          setTrendData(Object.fromEntries(results))
        }
      } catch (err) {
        console.error('Failed to load trends:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [hours])

  const activeRange = TIME_RANGES.find(r => r.hours === hours)

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header + Time Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{
            fontSize: 22,
            fontWeight: 800,
            color: dark ? '#f8fafc' : '#0f172a',
            margin: 0,
            letterSpacing: -0.5,
          }}>
            Metric Trends
          </h2>
          <p style={{ fontSize: 12, color: dark ? '#64748b' : '#94a3b8', marginTop: 4 }}>
            {ALL_METRICS.length} metrics · {activeRange?.label || '48h'} window
          </p>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map(r => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${hours === r.hours ? (dark ? '#334155' : '#cbd5e1') : 'transparent'}`,
                background: hours === r.hours ? (dark ? '#1a1a2e' : '#f1f5f9') : 'transparent',
                color: hours === r.hours ? (dark ? '#e2e8f0' : '#0f172a') : (dark ? '#64748b' : '#94a3b8'),
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: dark ? '#64748b' : '#94a3b8' }}>
          Loading trends...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {METRIC_GROUPS.map(group => (
            <div key={group.title}>
              {/* Group header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}>
                <h3 style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: dark ? '#94a3b8' : '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  margin: 0,
                }}>
                  {group.title}
                </h3>
                {group.unit && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: dark ? '#1a1a2e' : '#f1f5f9',
                    color: dark ? '#64748b' : '#94a3b8',
                  }}>
                    {group.unit}
                  </span>
                )}
                <div style={{ flex: 1, height: 1, background: dark ? '#1a1a2e' : '#e5e7eb' }} />
              </div>

              {/* Charts grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(group.metrics.length, 3)}, 1fr)`,
                gap: 14,
              }}>
                {group.metrics.map(metric => (
                  <div
                    key={metric.key}
                    style={{
                      background: dark ? '#0d0d1a' : '#ffffff',
                      border: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
                      borderRadius: 12,
                      padding: '16px 18px',
                    }}
                  >
                    {/* Metric header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: dark ? '#64748b' : '#94a3b8',
                          marginBottom: 4,
                        }}>
                          {metric.label}
                        </div>
                        <MetricSummary data={trendData[metric.key]} metric={metric} dark={dark} />
                      </div>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: metric.color,
                        opacity: 0.7,
                        marginTop: 4,
                      }} />
                    </div>

                    {/* Chart */}
                    <TrendChart
                      data={trendData[metric.key]}
                      metric={metric}
                      hours={hours}
                      dark={dark}
                      t={t}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
