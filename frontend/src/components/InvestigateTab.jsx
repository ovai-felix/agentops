import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { fetchJSON, postJSON } from '../api'

const StatusPulse = ({ status }) => {
  const color = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981'
  return (
    <span style={{ display: 'inline-block', position: 'relative', width: 8, height: 8, marginRight: 6 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
      {status === 'critical' && (
        <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${color}`, animation: 'inv-pulse-ring 2s ease-out infinite' }} />
      )}
    </span>
  )
}

const QUICK_TEMPLATES = [
  { icon: '\u{1F4C9}', label: 'Why did F1 drop?', query: 'Why did F1 score drop below baseline?', tags: ['Model Performance'] },
  { icon: '\u{1F500}', label: 'Trace drift source', query: 'Which features are causing data drift?', tags: ['Data Quality'] },
  { icon: '\u{2696}\u{FE0F}', label: 'Compare model versions', query: 'Compare current model performance vs previous deployment', tags: ['Deployment'] },
  { icon: '\u{1F517}', label: 'Pipeline health check', query: 'Check data pipeline health across all services', tags: ['Infrastructure'] },
  { icon: '\u{1F4CA}', label: 'Feature importance shift', query: 'Have feature importances changed significantly?', tags: ['Model Performance'] },
  { icon: '\u{1F550}', label: 'Latency root cause', query: 'What is causing latency spikes in the last 24h?', tags: ['Infrastructure'] },
]

const INVESTIGATION_STEPS = [
  { label: 'Querying metrics & logs', duration: 800 },
  { label: 'Analyzing feature distributions', duration: 1200 },
  { label: 'Correlating with deployment events', duration: 900 },
  { label: 'Checking upstream data pipelines', duration: 700 },
  { label: 'Generating root cause hypothesis', duration: 1400 },
]

const severityColor = (s) =>
  s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : s === 'info' ? '#3b82f6' : '#10b981'

const timeAgo = (ts) => {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function useColors() {
  const { dark } = useTheme()
  return {
    dark,
    bg: dark ? '#0a0a14' : '#f8fafc',
    text: dark ? '#e2e8f0' : '#1e293b',
    heading: dark ? '#f8fafc' : '#0f172a',
    muted: dark ? '#94a3b8' : '#64748b',
    faint: dark ? '#475569' : '#94a3b8',
    dim: dark ? '#64748b' : '#94a3b8',
    cardBg: dark ? '#0d0d1a' : '#ffffff',
    cardBorder: dark ? '#1a1a2e' : '#e2e8f0',
    inputBg: dark ? '#0d0d1a' : '#ffffff',
    inputFocusBg: dark ? '#0f0f22' : '#f0f4ff',
    inputBorder: dark ? '#1a1a2e' : '#d1d5db',
    inputFocusBorder: dark ? '#2563eb' : '#3b82f6',
    inputText: dark ? '#f8fafc' : '#1e293b',
    inputPlaceholder: dark ? '#475569' : '#9ca3af',
    hoverBg: dark ? '#141428' : '#f1f5f9',
    tagBg: dark ? '#111122' : '#f1f5f9',
    tagText: dark ? '#475569' : '#64748b',
    stepDoneBg: '#10b981',
    stepActiveBg: dark ? '#1a1a3a' : '#eff6ff',
    stepActiveBorder: '#3b82f6',
    stepInactiveBg: dark ? '#111122' : '#f1f5f9',
    stepInactiveText: dark ? '#475569' : '#9ca3af',
    summaryBg: dark ? 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(16,185,129,0.03))' : 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(16,185,129,0.02))',
    summaryBorder: dark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
    codeBg: dark ? '#111122' : '#f1f5f9',
    evidenceHighBg: dark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.03)',
    evidenceHighBorder: dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)',
    evidenceLowBg: dark ? '#111122' : '#f8fafc',
    evidenceLowBorder: dark ? '#1a1a2e' : '#e2e8f0',
    actionHighlightBg: dark ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)',
    actionHighlightBorder: dark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)',
    actionDefaultBg: dark ? '#111122' : '#f8fafc',
    actionDefaultBorder: dark ? '#1a1a2e' : '#e2e8f0',
    criticalCardBg: dark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)',
    criticalCardBorder: dark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
    warningCardBg: dark ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.02)',
    warningCardBorder: dark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)',
    glowShadow: dark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
    glowShadowStrong: dark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
    dropdownShadow: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)',
    btnBg: dark ? '#111122' : '#f1f5f9',
    btnBorder: dark ? '#1a1a2e' : '#d1d5db',
    btnText: dark ? '#94a3b8' : '#64748b',
    disabledBg: dark ? '#1a1a3a' : '#e2e8f0',
    disabledText: dark ? '#64748b' : '#94a3b8',
    timelineLine: dark ? '#1a1a2e' : '#e2e8f0',
    timelineDotBorder: dark ? '#0d0d1a' : '#ffffff',
  }
}

export default function InvestigateTab() {
  const { state, dispatch } = useApp()
  const c = useColors()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchStep, setSearchStep] = useState(-1)
  const [showResults, setShowResults] = useState(false)
  const [focusedInput, setFocusedInput] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [ragAnswer, setRagAnswer] = useState(null)
  const [executingPlan, setExecutingPlan] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { setMounted(true) }, [])
  const pendingPrefill = useRef(null)

  // Capture prefill when it arrives (startInvestigation may not exist yet)
  useEffect(() => {
    if (state.investigationPrefill) {
      pendingPrefill.current = state.investigationPrefill.query
      dispatch({ type: 'CLEAR_INVESTIGATION_PREFILL' })
    }
  }, [state.investigationPrefill])

  // Fetch alerts and incidents on mount
  useEffect(() => {
    if (state.alerts.length === 0) {
      postJSON('/api/alerts/check').then((d) => {
        if (d.alerts?.length) dispatch({ type: 'SET_ALERTS', payload: d.alerts })
      }).catch(() => {})
    }
    if (state.incidents.length === 0) {
      fetchJSON('/api/incidents').then((d) => {
        dispatch({ type: 'SET_INCIDENTS', payload: Array.isArray(d) ? d : [] })
      }).catch(() => {})
    }
  }, [])

  // If a diagnosis already exists from an alert investigation, show results
  useEffect(() => {
    if (state.diagnosis && !showResults && !isSearching) {
      setShowResults(true)
    }
  }, [state.diagnosis])

  const runAnimationSteps = () => {
    return new Promise((resolve) => {
      setSearchStep(0)
      let step = 0
      const advance = () => {
        if (step < INVESTIGATION_STEPS.length - 1) {
          step++
          setSearchStep(step)
          setTimeout(advance, INVESTIGATION_STEPS[step].duration)
        } else {
          setTimeout(resolve, 400)
        }
      }
      setTimeout(advance, INVESTIGATION_STEPS[0].duration)
    })
  }

  // Process any pending prefill now that startInvestigation is available
  useEffect(() => {
    if (pendingPrefill.current && !isSearching) {
      const q = pendingPrefill.current
      pendingPrefill.current = null
      // Delay slightly to ensure component is fully rendered
      setTimeout(() => startInvestigation(q), 100)
    }
  })

  const startInvestigation = async (q, alert = null) => {
    setQuery(q)
    setIsSearching(true)
    setShowResults(false)
    setRagAnswer(null)

    const animationPromise = runAnimationSteps()

    let apiPromise
    if (alert) {
      apiPromise = postJSON('/api/investigate/auto', { alert })
    } else {
      apiPromise = postJSON('/api/investigate', { query: q })
    }

    try {
      const [, apiResult] = await Promise.all([animationPromise, apiPromise])
      if (alert) {
        dispatch({ type: 'SET_DIAGNOSIS', payload: apiResult })
      } else {
        setRagAnswer(apiResult.answer || JSON.stringify(apiResult))
      }
    } catch (err) {
      setRagAnswer(`Error: ${err.message}`)
    } finally {
      setIsSearching(false)
      setShowResults(true)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) startInvestigation(query)
  }

  const handleExecutePlan = async () => {
    const actions = state.diagnosis?.recommended_actions
    if (!actions) return
    setExecutingPlan(true)
    try {
      const data = await postJSON('/api/actions/set', { actions })
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
    <div style={{ color: c.text, fontSize: 13 }}>
      <style>{`
        @keyframes inv-pulse-ring { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(2); } }
        @keyframes inv-slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes inv-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes inv-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes inv-stepPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes inv-resultReveal {
          from { opacity: 0; transform: translateY(8px); clip-path: inset(0 0 100% 0); }
          to { opacity: 1; transform: translateY(0); clip-path: inset(0 0 0 0); }
        }
        @keyframes inv-glowPulse {
          0%, 100% { box-shadow: 0 0 15px ${c.glowShadow}; }
          50% { box-shadow: 0 0 25px ${c.glowShadowStrong}; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: c.heading, letterSpacing: '-0.02em' }}>Investigation</h1>
          <p style={{ fontSize: 11, color: c.faint, marginTop: 4 }}>AI-powered root cause analysis across your ML pipeline</p>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 24, animation: mounted ? 'inv-slideUp 0.4s ease both' : 'none' }}>
        <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: focusedInput ? c.inputFocusBg : c.inputBg,
            border: `1px solid ${focusedInput ? c.inputFocusBorder : c.inputBorder}`,
            borderRadius: 12, padding: '4px 6px 4px 18px',
            transition: 'all 0.3s',
            ...(focusedInput ? { boxShadow: `0 0 30px ${c.glowShadow}` } : {}),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 16, opacity: 0.4, color: c.muted }}>{'\u25CE'}</span>
              <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 7px', borderRadius: 3, fontWeight: 600, letterSpacing: '0.04em' }}>AI</span>
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(e.target.value.length > 0) }}
              onFocus={() => { setFocusedInput(true); setShowSuggestions(true) }}
              onBlur={() => { setFocusedInput(false); setTimeout(() => setShowSuggestions(false), 200) }}
              placeholder="Ask anything — e.g. 'Why did F1 score drop?', 'What caused the drift spike?'"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none', color: c.inputText,
                fontSize: 13, fontFamily: 'inherit', padding: '12px 0',
              }}
            />
            <button type="submit" disabled={isSearching || !query.trim()} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: isSearching ? 'wait' : 'pointer',
              fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
              background: isSearching ? c.disabledBg : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: isSearching ? c.disabledText : '#fff',
              transition: 'all 0.2s',
            }}>
              {isSearching ? 'Investigating...' : 'Investigate'}
            </button>
          </div>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && !isSearching && !showResults && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
            background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
            padding: '8px', boxShadow: `0 12px 40px ${c.dropdownShadow}`,
            animation: 'inv-fadeIn 0.15s ease',
          }}>
            <div style={{ fontSize: 9, color: c.faint, padding: '4px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Suggested Queries</div>
            {QUICK_TEMPLATES.filter(t => !query.trim() || t.label.toLowerCase().includes(query.toLowerCase()) || t.query.toLowerCase().includes(query.toLowerCase())).slice(0, 4).map((t) => (
              <button key={t.label} onClick={() => startInvestigation(t.query)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
                background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', color: c.text, fontSize: 12, textAlign: 'left',
                transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = c.hoverBg}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.query}</span>
                <span style={{ fontSize: 9, color: c.tagText, background: c.tagBg, padding: '2px 6px', borderRadius: 3 }}>{t.tags[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Investigation Progress */}
      {isSearching && (
        <div style={{
          background: c.cardBg, border: `1px solid ${c.inputFocusBorder}33`, borderRadius: 12,
          padding: '24px', marginBottom: 24, position: 'relative', overflow: 'hidden',
          animation: 'inv-glowPulse 2s ease infinite',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)', backgroundSize: '200% 100%', animation: 'inv-shimmer 1.5s linear infinite' }} />
          <div style={{ fontSize: 12, color: c.muted, marginBottom: 16 }}>Investigating: <span style={{ color: c.heading }}>{query}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {INVESTIGATION_STEPS.map((step, i) => {
              const isActive = i === searchStep
              const isDone = i < searchStep
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: i > searchStep ? 0.25 : 1, transition: 'opacity 0.3s' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: isDone ? c.stepDoneBg : isActive ? c.stepActiveBg : c.stepInactiveBg,
                    color: isDone ? '#fff' : isActive ? '#3b82f6' : c.stepInactiveText,
                    border: isActive ? `1.5px solid ${c.stepActiveBorder}` : `1px solid ${c.cardBorder}`,
                    ...(isActive ? { animation: 'inv-stepPulse 1.5s ease infinite' } : {}),
                  }}>
                    {isDone ? '\u2713' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: isDone ? '#10b981' : isActive ? c.heading : c.stepInactiveText }}>
                    {step.label}{isActive ? '...' : ''}
                  </span>
                  {isActive && <div style={{ width: 60, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, #3b82f6, transparent)', backgroundSize: '200% 100%', animation: 'inv-shimmer 1s linear infinite' }} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Investigation Results */}
      {showResults && (diag || ragAnswer) && (
        <div style={{ marginBottom: 24, animation: 'inv-resultReveal 0.6s ease both' }}>
          {/* Summary Card */}
          <div style={{
            background: c.summaryBg, border: `1px solid ${c.summaryBorder}`, borderRadius: 12,
            padding: '20px 24px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '3px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em' }}>
                  {diag ? 'ROOT CAUSE FOUND' : 'RAG RESPONSE'}
                </span>
                {diag?.alert && (
                  <span style={{ fontSize: 9, color: c.faint }}>
                    Alert: <span style={{ color: severityColor(diag.alert.severity), fontWeight: 700 }}>{diag.alert.alert_type?.replace(/_/g, ' ')}</span>
                  </span>
                )}
              </div>
              <button onClick={() => { setShowResults(false); setQuery(''); dispatch({ type: 'SET_DIAGNOSIS', payload: null }) }} style={{
                fontSize: 10, padding: '4px 10px', background: c.btnBg, border: `1px solid ${c.btnBorder}`,
                borderRadius: 4, color: c.btnText, cursor: 'pointer', fontFamily: 'inherit',
              }}>New Investigation</button>
            </div>
            <p style={{ fontSize: 13, color: c.heading, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {diag ? diag.root_cause_analysis : ragAnswer}
            </p>
          </div>

          {diag && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Alert Details */}
                {diag.alert && (
                  <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '16px 18px', animation: 'inv-slideUp 0.4s ease 0.2s both' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: c.heading, marginBottom: 14 }}>Alert Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{
                        padding: '10px 12px', borderRadius: 8,
                        background: diag.alert.severity === 'critical' ? c.criticalCardBg : c.warningCardBg,
                        border: `1px solid ${diag.alert.severity === 'critical' ? c.criticalCardBorder : c.warningCardBorder}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                            color: severityColor(diag.alert.severity),
                            background: `${severityColor(diag.alert.severity)}18`,
                            padding: '1px 5px', borderRadius: 3,
                          }}>{diag.alert.severity}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.heading }}>{diag.alert.alert_type?.replace(/_/g, ' ')}</span>
                        </div>
                        <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.5 }}>{diag.alert.message}</div>
                        {diag.alert.metrics && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            {Object.entries(diag.alert.metrics).map(([k, v]) => (
                              <span key={k} style={{ fontSize: 10, color: c.dim }}>
                                {k.replace(/_/g, ' ')}: <span style={{ color: c.heading, fontWeight: 600 }}>{typeof v === 'number' ? v.toFixed(4) : v}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Similar Past Incidents */}
                <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '16px 18px', animation: 'inv-slideUp 0.4s ease 0.3s both' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: c.heading, marginBottom: 14 }}>Similar Past Incidents</h3>
                  <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>
                    {diag.similar_incidents || 'No similar incidents found.'}
                  </div>
                </div>
              </div>

              {/* Recommended Actions */}
              {diag.recommended_actions?.length > 0 && (
                <div style={{ marginTop: 12, background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '16px 18px', animation: 'inv-slideUp 0.4s ease 0.4s both' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: c.heading, marginBottom: 14 }}>Recommended Actions</h3>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {diag.recommended_actions.map((a, i) => {
                      const priorityLabel = a.priority === 1 ? 'recommended' : a.priority === 2 ? 'follow-up' : a.requires_approval ? 'approval required' : 'preventive'
                      const pColor = a.priority === 1 ? '#3b82f6' : a.priority === 2 ? '#f59e0b' : a.requires_approval ? '#ef4444' : '#64748b'
                      return (
                        <div key={i} style={{
                          flex: '1 1 200px', padding: '14px 16px', borderRadius: 8,
                          background: a.priority === 1 ? c.actionHighlightBg : c.actionDefaultBg,
                          border: `1px solid ${a.priority === 1 ? c.actionHighlightBorder : c.actionDefaultBorder}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                              color: pColor, background: `${pColor}18`,
                              padding: '2px 6px', borderRadius: 3,
                            }}>P{a.priority} {'\u00B7'} {priorityLabel}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: c.heading, marginBottom: 4 }}>{a.action}</div>
                          {a.requires_approval && (
                            <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>Requires human approval</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleExecutePlan}
                    disabled={executingPlan}
                    style={{
                      marginTop: 14, padding: '10px 24px', borderRadius: 8, border: 'none',
                      background: executingPlan ? c.disabledBg : 'linear-gradient(135deg, #10b981, #059669)',
                      color: executingPlan ? c.disabledText : '#fff',
                      fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                      cursor: executingPlan ? 'wait' : 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {executingPlan ? 'Setting up...' : 'Execute Remediation Plan \u2192'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Default State — Active Alerts + Templates + Past Incidents */}
      {!isSearching && !showResults && (
        <>
          {/* Active Alerts */}
          <div style={{ marginBottom: 20, animation: mounted ? 'inv-slideUp 0.4s ease 0.1s both' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.heading }}>Active Incidents</h3>
              {state.alerts.length > 0 && (
                <span style={{ fontSize: 9, background: '#ef4444', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '1px 7px' }}>{state.alerts.length}</span>
              )}
            </div>
            {state.alerts.length === 0 ? (
              <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '24px', textAlign: 'center', color: c.faint, fontSize: 12 }}>
                No active alerts. Click below to check for issues, or search above.
                <div style={{ marginTop: 10 }}>
                  <button onClick={async () => {
                    try {
                      const d = await postJSON('/api/alerts/check')
                      dispatch({ type: 'SET_ALERTS', payload: d.alerts || [] })
                    } catch {}
                  }} style={{
                    padding: '6px 14px', borderRadius: 6, border: `1px solid ${c.btnBorder}`,
                    background: c.btnBg, color: c.btnText, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                  }}>Check for Alerts</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(state.alerts.length, 3)}, 1fr)`, gap: 10 }}>
                {state.alerts.slice(0, 3).map((alert, idx) => (
                  <div key={alert.alert_id || idx} style={{
                    background: alert.severity === 'critical' ? c.criticalCardBg : c.cardBg,
                    border: `1px solid ${alert.severity === 'critical' ? c.criticalCardBorder : c.warningCardBorder}`,
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'transform 0.2s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 9, color: c.faint, fontWeight: 600 }}>{alert.alert_id || `ALERT-${idx + 1}`}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: severityColor(alert.severity), background: `${severityColor(alert.severity)}18`, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{alert.severity}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.heading, marginBottom: 6, lineHeight: 1.4 }}>
                      {alert.alert_type?.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) || 'Alert'}
                    </div>
                    {alert.metrics && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        {Object.entries(alert.metrics).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 10, color: severityColor(alert.severity), fontWeight: 600 }}>
                            {k.replace(/_/g, ' ')}: {typeof v === 'number' ? v.toFixed(4) : v}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: c.dim, marginBottom: 10, lineHeight: 1.4 }}>{alert.message}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <StatusPulse status={alert.severity} />
                        <span style={{ fontSize: 10, color: c.faint }}>{alert.affected_component} {'\u00B7'} {timeAgo(alert.timestamp)}</span>
                      </div>
                      <button onClick={() => startInvestigation(`Investigate ${alert.alert_type}: ${alert.message}`, alert)} style={{
                        fontSize: 9, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(59,130,246,0.3)',
                        background: 'rgba(59,130,246,0.08)', color: '#60a5fa', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      }}>Investigate {'\u2192'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Quick Investigation Templates */}
            <div style={{ animation: mounted ? 'inv-slideUp 0.4s ease 0.2s both' : 'none' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.heading, marginBottom: 12 }}>Quick Investigations</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK_TEMPLATES.map((t) => (
                  <button key={t.label} onClick={() => startInvestigation(t.query)} style={{
                    padding: '12px 14px', background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'border-color 0.2s, transform 0.2s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.cardBorder; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 6 }}>{t.icon}</div>
                    <div style={{ fontSize: 11, color: c.heading, fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: c.faint }}>{t.tags[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Past Incidents (from Snowflake) */}
            <div style={{ animation: mounted ? 'inv-slideUp 0.4s ease 0.3s both' : 'none' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: c.heading, marginBottom: 12 }}>Recent Incidents</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state.incidents.length === 0 ? (
                  <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 8, padding: '16px', textAlign: 'center', color: c.faint, fontSize: 11 }}>
                    No past incidents loaded.
                  </div>
                ) : (
                  state.incidents.slice(0, 5).map((inc, idx) => (
                    <div key={inc.incident_id || idx} style={{
                      padding: '12px 14px', background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                      borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.2s',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = c.dark ? '#1e293b' : '#cbd5e1'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = c.cardBorder}
                      onClick={() => startInvestigation(`What happened during incident ${inc.incident_id}? Root cause: ${inc.root_cause}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, color: c.faint, fontWeight: 600 }}>{inc.incident_id}</span>
                          <span style={{
                            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                            color: inc.status === 'resolved' ? '#10b981' : '#f59e0b',
                            background: inc.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            padding: '1px 5px', borderRadius: 3,
                          }}>{inc.status || 'resolved'}</span>
                          <span style={{
                            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                            color: severityColor(inc.severity),
                            background: `${severityColor(inc.severity)}18`,
                            padding: '1px 5px', borderRadius: 3,
                          }}>{inc.severity}</span>
                        </div>
                        <span style={{ fontSize: 9, color: c.faint }}>{timeAgo(inc.ts)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: c.heading, marginBottom: 4, fontWeight: 500 }}>
                        {inc.alert_type?.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())} — {inc.affected_component}
                      </div>
                      <div style={{ fontSize: 10, color: c.dim, lineHeight: 1.4 }}>{inc.root_cause}</div>
                      {inc.duration_minutes && (
                        <div style={{ marginTop: 6, fontSize: 9, color: c.faint }}>Resolved in {inc.duration_minutes}min</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
