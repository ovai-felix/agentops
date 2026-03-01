import React, { useEffect, useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { fetchJSON } from '../api'

function getStatus(psi) {
  if (psi > 0.25) return 'drift'
  if (psi > 0.1) return 'warning'
  return 'stable'
}

const statusConfig = {
  drift: { label: 'Drift', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '⚠' },
  warning: { label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '◈' },
  stable: { label: 'Stable', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '✓' },
}

/* ---------- Mini distribution chart (SVG) ---------- */
function DistributionChart({ shift, dark }) {
  const w = 120, h = 40
  const absShift = Math.abs(shift || 0)
  const offsetX = Math.min(absShift * 30, 20)

  function gaussianPath(cx, color, opacity) {
    const pts = []
    for (let i = 0; i <= w; i += 2) {
      const x = (i - cx) / 18
      const y = h - Math.exp(-0.5 * x * x) * (h - 6) - 3
      pts.push(`${i},${y}`)
    }
    return (
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={opacity}
      />
    )
  }

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {gaussianPath(w / 2, dark ? '#475569' : '#94a3b8', 0.6)}
      {gaussianPath(w / 2 + offsetX, absShift > 0.25 ? '#ef4444' : absShift > 0.1 ? '#f59e0b' : '#10b981', 0.9)}
    </svg>
  )
}

/* ---------- Horizontal metric bar ---------- */
function MetricBar({ value, max, thresholds, color }) {
  const pct = Math.min((value / (max || 1)) * 100, 100)
  return (
    <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(100,116,139,0.15)', width: 80 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2, width: `${pct}%`, background: color, transition: 'width 0.6s ease' }} />
      {thresholds?.map((t, i) => (
        <div key={i} style={{ position: 'absolute', left: `${Math.min((t / (max || 1)) * 100, 100)}%`, top: -2, width: 1, height: 8, background: '#f59e0b', opacity: 0.5 }} />
      ))}
    </div>
  )
}

