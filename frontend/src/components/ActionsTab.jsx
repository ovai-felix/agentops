import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { postJSON } from '../api'

const statusIcons = {
  pending: '\u25CB',
  completed: '\u25CF',
  denied: '\u2715',
}

const statusColors = {
  pending: 'text-gray-400',
  completed: 'text-green-400',
  denied: 'text-red-400',
}

function extractGitHubUrl(details) {
  if (!details) return null
  const match = details.match(/(https:\/\/github\.com\/[^\s]+\/issues\/\d+)/)
  return match ? match[1] : null
}

function parseGitHubUrl(url) {
  // https://github.com/owner/repo/issues/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: match[3], fullRepo: `${match[1]}/${match[2]}` }
}

function GitHubIssueCard({ url, diagnosis, dark }) {
  const info = parseGitHubUrl(url)
  if (!info) return null

  const alert = diagnosis?.alert || {}
  const alertType = (alert.alert_type || 'ML Alert').replace(/_/g, ' ')
  const severity = alert.severity || 'unknown'
  const sevColor = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#10b981'

  return (
    <div style={{
      marginTop: 10, borderRadius: 8, overflow: 'hidden',
      border: `1px solid ${dark ? '#1e293b' : '#d1d5db'}`,
      background: dark ? '#0d1117' : '#ffffff',
      fontSize: 13,
    }}>
      {/* Header bar */}
      <div style={{
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${dark ? '#21262d' : '#d1d5db'}`,
        background: dark ? '#161b22' : '#f6f8fa',
      }}>
        {/* GitHub issue icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#3fb950" style={{ flexShrink: 0 }}>
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{
            color: dark ? '#58a6ff' : '#0969da', textDecoration: 'none', fontWeight: 600, fontSize: 13,
          }}>
            [AgentOps] {alertType} — {severity} <span style={{ color: dark ? '#8b949e' : '#656d76', fontWeight: 400 }}>#{info.number}</span>
          </a>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: '#fff', background: '#238636', padding: '2px 8px', borderRadius: 12,
        }}>Open</span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Labels */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
            background: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}44`,
          }}>{severity}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
            background: dark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
            color: '#3b82f6', border: `1px solid ${dark ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)'}`,
          }}>agentops</span>
        </div>

        {/* Alert message */}
        <p style={{ fontSize: 12, color: dark ? '#c9d1d9' : '#1f2328', lineHeight: 1.6, marginBottom: 10 }}>
          <strong>Alert:</strong> {alert.message || 'N/A'}
        </p>

        {/* Metrics */}
        {alert.metrics && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {Object.entries(alert.metrics).map(([k, v]) => (
              <div key={k} style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 11,
                background: dark ? '#21262d' : '#f6f8fa',
                border: `1px solid ${dark ? '#30363d' : '#d1d5db'}`,
              }}>
                <span style={{ color: dark ? '#8b949e' : '#656d76' }}>{k.replace(/_/g, ' ')}: </span>
                <span style={{ color: dark ? '#e6edf3' : '#1f2328', fontWeight: 600 }}>
                  {typeof v === 'number' ? v.toFixed(4) : v}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Root cause preview */}
        {diagnosis?.root_cause_analysis && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 11, lineHeight: 1.6,
            background: dark ? '#21262d' : '#f6f8fa',
            border: `1px solid ${dark ? '#30363d' : '#d1d5db'}`,
            color: dark ? '#8b949e' : '#656d76',
            maxHeight: 60, overflow: 'hidden',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
            maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
          }}>
            <strong style={{ color: dark ? '#c9d1d9' : '#1f2328' }}>Root Cause:</strong>{' '}
            {diagnosis.root_cause_analysis.slice(0, 300)}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 10, paddingTop: 8, borderTop: `1px solid ${dark ? '#21262d' : '#e5e7eb'}`,
        }}>
          <span style={{ fontSize: 10, color: dark ? '#484f58' : '#8b949e' }}>
            {info.fullRepo} #{info.number}
          </span>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 10, fontWeight: 600, color: dark ? '#58a6ff' : '#0969da',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            View on GitHub {'\u2192'}
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ActionsTab() {
  const { state, dispatch } = useApp()
  const t = useTheme()
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
        <h2 className={`text-2xl font-bold ${t.heading}`}>Actions</h2>
        {total > 0 && (
          <button
            onClick={handleClear}
            className={`text-sm ${t.textMuted} hover:${t.heading} transition-colors`}
          >
            Clear All
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="mb-6">
          <div className={`flex items-center justify-between text-xs ${t.textMuted} mb-1`}>
            <span>Progress</span>
            <span>{completed} / {total}</span>
          </div>
          <div className={`w-full h-2 ${t.progressBg} rounded-full overflow-hidden`}>
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className={`${t.card} rounded-lg p-8 text-center ${t.textFaint}`}>
          No actions queued. Investigate an alert first to generate a remediation plan.
        </div>
      ) : (
        <div className="space-y-3">
          {state.actions.map((action, i) => {
            const ghUrl = extractGitHubUrl(action.details)
            return (
              <div key={i} className={`${t.card} rounded-lg p-4 border ${t.border}`}>
                <div className="flex items-center gap-4">
                  <span className={`text-xl ${statusColors[action.status] || 'text-gray-400'}`}>
                    {statusIcons[action.status] || '\u25CB'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${t.heading}`}>{action.action}</span>
                      {action.requires_approval && action.status === 'pending' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          t.dark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                        }`}>
                          Approval Required
                        </span>
                      )}
                    </div>
                    {action.details && !ghUrl && (
                      <p className={`text-xs ${t.textFaint} mt-1`}>{action.details}</p>
                    )}
                    {action.details && ghUrl && (
                      <p className={`text-xs ${t.textFaint} mt-1`}>
                        Issue created at {action.details.match(/at (\S+)/)?.[1] || ''}
                      </p>
                    )}
                    {action.timestamp && (
                      <p className={`text-xs ${t.textDimmest} mt-1`}>{new Date(action.timestamp).toLocaleString()}</p>
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
                {/* GitHub Issue Card */}
                {ghUrl && (
                  <GitHubIssueCard url={ghUrl} diagnosis={state.diagnosis} dark={t.dark} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
