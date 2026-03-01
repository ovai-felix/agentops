import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { fetchJSON } from '../api'
import MetricCard from './MetricCard'
import SeverityBadge from './SeverityBadge'

function assessF1(f1) {
  if (f1 == null) return 'healthy'
  if (f1 < 0.83) return 'critical'
  if (f1 < 0.88) return 'warning'
  return 'healthy'
}

function assessDrift(drift) {
  if (drift == null) return 'healthy'
  if (drift > 0.3) return 'critical'
  if (drift > 0.2) return 'warning'
  return 'healthy'
}

function assessLatency(latency) {
  if (latency == null) return 'healthy'
  if (latency > 1000) return 'critical'
  if (latency > 500) return 'warning'
  return 'healthy'
}

function assessNullRate(rate) {
  if (rate == null) return 'healthy'
  if (rate > 0.05) return 'warning'
  return 'healthy'
}

// Compute % delta from first to last value in a trend array
function computeDelta(trend) {
  if (!trend || trend.length < 2) return null
  const first = trend[0].value
  const last = trend[trend.length - 1].value
  if (first == null || last == null || first === 0) return null
  const pct = ((last - first) / Math.abs(first)) * 100
  return { value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, dir: pct >= 0 ? 'up' : 'down' }
}

// Extract just the values from trend data for sparkline
function trendValues(trend) {
  if (!trend || trend.length < 2) return []
  return trend.map((d) => d.value)
}

const RANGE_HOURS = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 }

// Prediction volume bar chart from real prediction_count trend
function PredictionBars({ data, dark }) {
  if (!data || data.length === 0) return null
  const maxP = Math.max(...data)
  if (maxP === 0) return null
  return (
    <div className="flex items-end gap-0.5" style={{ height: 50 }}>
      {data.map((v, i) => {
        const h = (v / maxP) * 50
        const isLow = v < maxP * 0.35
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300"
            style={{
              height: h,
              background: isLow ? 'rgba(245,158,11,0.6)' : 'rgba(59,130,246,0.4)',
            }}
            title={`${v} predictions`}
          />
        )
      })}
    </div>
  )
}

