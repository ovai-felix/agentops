import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { fetchJSON } from '../api'

function driftStatus(psi) {
  if (psi > 0.3) return 'critical'
  if (psi > 0.2) return 'warning'
  return 'healthy'
}

const statusColors = {
  critical: 'bg-red-900/30 text-red-300',
  warning: 'bg-yellow-900/30 text-yellow-300',
  healthy: '',
}

export default function DataQualityTab() {
  const { state, dispatch } = useApp()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const drift = await fetchJSON('/api/metrics/feature-drift')
        dispatch({ type: 'SET_FEATURE_DRIFT', payload: Array.isArray(drift) ? drift : drift.rows || [] })
      } catch (err) {
        console.error('Failed to load feature drift:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dispatch])

  if (loading) {
    return <div className="text-gray-500">Loading data quality...</div>
  }

  const features = state.featureDrift

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Feature Drift Analysis</h2>

      {features.length === 0 ? (
        <p className="text-gray-500">No feature drift data available.</p>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-3 text-gray-400 font-medium">Feature</th>
                <th className="text-right p-3 text-gray-400 font-medium">PSI Score</th>
                <th className="text-right p-3 text-gray-400 font-medium">KS Statistic</th>
                <th className="text-right p-3 text-gray-400 font-medium">Mean Shift</th>
                <th className="text-center p-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => {
                const status = driftStatus(f.psi_score)
                return (
                  <tr key={i} className={`border-b border-gray-800/50 ${statusColors[status]}`}>
                    <td className="p-3 text-white font-mono">{f.feature_name}</td>
                    <td className="p-3 text-right text-gray-300">{f.psi_score?.toFixed(4)}</td>
                    <td className="p-3 text-right text-gray-300">{f.ks_statistic?.toFixed(4)}</td>
                    <td className="p-3 text-right text-gray-300">{f.mean_shift?.toFixed(4)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        status === 'critical' ? 'bg-red-700 text-red-100' :
                        status === 'warning' ? 'bg-yellow-700 text-yellow-100' :
                        'bg-green-700 text-green-100'
                      }`}>
                        {status === 'critical' ? 'DRIFT' : status === 'warning' ? 'WATCH' : 'OK'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-600">
        PSI &gt; 0.3 = significant drift (red) | PSI &gt; 0.2 = moderate drift (yellow) | PSI &le; 0.2 = stable (green)
      </div>
    </div>
  )
}
