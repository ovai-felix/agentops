import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { fetchJSON } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function TrendsTab() {
  const { state, dispatch } = useApp()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [f1, drift] = await Promise.all([
          fetchJSON('/api/metrics/trend/f1_score?hours=48'),
          fetchJSON('/api/metrics/trend/drift_score?hours=48'),
        ])
        dispatch({ type: 'SET_F1_TREND', payload: Array.isArray(f1) ? f1 : [] })
        dispatch({ type: 'SET_DRIFT_TREND', payload: Array.isArray(drift) ? drift : [] })
      } catch (err) {
        console.error('Failed to load trends:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dispatch])

  if (loading) {
    return <div className="text-gray-500">Loading trends...</div>
  }

  const f1Data = state.f1Trend.map((d) => ({
    time: new Date(d.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }))

  const driftData = state.driftTrend.map((d) => ({
    time: new Date(d.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }))

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Metric Trends (48h)</h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">F1 Score</h3>
          {f1Data.length === 0 ? (
            <p className="text-gray-600 text-sm">No trend data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={f1Data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9CA3AF' }}
                  itemStyle={{ color: '#60A5FA' }}
                />
                <ReferenceLine y={0.88} stroke="#EAB308" strokeDasharray="5 5" label={{ value: 'Threshold', fill: '#EAB308', fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Drift Score</h3>
          {driftData.length === 0 ? (
            <p className="text-gray-600 text-sm">No trend data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={driftData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9CA3AF' }}
                  itemStyle={{ color: '#EF4444' }}
                />
                <ReferenceLine y={0.2} stroke="#EAB308" strokeDasharray="5 5" label={{ value: 'Threshold', fill: '#EAB308', fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
