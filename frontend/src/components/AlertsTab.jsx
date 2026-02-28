import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { fetchJSON, postJSON } from '../api'
import SeverityBadge from './SeverityBadge'

export default function AlertsTab() {
  const { state, dispatch } = useApp()
  const [checking, setChecking] = useState(false)
  const [investigating, setInvestigating] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetchJSON('/api/incidents')
      .then((data) => dispatch({ type: 'SET_INCIDENTS', payload: Array.isArray(data) ? data : data.incidents || [] }))
      .catch(() => {})
  }, [dispatch])

  const handleCheck = async () => {
    setChecking(true)
    try {
      const data = await postJSON('/api/alerts/check')
      dispatch({ type: 'SET_ALERTS', payload: data.alerts || [] })
    } catch (err) {
      console.error('Alert check failed:', err)
    } finally {
      setChecking(false)
    }
  }

  const handleInvestigate = async (alert) => {
    setInvestigating(alert.alert_id)
    try {
      const diagnosis = await postJSON('/api/investigate/auto', { alert })
      dispatch({ type: 'SET_DIAGNOSIS', payload: diagnosis })
      dispatch({ type: 'SET_TAB', payload: 'investigation' })
    } catch (err) {
      console.error('Investigation failed:', err)
    } finally {
      setInvestigating(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Alerts</h2>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {checking ? 'Checking...' : 'Check for Alerts Now'}
        </button>
      </div>

      {state.alerts.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-500">
          No alerts detected. Click "Check for Alerts Now" to scan.
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {state.alerts.map((alert, i) => (
            <div key={alert.alert_id || i} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
              >
                <SeverityBadge severity={alert.severity} />
                <span className="text-white font-medium flex-1">{alert.alert_type?.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-500">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}</span>
                <span className="text-gray-500">{expanded === i ? '▲' : '▼'}</span>
              </button>
              {expanded === i && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                  <p className="text-sm text-gray-300">{alert.message}</p>
                  {alert.metrics && (
                    <div className="flex gap-4 text-xs text-gray-400">
                      {Object.entries(alert.metrics).map(([k, v]) => (
                        <span key={k}><span className="text-gray-500">{k}:</span> {typeof v === 'number' ? v.toFixed(4) : v}</span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleInvestigate(alert)}
                    disabled={investigating === alert.alert_id}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    {investigating === alert.alert_id ? 'Investigating...' : 'Investigate'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Historical Incidents</h3>
        {state.incidents.length === 0 ? (
          <p className="text-gray-500 text-sm">No historical incidents loaded.</p>
        ) : (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-3 text-gray-400 font-medium">Time</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Type</th>
                  <th className="text-center p-3 text-gray-400 font-medium">Severity</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Component</th>
                  <th className="text-right p-3 text-gray-400 font-medium">Duration</th>
                  <th className="text-center p-3 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.incidents.map((inc, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="p-3 text-gray-300 text-xs">{inc.ts ? new Date(inc.ts).toLocaleString() : '—'}</td>
                    <td className="p-3 text-gray-300">{inc.alert_type}</td>
                    <td className="p-3 text-center"><SeverityBadge severity={inc.severity} /></td>
                    <td className="p-3 text-gray-300">{inc.affected_component}</td>
                    <td className="p-3 text-right text-gray-300">{inc.duration_minutes}m</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs ${inc.status === 'resolved' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {inc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
