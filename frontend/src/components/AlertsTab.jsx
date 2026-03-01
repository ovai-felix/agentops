import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { fetchJSON, postJSON } from '../api'

const StatusPulse = ({ status }) => {
  const color = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981'
  return (
    <span style={{ display: 'inline-block', position: 'relative', width: 8, height: 8 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
      {status === 'critical' && (
        <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${color}`, animation: 'alt-pulse-ring 2s ease-out infinite' }} />
      )}
    </span>
  )
}

const severityColor = (s) => s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : s === 'info' ? '#3b82f6' : '#10b981'

const typeIcon = (t) => {
  const map = { accuracy_drop: '\u{1F4C9}', model_drift: '\u{1F500}', anomaly_spike: '\u{1F4CA}', data_quality: '\u{1F5C2}', latency: '\u{23F1}' }
  return map[t] || '\u26A0'
}

const typeLabel = (t) => (t || '').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())

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
    text: dark ? '#e2e8f0' : '#1e293b',
    heading: dark ? '#f8fafc' : '#0f172a',
    muted: dark ? '#94a3b8' : '#64748b',
    faint: dark ? '#475569' : '#94a3b8',
    dim: dark ? '#64748b' : '#94a3b8',
    cardBg: dark ? '#0d0d1a' : '#ffffff',
    cardBorder: dark ? '#1a1a2e' : '#e2e8f0',
    pageBg: dark ? '#0a0a14' : '#f8fafc',
    inputBg: dark ? '#111122' : '#f1f5f9',
    hoverBg: dark ? '#0e0e1e' : '#f1f5f9',
    tabActiveBg: dark ? '#1a1a3a' : '#eff6ff',
    tabActiveText: dark ? '#f8fafc' : '#1e293b',
    tabInactiveText: dark ? '#475569' : '#94a3b8',
    tabCountBg: dark ? '#1a1a3a' : '#e0e7ff',
    tabCountActiveBg: dark ? '#1a1a3a' : '#dbeafe',
    tabCountText: dark ? '#94a3b8' : '#3b82f6',
    tabCountInactiveText: dark ? '#475569' : '#94a3b8',
    filterBg: dark ? '#0d0d1a' : '#ffffff',
    filterBorder: dark ? '#1a1a2e' : '#e2e8f0',
    filterActiveBg: dark ? '#1a1a3a' : '#eff6ff',
    filterActiveText: dark ? '#f8fafc' : '#1e293b',
    filterInactiveText: dark ? '#475569' : '#94a3b8',
    metricBg: dark ? '#111122' : '#f8fafc',
    metricBorder: dark ? '#1a1a2e' : '#e2e8f0',
    metricValue: dark ? '#f8fafc' : '#0f172a',
    criticalBg: dark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)',
    criticalBorder: dark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
    warningBg: dark ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.02)',
    warningBorder: dark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.12)',
    summaryCardBg: dark ? '#0d0d1a' : '#ffffff',
    summaryCardBorder: dark ? '#1a1a2e' : '#e2e8f0',
    barEmpty: dark ? '#1a1a2e' : '#e2e8f0',
    rowBorder: dark ? '#111122' : '#f1f5f9',
    ackedBg: dark ? '#111122' : '#f1f5f9',
    ackedBorder: dark ? '#1a1a2e' : '#e2e8f0',
    ackedText: dark ? '#475569' : '#94a3b8',
    btnBg: dark ? '#111122' : '#f1f5f9',
    btnBorder: dark ? '#1a1a2e' : '#d1d5db',
    btnText: dark ? '#94a3b8' : '#64748b',
    disabledBg: dark ? '#1a1a3a' : '#e2e8f0',
    disabledText: dark ? '#64748b' : '#94a3b8',
    toggleOn: '#10b981',
    toggleOff: dark ? '#1a1a2e' : '#d1d5db',
    toggleDot: dark ? '#fff' : '#fff',
    tableHeaderBg: dark ? '#0a0a14' : '#f8fafc',
    dropdownShadow: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)',
    glowShadow: dark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)',
    glowShadowStrong: dark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
  }
}

// Build frequency chart from real incident data (last 30 days)
function buildFrequencyData(incidents, alerts) {
  const days = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), critical: 0, warning: 0 })
  }
  const dayMap = Object.fromEntries(days.map(d => [d.key, d]))

  for (const inc of incidents) {
    if (!inc.ts) continue
    const key = new Date(inc.ts).toISOString().slice(0, 10)
    if (dayMap[key]) {
      if (inc.severity === 'critical') dayMap[key].critical++
      else dayMap[key].warning++
    }
  }
  // Add today's active alerts
  for (const a of alerts) {
    if (!a.timestamp) continue
    const key = new Date(a.timestamp).toISOString().slice(0, 10)
    if (dayMap[key]) {
      if (a.severity === 'critical') dayMap[key].critical++
      else dayMap[key].warning++
    }
  }
  return days
}

// Alert rules derived from config thresholds
const ALERT_RULES = [
  { name: 'F1 Score < 0.85', type: 'accuracy_drop', severity: 'critical', enabled: true },
  { name: 'Drift Score > 0.30', type: 'model_drift', severity: 'critical', enabled: true },
  { name: 'Latency p99 > 300ms', type: 'latency', severity: 'warning', enabled: true },
  { name: 'Null Rate > 3%', type: 'data_quality', severity: 'warning', enabled: true },
  { name: 'Prediction Volume < 20', type: 'anomaly_spike', severity: 'warning', enabled: true },
  { name: 'Feature PSI > 0.25', type: 'model_drift', severity: 'critical', enabled: false },
]

export default function AlertsTab() {
  const { state, dispatch } = useApp()
  const c = useColors()
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(false)
  const [expandedAlert, setExpandedAlert] = useState(null)
  const [investigating, setInvestigating] = useState(null)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(new Set())
  const [hoveredRow, setHoveredRow] = useState(null)
  const [activeTab, setActiveTab] = useState('active')

  useEffect(() => { setMounted(true) }, [])

  // Fetch incidents on mount
  useEffect(() => {
    if (state.incidents.length === 0) {
      fetchJSON('/api/incidents').then((data) => {
        dispatch({ type: 'SET_INCIDENTS', payload: Array.isArray(data) ? data : data.incidents || [] })
      }).catch(() => {})
    }
  }, [])

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

  const totalCritical = state.alerts.filter(a => a.severity === 'critical').length
  const totalWarning = state.alerts.filter(a => a.severity === 'warning').length
  const unacked = state.alerts.filter(a => !acknowledgedAlerts.has(a.alert_id)).length
  const avgDuration = state.incidents.length > 0
    ? Math.round(state.incidents.reduce((s, inc) => s + (inc.duration_minutes || 0), 0) / state.incidents.length)
    : 0

  const frequencyData = useMemo(() => buildFrequencyData(state.incidents, state.alerts), [state.incidents, state.alerts])
  const maxFreq = Math.max(...frequencyData.map(d => d.critical + d.warning), 1)

  const filteredHistory = useMemo(() => {
    let data = [...state.incidents]
    if (filterSeverity !== 'all') data = data.filter(h => h.severity === filterSeverity)
    if (filterType !== 'all') data = data.filter(h => h.alert_type === filterType)
    return data
  }, [state.incidents, filterSeverity, filterType])

  const uniqueTypes = useMemo(() => {
    const types = new Set(state.incidents.map(i => i.alert_type).filter(Boolean))
    return ['all', ...types]
  }, [state.incidents])

  return (
    <div style={{ color: c.text, fontSize: 13 }}>
      <style>{`
        @keyframes alt-pulse-ring { 0% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(2); } }
        @keyframes alt-slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes alt-fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes alt-criticalGlow {
          0%,100% { box-shadow: inset 0 0 0 1px ${c.criticalBorder}, 0 0 20px ${c.glowShadow}; }
          50% { box-shadow: inset 0 0 0 1px rgba(239,68,68,0.5), 0 0 30px ${c.glowShadowStrong}; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: c.heading, letterSpacing: '-0.02em' }}>Alerts</h1>
          <p style={{ fontSize: 11, color: c.faint, marginTop: 4 }}>
            {unacked} unacknowledged {'\u00B7'} {state.alerts.length} active {'\u00B7'} {state.incidents.length} resolved
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCheck} disabled={checking} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 10, fontFamily: 'inherit',
            cursor: checking ? 'wait' : 'pointer', fontWeight: 600,
            color: '#fff', background: checking ? c.disabledBg : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          }}>
            {checking ? 'Checking...' : 'Check Alerts Now'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20, animation: mounted ? 'alt-slideUp 0.4s ease both' : 'none' }}>
        {[
          { label: 'Active Critical', value: totalCritical, color: '#ef4444', bg: c.criticalBg, border: c.criticalBorder, glow: true },
          { label: 'Active Warning', value: totalWarning, color: '#f59e0b', bg: c.warningBg, border: c.warningBorder },
          { label: 'Unacknowledged', value: unacked, color: c.heading, bg: c.summaryCardBg, border: c.summaryCardBorder },
          { label: 'Avg Duration', value: avgDuration > 0 ? `${avgDuration}m` : '\u2014', color: c.muted, bg: c.summaryCardBg, border: c.summaryCardBorder },
          { label: 'Total Incidents', value: state.incidents.length + state.alerts.length, color: c.dim, bg: c.summaryCardBg, border: c.summaryCardBorder },
        ].map((card, i) => (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${card.border}`, borderRadius: 10, padding: '14px 16px',
            animation: mounted ? `alt-slideUp 0.4s ease ${i * 0.06}s both` : 'none',
            ...(card.glow && totalCritical > 0 ? { animation: `alt-slideUp 0.4s ease both, alt-criticalGlow 3s ease infinite` } : {}),
          }}>
            <div style={{ fontSize: 9, color: c.faint, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: card.color, letterSpacing: '-0.02em' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Alert Frequency Timeline */}
      <div style={{
        background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16,
        animation: mounted ? 'alt-slideUp 0.4s ease 0.15s both' : 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: c.dim, letterSpacing: '0.04em' }}>Alert Frequency — Last 30 Days</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 9, color: c.faint, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} /> Critical
            </span>
            <span style={{ fontSize: 9, color: c.faint, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} /> Warning
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, height: 36, alignItems: 'flex-end' }}>
          {frequencyData.map((d, i) => {
            const total = d.critical + d.warning
            const critH = total > 0 ? (d.critical / maxFreq) * 36 : 0
            const warnH = total > 0 ? (d.warning / maxFreq) * 36 : 0
            const isToday = i === frequencyData.length - 1
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'flex-end', height: '100%' }}
                title={`${d.label}: ${d.critical} critical, ${d.warning} warning`}>
                {critH > 0 && <div style={{ height: critH, background: '#ef4444', borderRadius: '2px 2px 0 0', opacity: isToday ? 1 : 0.6 }} />}
                {warnH > 0 && <div style={{ height: warnH, background: '#f59e0b', borderRadius: critH > 0 ? 0 : '2px 2px 0 0', opacity: isToday ? 1 : 0.6 }} />}
                {total === 0 && <div style={{ height: 2, background: c.barEmpty, borderRadius: 1 }} />}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: c.faint }}>{frequencyData[0]?.label}</span>
          <span style={{ fontSize: 9, color: c.faint }}>Today</span>
        </div>
      </div>

      {/* Tab Switch */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${c.cardBorder}`, animation: mounted ? 'alt-slideUp 0.4s ease 0.2s both' : 'none' }}>
        {[
          { id: 'active', label: 'Active Alerts', count: state.alerts.length },
          { id: 'historical', label: 'Historical Incidents', count: state.incidents.length },
          { id: 'rules', label: 'Alert Rules', count: ALERT_RULES.length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 20px', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'transparent', color: activeTab === tab.id ? c.tabActiveText : c.tabInactiveText,
            fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
          }}>
            {tab.label}
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 8,
              background: activeTab === tab.id ? c.tabCountActiveBg : c.tabCountBg,
              color: activeTab === tab.id ? c.tabCountText : c.tabCountInactiveText,
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Active Alerts Tab */}
      {activeTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'alt-fadeIn 0.3s ease' }}>
          {state.alerts.length === 0 ? (
            <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '32px', textAlign: 'center', color: c.faint, fontSize: 12 }}>
              No active alerts detected. Click "Check Alerts Now" to scan for issues.
            </div>
          ) : state.alerts.map((alert, i) => {
            const isExpanded = expandedAlert === alert.alert_id
            const isAcked = acknowledgedAlerts.has(alert.alert_id)
            return (
              <div key={alert.alert_id || i} style={{
                background: alert.severity === 'critical' && !isAcked ? c.criticalBg : c.cardBg,
                border: `1px solid ${alert.severity === 'critical' && !isAcked ? c.criticalBorder : isAcked ? c.ackedBorder : c.warningBorder}`,
                borderRadius: 10, overflow: 'hidden',
                animation: mounted ? `alt-slideUp 0.4s ease ${0.25 + i * 0.06}s both` : 'none',
                ...(alert.severity === 'critical' && !isAcked ? { animation: `alt-slideUp 0.4s ease ${0.25 + i * 0.06}s both, alt-criticalGlow 3s ease infinite` } : {}),
              }}>
                {/* Alert Header */}
                <div onClick={() => setExpandedAlert(isExpanded ? null : alert.alert_id)} style={{
                  padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'background 0.15s',
                }}>
                  <StatusPulse status={alert.severity} />
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: severityColor(alert.severity), background: `${severityColor(alert.severity)}18`,
                    padding: '3px 8px', borderRadius: 4, flexShrink: 0,
                  }}>{alert.severity}</span>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{typeIcon(alert.alert_type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isAcked ? c.ackedText : c.heading }}>
                      {typeLabel(alert.alert_type)}
                    </div>
                    <div style={{ fontSize: 10, color: c.faint, marginTop: 2 }}>
                      {alert.affected_component} {'\u00B7'} {timeAgo(alert.timestamp)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {isAcked && <span style={{ fontSize: 9, color: c.ackedText, background: c.ackedBg, padding: '2px 8px', borderRadius: 3, border: `1px solid ${c.ackedBorder}` }}>Acknowledged</span>}
                    <span style={{ fontSize: 10, color: c.faint, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>{'\u25B6'}</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div style={{ padding: '0 18px 16px', animation: 'alt-fadeIn 0.2s ease' }}>
                    <div style={{ borderTop: `1px solid ${c.cardBorder}`, paddingTop: 14 }}>
                      <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, marginBottom: 14 }}>{alert.message}</p>

                      {/* Metrics Grid */}
                      {alert.metrics && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                          {Object.entries(alert.metrics).map(([key, val]) => (
                            <div key={key} style={{ background: c.metricBg, border: `1px solid ${c.metricBorder}`, borderRadius: 6, padding: '8px 12px' }}>
                              <div style={{ fontSize: 9, color: c.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{key.replace(/_/g, ' ')}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: c.metricValue }}>{typeof val === 'number' ? val.toFixed(4) : val}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleInvestigate(alert) }}
                          disabled={investigating === alert.alert_id}
                          style={{
                            padding: '7px 16px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                            background: investigating === alert.alert_id ? c.disabledBg : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            color: investigating === alert.alert_id ? c.disabledText : '#fff',
                          }}
                        >
                          {investigating === alert.alert_id ? 'Investigating...' : '\u{1F50D} Investigate'}
                        </button>
                        {!isAcked && (
                          <button onClick={(e) => { e.stopPropagation(); setAcknowledgedAlerts(prev => new Set([...prev, alert.alert_id])) }} style={{
                            padding: '7px 16px', background: c.btnBg, border: `1px solid ${c.btnBorder}`, borderRadius: 6,
                            color: c.btnText, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                          }}>
                            {'\u2713'} Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Historical Incidents Tab */}
      {activeTab === 'historical' && (
        <div style={{ animation: 'alt-fadeIn 0.3s ease' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: c.filterBg, borderRadius: 6, padding: 3, border: `1px solid ${c.filterBorder}` }}>
              {['all', 'critical', 'warning'].map(s => (
                <button key={s} onClick={() => setFilterSeverity(s)} style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                  color: filterSeverity === s ? c.filterActiveText : c.filterInactiveText,
                  background: filterSeverity === s ? c.filterActiveBg : 'transparent',
                  fontWeight: filterSeverity === s ? 600 : 400, textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, background: c.filterBg, borderRadius: 6, padding: 3, border: `1px solid ${c.filterBorder}`, flexWrap: 'wrap' }}>
              {uniqueTypes.map(t => (
                <button key={t} onClick={() => setFilterType(t)} style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                  color: filterType === t ? c.filterActiveText : c.filterInactiveText,
                  background: filterType === t ? c.filterActiveBg : 'transparent',
                  fontWeight: filterType === t ? 600 : 400,
                }}>{t === 'all' ? 'All Types' : typeLabel(t)}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '100px 1fr 130px 90px 140px 80px 80px',
              padding: '10px 18px', borderBottom: `1px solid ${c.cardBorder}`, background: c.tableHeaderBg,
            }}>
              {['ID', 'Time', 'Type', 'Severity', 'Component', 'Duration', 'Status'].map(h => (
                <span key={h} style={{ fontSize: 9, color: c.faint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {filteredHistory.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: c.faint, fontSize: 12 }}>No incidents match the current filters.</div>
            ) : filteredHistory.map((h) => (
              <div key={h.incident_id || h.id}
                onMouseEnter={() => setHoveredRow(h.incident_id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid', gridTemplateColumns: '100px 1fr 130px 90px 140px 80px 80px',
                  padding: '10px 18px', borderBottom: `1px solid ${c.rowBorder}`, cursor: 'pointer',
                  background: hoveredRow === h.incident_id ? c.hoverBg : 'transparent', transition: 'background 0.15s',
                }}>
                <span style={{ fontSize: 10, color: c.faint }}>{h.incident_id}</span>
                <span style={{ fontSize: 11, color: c.muted }}>{h.ts ? new Date(h.ts).toLocaleString() : '\u2014'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{typeIcon(h.alert_type)}</span>
                  <span style={{ fontSize: 10, color: c.text }}>{typeLabel(h.alert_type)}</span>
                </div>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: severityColor(h.severity), background: `${severityColor(h.severity)}18`,
                  padding: '3px 8px', borderRadius: 4, width: 'fit-content',
                }}>{h.severity}</span>
                <div>
                  <span style={{ fontSize: 10, color: c.text }}>{h.affected_component}</span>
                </div>
                <span style={{ fontSize: 11, color: c.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {h.duration_minutes ? `${h.duration_minutes}m` : '\u2014'}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 600, color: '#10b981',
                  background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4, width: 'fit-content',
                }}>{h.status || 'resolved'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Rules Tab */}
      {activeTab === 'rules' && (
        <div style={{ animation: 'alt-fadeIn 0.3s ease' }}>
          <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: 10, overflow: 'hidden' }}>
            {ALERT_RULES.map((rule, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                borderBottom: i < ALERT_RULES.length - 1 ? `1px solid ${c.rowBorder}` : 'none',
                opacity: rule.enabled ? 1 : 0.45,
              }}>
                {/* Toggle */}
                <div style={{
                  width: 32, height: 18, borderRadius: 9, cursor: 'pointer', position: 'relative',
                  background: rule.enabled ? c.toggleOn : c.toggleOff, transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', background: c.toggleDot, position: 'absolute',
                    top: 2, left: rule.enabled ? 16 : 2, transition: 'left 0.2s',
                  }} />
                </div>

                <span style={{ fontSize: 12 }}>{typeIcon(rule.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: c.heading, fontWeight: 500 }}>{rule.name}</div>
                </div>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: severityColor(rule.severity), background: `${severityColor(rule.severity)}18`,
                  padding: '3px 8px', borderRadius: 4,
                }}>{rule.severity}</span>
                <button style={{
                  padding: '5px 12px', background: c.btnBg, border: `1px solid ${c.btnBorder}`, borderRadius: 5,
                  color: c.dim, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                }}>Edit</button>
              </div>
            ))}
          </div>
          <button style={{
            marginTop: 12, padding: '10px 20px', background: 'transparent', border: `1px dashed ${c.cardBorder}`,
            borderRadius: 8, color: c.faint, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
            width: '100%', transition: 'border-color 0.2s, color 0.2s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#60a5fa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.cardBorder; e.currentTarget.style.color = c.faint }}
          >+ Add Alert Rule</button>
        </div>
      )}
    </div>
  )
}
