import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { postJSON } from '../api'

const statusIcons = {
  pending: '○',
  completed: '●',
  denied: '✕',
}

const statusColors = {
  pending: 'text-gray-400',
  completed: 'text-green-400',
  denied: 'text-red-400',
}

export default function ActionsTab() {
  const { state, dispatch } = useApp()
  const [executing, setExecuting] = useState(null)

  const handleExecute = async (index) => {
    setExecuting(index)
    try {
      const data = await postJSON('/api/actions/execute', { index })
      dispatch({ type: 'UPDATE_ACTION', payload: { index, updates: data.action || { status: 'completed' } } })
    } catch (err) {
      console.error('Execute failed:', err)
    } finally {
      setExecuting(null)
    }
  }

  const handleApprove = async (index) => {
    setExecuting(index)
    try {
      const data = await postJSON('/api/actions/approve', { index })
      dispatch({ type: 'UPDATE_ACTION', payload: { index, updates: data.action || { status: 'completed' } } })
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setExecuting(null)
    }
  }

  const handleDeny = async (index) => {
    setExecuting(index)
    try {
      const data = await postJSON('/api/actions/deny', { index })
      dispatch({ type: 'UPDATE_ACTION', payload: { index, updates: data.action || { status: 'denied' } } })
    } catch (err) {
      console.error('Deny failed:', err)
    } finally {
      setExecuting(null)
    }
  }

  const handleClear = () => {
    dispatch({ type: 'SET_ACTIONS', payload: [] })
  }

  const completed = state.actions.filter((a) => a.status === 'completed').length
  const total = state.actions.length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Actions</h2>
        {total > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{completed} / {total}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-500">
          No actions queued. Investigate an alert first to generate a remediation plan.
        </div>
      ) : (
        <div className="space-y-3">
          {state.actions.map((action, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex items-center gap-4">
              <span className={`text-xl ${statusColors[action.status] || 'text-gray-400'}`}>
                {statusIcons[action.status] || '○'}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{action.action}</span>
                  {action.requires_approval && action.status === 'pending' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700">
                      Approval Required
                    </span>
                  )}
                </div>
                {action.details && (
                  <p className="text-xs text-gray-500 mt-1">{action.details}</p>
                )}
                {action.timestamp && (
                  <p className="text-xs text-gray-600 mt-1">{new Date(action.timestamp).toLocaleString()}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {action.status === 'pending' && !action.requires_approval && (
                  <button
                    onClick={() => handleExecute(i)}
                    disabled={executing === i}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    {executing === i ? '...' : 'Execute'}
                  </button>
                )}
                {action.status === 'pending' && action.requires_approval && (
                  <>
                    <button
                      onClick={() => handleApprove(i)}
                      disabled={executing === i}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs rounded-lg font-medium transition-colors"
                    >
                      {executing === i ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDeny(i)}
                      disabled={executing === i}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-xs rounded-lg font-medium transition-colors"
                    >
                      Deny
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