// Data quality progress bar
function QualityRow({ label, value, max, unit, color, dark }) {
  const pct = max > 0 ? (Math.min(value, max) / max) * 100 : 0
  const trackBg = dark ? '#1a1a2e' : '#e2e8f0'
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
        <span className="text-[10px] font-semibold" style={{ color }}>{value}{unit || ''}</span>
      </div>
      <div className="rounded-sm overflow-hidden" style={{ height: 4, background: trackBg }}>
        <div
          className="h-full rounded-sm transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function MetricsTab() {
  const { state, dispatch } = useApp()
  const t = useTheme()
  const [loading, setLoading] = useState(true)
  const [selectedRange, setSelectedRange] = useState('24h')
  const [incidents, setIncidents] = useState([])
  const [trends, setTrends] = useState({ f1: [], drift: [], latency: [], anomaly: [], predictions: [] })

  // Fetch all data including trends
  useEffect(() => {
    async function load() {
      const hours = RANGE_HOURS[selectedRange] || 24
      try {
        const [model, dq, inc, f1Trend, driftTrend, latencyTrend, anomalyTrend, predTrend] = await Promise.all([
          fetchJSON('/api/metrics/model'),
          fetchJSON('/api/metrics/data-quality'),
          fetchJSON('/api/incidents?limit=5').catch(() => []),
          fetchJSON(`/api/metrics/trend/f1_score?hours=${hours}`).catch(() => []),
          fetchJSON(`/api/metrics/trend/drift_score?hours=${hours}`).catch(() => []),
          fetchJSON(`/api/metrics/trend/latency_p99_ms?hours=${hours}`).catch(() => []),
          fetchJSON(`/api/metrics/trend/anomaly_rate?hours=${hours}`).catch(() => []),
          fetchJSON(`/api/metrics/trend/prediction_count?hours=${hours}`).catch(() => []),
        ])
        dispatch({ type: 'SET_METRICS', payload: model })
        dispatch({ type: 'SET_DATA_QUALITY', payload: dq })
        setIncidents(Array.isArray(inc) ? inc : inc?.incidents || [])
        setTrends({
          f1: Array.isArray(f1Trend) ? f1Trend : [],
          drift: Array.isArray(driftTrend) ? driftTrend : [],
          latency: Array.isArray(latencyTrend) ? latencyTrend : [],
          anomaly: Array.isArray(anomalyTrend) ? anomalyTrend : [],
          predictions: Array.isArray(predTrend) ? predTrend : [],
        })
      } catch (err) {
        console.error('Failed to load metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dispatch, selectedRange])

  if (loading) {
    return <div className={t.textFaint}>Loading metrics...</div>
  }

  const m = state.modelMetrics || {}
  const dq = state.dataQuality || {}

  const f1Status = assessF1(m.f1)
  const driftStatus = assessDrift(m.drift)
  const latencyStatus = assessLatency(m.latency)
  const nullStatus = assessNullRate(dq.null_rate)

  const f1Delta = computeDelta(trends.f1)
  const driftDelta = computeDelta(trends.drift)
  const latencyDelta = computeDelta(trends.latency)
  // Null rate doesn't have its own trend endpoint, so no delta for it

  const isCritical = m.status === 'critical' || f1Status === 'critical' || driftStatus === 'critical'
  const criticalCount = [f1Status, driftStatus, latencyStatus, nullStatus].filter(s => s === 'critical').length

  const cardBg = t.dark ? '#0d0d1a' : '#ffffff'
  const cardBorder = t.dark ? '#1a1a2e' : '#e5e7eb'
  const severityColor = (s) => s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#3b82f6'

  // Real prediction volume from trend data
  const predValues = trendValues(trends.predictions)
  const latestPredCount = m.count || (predValues.length > 0 ? predValues[predValues.length - 1] : 0)

  return (
    <div>
      {/* Critical Banner */}
      {isCritical && (
        <div
          className="rounded-lg mb-5 px-5 py-3 flex items-center justify-between"
          style={{
            background: t.dark
              ? 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
              : 'linear-gradient(90deg, rgba(239,68,68,0.1), rgba(239,68,68,0.03))',
            border: `1px solid ${t.dark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.25)'}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded tracking-wider">
              CRITICAL
            </span>
            <span className={`text-xs ${t.dark ? 'text-red-300' : 'text-red-600'}`}>
              {criticalCount} metric{criticalCount !== 1 ? 's' : ''} exceeding thresholds
              {m.anomaly_rate != null && ` \u00B7 Anomaly rate: ${(m.anomaly_rate * 100).toFixed(1)}%`}
              {m.count != null && ` \u00B7 Predictions: ${m.count.toLocaleString()}`}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_TAB', payload: 'investigation' })}
              className="text-[10px] px-3 py-1 rounded cursor-pointer"
              style={{
                background: t.dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${t.dark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)'}`,
                color: t.dark ? '#fca5a5' : '#dc2626',
              }}
            >
              Investigate
            </button>
          </div>
        </div>
      )}

      {/* Header Row */}
      <div className="flex justify-between items-center mb-5">
        <h2 className={`text-[22px] font-bold tracking-tight ${t.heading}`}>
          Model Metrics
        </h2>
        <div
          className="flex gap-1 rounded-md p-0.5"
          style={{ background: t.dark ? '#0d0d1a' : '#f1f5f9', border: `1px solid ${cardBorder}` }}
        >
          {['1h', '6h', '24h', '7d', '30d'].map((r) => (
            <button
              key={r}
              onClick={() => { setSelectedRange(r); setLoading(true) }}
              className="px-2.5 py-1 rounded text-[10px] cursor-pointer border-none"
              style={{
                fontFamily: 'inherit',
                color: selectedRange === r ? (t.dark ? '#f8fafc' : '#0f172a') : (t.dark ? '#475569' : '#94a3b8'),
                background: selectedRange === r ? (t.dark ? '#1a1a3a' : '#ffffff') : 'transparent',
                fontWeight: selectedRange === r ? 600 : 400,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <MetricCard
          title="F1 Score"
          value={m.f1 != null ? m.f1.toFixed(4) : null}
          status={f1Status}
          baseline="0.91"
          delta={f1Delta?.value}
          deltaDir={f1Delta?.dir}
          sparkData={trendValues(trends.f1)}
          thresholdBar={m.f1 != null ? { value: m.f1, baseline: 0.91, threshold: 0.85 } : null}
        />
        <MetricCard
          title="Drift Score"
          value={m.drift != null ? m.drift.toFixed(4) : null}
          status={driftStatus}
          baseline="0.08"
          delta={driftDelta?.value}
          deltaDir={driftDelta?.dir}
          sparkData={trendValues(trends.drift)}
          thresholdBar={m.drift != null ? { value: m.drift, baseline: 0.08, threshold: 0.25, invert: true } : null}
        />
        <MetricCard
          title="Latency (p99)"
          value={m.latency != null ? Math.round(m.latency) : null}
          unit="ms"
          status={latencyStatus}
          baseline="200"
          delta={latencyDelta?.value}
          deltaDir={latencyDelta?.dir}
          sparkData={trendValues(trends.latency)}
          thresholdBar={m.latency != null ? { value: m.latency, baseline: 200, threshold: 500, invert: true } : null}
        />
        <MetricCard
          title="Null Rate"
          value={dq.null_rate != null ? (dq.null_rate * 100).toFixed(1) : null}
          unit="%"
          status={nullStatus}
          baseline="0.8"
          thresholdBar={dq.null_rate != null ? { value: dq.null_rate * 100, baseline: 0.8, threshold: 5.0, invert: true } : null}
        />
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-5">
        {/* Recent Incidents */}
        <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="flex justify-between items-center mb-3">
            <h3 className={`text-[13px] font-bold ${t.heading}`}>Recent Incidents</h3>
            <button
              onClick={() => dispatch({ type: 'SET_TAB', payload: 'alerts' })}
              className={`text-[9px] tracking-wider ${t.dark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}
            >
              VIEW ALL
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {incidents.length === 0 && (
              <div className={`text-xs text-center py-4 ${t.textFaint}`}>No recent incidents</div>
            )}
            {incidents.map((inc, i) => (
              <div
                key={inc.incident_id || i}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
                style={{
                  background: inc.status !== 'resolved'
                    ? t.dark ? 'rgba(239,68,68,0.03)' : 'rgba(239,68,68,0.02)'
                    : 'transparent',
                  border: `1px solid ${inc.status !== 'resolved'
                    ? t.dark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)'
                    : t.dark ? '#111122' : '#f1f5f9'}`,
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: severityColor(inc.severity) }}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] truncate ${inc.status === 'resolved' ? t.textFaint : (t.dark ? 'text-gray-200' : 'text-gray-700')}`}>
                    {inc.alert_type?.replace(/_/g, ' ')}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${t.dark ? 'text-gray-600' : 'text-gray-400'}`}>
                    {inc.affected_component}
                    {inc.ts && ` \u00B7 ${new Date(inc.ts).toLocaleString()}`}
                    {inc.duration_minutes != null && ` \u00B7 ${inc.duration_minutes}m`}
                  </div>
                </div>
                <SeverityBadge severity={inc.severity} />
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Prediction Volume + Data Quality */}
        <div className="flex flex-col gap-3">
          {/* Prediction Volume */}
          <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="flex justify-between items-center mb-2.5">
              <h3 className={`text-[13px] font-bold ${t.heading}`}>Prediction Volume</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold" style={{ color: latestPredCount < 20 ? '#f59e0b' : t.dark ? '#f8fafc' : '#0f172a' }}>
                  {latestPredCount.toLocaleString()}
                </span>
                {latestPredCount < 20 && (
                  <span className="text-[9px] font-semibold rounded px-1.5 py-0.5" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}>
                    LOW
                  </span>
                )}
              </div>
            </div>
            {predValues.length > 0 ? (
              <>
                <PredictionBars data={predValues} dark={t.dark} />
                <div className="flex justify-between mt-1">
                  <span className={`text-[9px] ${t.dark ? 'text-gray-600' : 'text-gray-400'}`}>-{selectedRange}</span>
                  <span className={`text-[9px] ${t.dark ? 'text-gray-600' : 'text-gray-400'}`}>now</span>
                </div>
              </>
            ) : (
              <div className={`text-xs text-center py-3 ${t.textFaint}`}>No trend data</div>
            )}
          </div>

          {/* Data Quality Summary */}
          <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <h3 className={`text-[13px] font-bold ${t.heading} mb-3`}>Data Quality</h3>
            <div className="flex flex-col gap-2">
              <QualityRow
                label="Schema Violations"
                value={dq.violations != null ? dq.violations : 0}
                max={10}
                color={dq.violations > 0 ? '#ef4444' : '#10b981'}
                dark={t.dark}
              />
              <QualityRow
                label="Missing Values"
                value={dq.null_rate != null ? (dq.null_rate * 100).toFixed(1) : '0'}
                max={10}
                unit="%"
                color={dq.null_rate > 0.05 ? '#ef4444' : '#10b981'}
                dark={t.dark}
              />
              <QualityRow
                label="Anomaly Rate"
                value={m.anomaly_rate != null ? (m.anomaly_rate * 100).toFixed(1) : '0'}
                max={100}
                unit="%"
                color={m.anomaly_rate > 0.05 ? '#ef4444' : '#10b981'}
                dark={t.dark}
              />
              <QualityRow
                label="Records Processed"
                value={dq.records != null ? dq.records.toLocaleString() : '0'}
                max={dq.records || 1}
                color="#3b82f6"
                dark={t.dark}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Retrain Model', desc: 'Trigger new training run', tab: 'actions' },
          { label: 'Rollback', desc: 'Revert to last stable', tab: 'actions' },
          { label: 'Root Cause', desc: 'Start investigation', tab: 'investigation' },
          { label: 'View Alerts', desc: 'Check all alerts', tab: 'alerts' },
          { label: 'Run Crew', desc: 'Full AI pipeline', tab: 'crew' },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => dispatch({ type: 'SET_TAB', payload: a.tab })}
            className="rounded-lg px-3 py-2.5 text-left cursor-pointer transition-colors duration-200 border"
            style={{
              background: cardBg,
              borderColor: cardBorder,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6'
              e.currentTarget.style.background = t.dark ? '#0d0d20' : '#f8fafc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = cardBorder
              e.currentTarget.style.background = cardBg
            }}
          >
            <div className={`text-[11px] font-medium ${t.dark ? 'text-gray-200' : 'text-gray-700'}`}>{a.label}</div>
            <div className={`text-[9px] mt-0.5 ${t.dark ? 'text-gray-600' : 'text-gray-400'}`}>{a.desc}</div>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes criticalGlow {
          0%, 100% { box-shadow: inset 0 0 0 1px rgba(239,68,68,0.3), 0 0 20px rgba(239,68,68,0.05); }
          50% { box-shadow: inset 0 0 0 1px rgba(239,68,68,0.5), 0 0 30px rgba(239,68,68,0.1); }
        }
      `}</style>
    </div>
  )
}
