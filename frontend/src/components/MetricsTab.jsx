import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { fetchJSON } from '../api'
import MetricCard from './MetricCard'

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

export default function MetricsTab() {
  const { state, dispatch } = useApp()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [model, dq] = await Promise.all([
          fetchJSON('/api/metrics/model'),
          fetchJSON('/api/metrics/data-quality'),
        ])
        dispatch({ type: 'SET_METRICS', payload: model })
        dispatch({ type: 'SET_DATA_QUALITY', payload: dq })
      } catch (err) {
        console.error('Failed to load metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dispatch])

  if (loading) {
    return <div className="text-gray-500">Loading metrics...</div>
  }

  const m = state.modelMetrics || {}
  const dq = state.dataQuality || {}

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Model Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="F1 Score"
          value={m.f1 != null ? m.f1.toFixed(4) : null}
          status={assessF1(m.f1)}
          subtitle="Baseline: 0.91"
        />
        <MetricCard
          title="Drift Score"
          value={m.drift != null ? m.drift.toFixed(4) : null}
          status={assessDrift(m.drift)}
          subtitle="Threshold: 0.20"
        />
        <MetricCard
          title="Latency (p99)"
          value={m.latency != null ? Math.round(m.latency) : null}
          unit="ms"
          status={assessLatency(m.latency)}
          subtitle="Target: < 500ms"
        />
        <MetricCard
          title="Null Rate"
          value={dq.null_rate != null ? (dq.null_rate * 100).toFixed(1) : null}
          unit="%"
          status={dq.null_rate > 0.05 ? 'warning' : 'healthy'}
          subtitle={dq.records != null ? `${dq.records.toLocaleString()} records` : ''}
        />
      </div>

      {m.status && (
        <div className={`p-4 rounded-lg border text-sm ${
          m.status === 'critical' ? 'bg-red-900/20 border-red-700 text-red-300' :
          m.status === 'warning' ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' :
          'bg-green-900/20 border-green-700 text-green-300'
        }`}>
          Overall Status: <span className="font-semibold capitalize">{m.status}</span>
          {m.anomaly_rate != null && ` — Anomaly rate: ${(m.anomaly_rate * 100).toFixed(1)}%`}
          {m.count != null && ` — Predictions: ${m.count.toLocaleString()}`}
        </div>
      )}
    </div>
  )
}
