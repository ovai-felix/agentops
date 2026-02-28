import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { postJSON } from '../api'

export default function InvestigateTab() {
  const { state, dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [ragAnswer, setRagAnswer] = useState(null)
  const [executingPlan, setExecutingPlan] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setRagAnswer(null)
    try {
      const data = await postJSON('/api/investigate', { query: query.trim() })
      setRagAnswer(data.answer || JSON.stringify(data))
    } catch (err) {
      setRagAnswer(`Error: ${err.message}`)
    } finally {
      setSearching(false)
    }
  }

  const handleExecutePlan = async () => {
    if (!state.diagnosis?.recommended_actions) return
    setExecutingPlan(true)
    try {
      const data = await postJSON('/api/actions/set', {
        actions: state.diagnosis.recommended_actions,
      })
      dispatch({ type: 'SET_ACTIONS', payload: data.actions || [] })
      dispatch({ type: 'SET_TAB', payload: 'actions' })
    } catch (err) {
      console.error('Failed to set actions:', err)
    } finally {
      setExecutingPlan(false)
    }
  }

  const diag = state.diagnosis

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Investigation</h2>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about runbooks, incidents, or procedures..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {ragAnswer && (
        <div className="bg-gray-900 rounded-lg p-5 mb-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-2">RAG Response</h3>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{ragAnswer}</p>
        </div>
      )}

      {diag && (
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-3">Root Cause Analysis</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{diag.root_cause_analysis}</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-3">Similar Past Incidents</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{diag.similar_incidents}</p>
          </div>

          {diag.recommended_actions && diag.recommended_actions.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-3">Recommended Actions</h3>
              <div className="space-y-2 mb-4">
                {diag.recommended_actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400 shrink-0">
                      {action.priority || i + 1}
                    </span>
                    <span className="text-gray-300 flex-1">{action.action}</span>
                    {action.requires_approval && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700">
                        Needs Approval
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleExecutePlan}
                disabled={executingPlan}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {executingPlan ? 'Setting up...' : 'Execute Remediation Plan'}
              </button>
            </div>
          )}
        </div>
      )}

      {!diag && !ragAnswer && (
        <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-500">
          No investigation in progress. Use the search bar above or click "Investigate" on an alert.
        </div>
      )}
    </div>
  )
}