/* ---------- PSI Overview Bar ---------- */
function PSIOverviewBar({ features, dark }) {
  const sorted = [...features].sort((a, b) => b.psi_score - a.psi_score)
  const maxPsi = Math.max(...sorted.map(f => f.psi_score), 0.01)

  return (
    <div style={{
      background: dark ? '#0d0d1a' : '#ffffff',
      border: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: dark ? '#94a3b8' : '#64748b', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        PSI Distribution Overview
      </div>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 48 }}>
        {sorted.map((f, i) => {
          const status = getStatus(f.psi_score)
          const pct = (f.psi_score / maxPsi) * 100
          return (
            <div
              key={i}
              title={`${f.feature_name}: ${f.psi_score.toFixed(4)}`}
              style={{
                flex: 1,
                height: `${Math.max(pct, 4)}%`,
                background: statusConfig[status].color,
                borderRadius: '2px 2px 0 0',
                opacity: 0.8,
                transition: 'height 0.6s ease',
                cursor: 'default',
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: dark ? '#475569' : '#94a3b8' }}>
        <span>Highest PSI</span>
        <span>Lowest PSI</span>
      </div>
    </div>
  )
}

/* ---------- Summary Card ---------- */
function SummaryCard({ label, value, sub, color, dark }) {
  return (
    <div style={{
      background: dark ? '#0d0d1a' : '#ffffff',
      border: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
      borderRadius: 12,
      padding: '14px 18px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: dark ? '#64748b' : '#94a3b8', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || (dark ? '#f8fafc' : '#0f172a'), lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: dark ? '#475569' : '#94a3b8', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  )
}

/* ---------- Sortable Header ---------- */
function SortHeader({ label, sortKey, sortCol, sortDir, onSort, dark }) {
  const active = sortCol === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color: active ? (dark ? '#e2e8f0' : '#0f172a') : (dark ? '#64748b' : '#94a3b8'),
        cursor: 'pointer',
        userSelect: 'none',
        fontWeight: 600,
        borderBottom: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {active && (
        <span style={{ marginLeft: 4, opacity: 0.6 }}>
          {sortDir === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  )
}

/* ---------- Expandable Detail Row ---------- */
function DetailRow({ feature, dark }) {
  const status = getStatus(feature.psi_score)
  const sc = statusConfig[status]

  return (
    <tr>
      <td colSpan={7} style={{ padding: 0 }}>
        <div style={{
          background: dark ? 'rgba(15,15,30,0.5)' : 'rgba(248,250,252,0.8)',
          borderBottom: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {/* Distribution comparison */}
            <div>
              <div style={{ fontSize: 10, color: dark ? '#64748b' : '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Distribution Comparison
              </div>
              <DistributionChart shift={feature.mean_shift} dark={dark} />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: dark ? '#475569' : '#94a3b8' }}>
                <span>— Baseline</span>
                <span style={{ color: sc.color }}>— Current</span>
              </div>
            </div>

            {/* Statistics */}
            <div>
              <div style={{ fontSize: 10, color: dark ? '#64748b' : '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Statistics
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {[
                  ['PSI Score', feature.psi_score?.toFixed(4)],
                  ['KS Statistic', feature.ks_statistic?.toFixed(4)],
                  ['Mean Shift', feature.mean_shift?.toFixed(4)],
                  ['Std Shift', feature.std_shift?.toFixed(4)],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: dark ? '#64748b' : '#94a3b8' }}>{lbl}</span>
                    <span style={{ color: dark ? '#e2e8f0' : '#0f172a', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div style={{ fontSize: 10, color: dark ? '#64748b' : '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {status === 'drift' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({
                        type: 'PREFILL_INVESTIGATION',
                        payload: {
                          query: `Investigate drift on feature ${feature.feature_name}: PSI=${feature.psi_score.toFixed(4)}, KS=${feature.ks_statistic?.toFixed(4)}, mean_shift=${feature.mean_shift?.toFixed(4)}, std_shift=${feature.std_shift?.toFixed(4)}`,
                          metadata: {
                            feature_name: feature.feature_name,
                            psi_score: feature.psi_score,
                            ks_statistic: feature.ks_statistic,
                            mean_shift: feature.mean_shift,
                            std_shift: feature.std_shift,
                            status,
                          },
                        },
                      })
                      dispatch({ type: 'SET_TAB', payload: 'investigation' })
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Investigate Drift
                  </button>
                )}
                <button style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
                  background: 'transparent',
                  color: dark ? '#94a3b8' : '#64748b',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}>
                  View History
                </button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

/* ========== Main Component ========== */
export default function DataQualityTab() {
  const { state, dispatch } = useApp()
  const { dark } = useTheme()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('psi_score')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedRow, setExpandedRow] = useState(null)

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

  const features = state.featureDrift || []

  const counts = useMemo(() => {
    const c = { drift: 0, warning: 0, stable: 0 }
    features.forEach(f => { c[getStatus(f.psi_score)]++ })
    return c
  }, [features])

  const avgPsi = useMemo(() => {
    if (!features.length) return 0
    return features.reduce((s, f) => s + f.psi_score, 0) / features.length
  }, [features])

  const maxPsi = useMemo(() => {
    if (!features.length) return 0
    return Math.max(...features.map(f => f.psi_score))
  }, [features])

  const filtered = useMemo(() => {
    let list = features
    if (filter !== 'all') {
      list = list.filter(f => getStatus(f.psi_score) === filter)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(f => f.feature_name?.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      const av = a[sortCol] ?? 0
      const bv = b[sortCol] ?? 0
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [features, filter, search, sortCol, sortDir])

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: dark ? '#64748b' : '#94a3b8' }}>
        Loading data quality metrics...
      </div>
    )
  }

  const filterTabs = [
    { key: 'all', label: 'All', count: features.length },
    { key: 'drift', label: 'Drift', count: counts.drift, color: '#ef4444' },
    { key: 'warning', label: 'Warning', count: counts.warning, color: '#f59e0b' },
    { key: 'stable', label: 'Stable', count: counts.stable, color: '#10b981' },
  ]

  const maxTablePsi = Math.max(...features.map(f => f.psi_score), 0.01)
  const maxTableKs = Math.max(...features.map(f => f.ks_statistic || 0), 0.01)
  const maxTableMean = Math.max(...features.map(f => Math.abs(f.mean_shift || 0)), 0.01)

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 22,
          fontWeight: 800,
          color: dark ? '#f8fafc' : '#0f172a',
          margin: 0,
          letterSpacing: -0.5,
        }}>
          Data Quality & Feature Drift
        </h2>
        <p style={{ fontSize: 12, color: dark ? '#64748b' : '#94a3b8', marginTop: 4 }}>
          Monitoring {features.length} features across model pipeline
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <SummaryCard dark={dark} label="Drifted" value={counts.drift} sub="PSI > 0.25" color="#ef4444" />
        <SummaryCard dark={dark} label="Warning" value={counts.warning} sub="PSI 0.10–0.25" color="#f59e0b" />
        <SummaryCard dark={dark} label="Stable" value={counts.stable} sub="PSI < 0.10" color="#10b981" />
        <SummaryCard dark={dark} label="Avg PSI" value={avgPsi.toFixed(3)} />
        <SummaryCard dark={dark} label="Max PSI" value={maxPsi.toFixed(3)} color={maxPsi > 0.25 ? '#ef4444' : maxPsi > 0.1 ? '#f59e0b' : '#10b981'} />
      </div>

      {/* PSI Overview Bar */}
      {features.length > 0 && <PSIOverviewBar features={features} dark={dark} />}

      {/* Filter + Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '20px 0 12px',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {filterTabs.map(tab => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${active ? (tab.color || (dark ? '#334155' : '#cbd5e1')) : 'transparent'}`,
                  background: active ? (tab.color ? `${tab.color}15` : (dark ? '#1a1a2e' : '#f1f5f9')) : 'transparent',
                  color: active ? (tab.color || (dark ? '#e2e8f0' : '#0f172a')) : (dark ? '#64748b' : '#94a3b8'),
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: active ? (tab.color ? `${tab.color}25` : (dark ? '#334155' : '#e2e8f0')) : (dark ? '#1a1a2e' : '#f1f5f9'),
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
            background: dark ? '#0d0d1a' : '#ffffff',
            color: dark ? '#e2e8f0' : '#0f172a',
            fontSize: 12,
            outline: 'none',
            width: 200,
          }}
        />
      </div>

      {/* Feature Table */}
      <div style={{
        background: dark ? '#0d0d1a' : '#ffffff',
        border: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortHeader label="Feature" sortKey="feature_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} dark={dark} />
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: dark ? '#64748b' : '#94a3b8', fontWeight: 600, borderBottom: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}` }}>
                Status
              </th>
              <SortHeader label="PSI Score" sortKey="psi_score" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} dark={dark} />
              <SortHeader label="KS Statistic" sortKey="ks_statistic" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} dark={dark} />
              <SortHeader label="Mean Shift" sortKey="mean_shift" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} dark={dark} />
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: dark ? '#64748b' : '#94a3b8', fontWeight: 600, borderBottom: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}` }}>
                Distribution
              </th>
              <th style={{ padding: '10px 12px', width: 32, borderBottom: `1px solid ${dark ? '#1a1a2e' : '#e5e7eb'}` }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: dark ? '#475569' : '#94a3b8', fontSize: 13 }}>
                  No features match the current filter.
                </td>
              </tr>
            ) : filtered.map((f, i) => {
              const status = getStatus(f.psi_score)
              const sc = statusConfig[status]
              const isExpanded = expandedRow === i
              const absMeanShift = Math.abs(f.mean_shift || 0)

              return (
                <React.Fragment key={f.feature_name || i}>
                  <tr
                    onClick={() => setExpandedRow(isExpanded ? null : i)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: isExpanded ? 'none' : `1px solid ${dark ? '#1a1a2e' : '#f1f5f9'}`,
                      background: isExpanded ? (dark ? 'rgba(30,30,60,0.3)' : 'rgba(241,245,249,0.5)') : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = dark ? 'rgba(30,30,60,0.2)' : 'rgba(241,245,249,0.3)' }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Feature name */}
                    <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: dark ? '#e2e8f0' : '#0f172a' }}>
                      {f.feature_name}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: sc.bg,
                        color: sc.color,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>

                    {/* PSI Score + bar */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: sc.color, minWidth: 50 }}>
                          {f.psi_score?.toFixed(4)}
                        </span>
                        <MetricBar value={f.psi_score} max={maxTablePsi} thresholds={[0.1, 0.25]} color={sc.color} />
                      </div>
                    </td>

                    {/* KS Statistic + bar */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: dark ? '#cbd5e1' : '#475569', minWidth: 50 }}>
                          {f.ks_statistic?.toFixed(4)}
                        </span>
                        <MetricBar value={f.ks_statistic || 0} max={maxTableKs} color={dark ? '#64748b' : '#94a3b8'} />
                      </div>
                    </td>

                    {/* Mean Shift + bar */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: dark ? '#cbd5e1' : '#475569', minWidth: 50 }}>
                          {f.mean_shift?.toFixed(4)}
                        </span>
                        <MetricBar value={absMeanShift} max={maxTableMean} color={absMeanShift > 0.5 ? '#ef4444' : '#64748b'} />
                      </div>
                    </td>

                    {/* Distribution chart */}
                    <td style={{ padding: '10px 12px' }}>
                      <DistributionChart shift={f.mean_shift} dark={dark} />
                    </td>

                    {/* Expand arrow */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        color: dark ? '#475569' : '#94a3b8',
                        fontSize: 14,
                      }}>
                        ▾
                      </span>
                    </td>
                  </tr>

                  {isExpanded && <DetailRow feature={f} dark={dark} />}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        fontSize: 10,
        color: dark ? '#475569' : '#94a3b8',
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {Object.entries(statusConfig).map(([key, sc]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
              {sc.label}
            </span>
          ))}
        </div>
        <span>PSI thresholds: 0.10 (warning) · 0.25 (drift)</span>
      </div>
    </div>
  )
}
