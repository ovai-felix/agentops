import { useMemo, useRef, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { postJSON } from '../api'
import Terminal from './Terminal'

const pipeline = [
  { role: 'Monitor Agent', agent: 'ML Model Monitor', description: 'Checks model metrics, detects anomalies, identifies drift patterns', color: 'cyan' },
  { role: 'Investigator Agent', agent: 'ML Incident Investigator', description: 'Searches runbooks and historical incidents, performs root cause analysis', color: 'purple' },
  { role: 'Remediator Agent', agent: 'ML Operations Remediator', description: 'Generates remediation plan, executes approved actions, triggers retraining', color: 'green' },
]

const agentAccentColors = {
  'ML Model Monitor': 'border-t-cyan-400',
  'ML Incident Investigator': 'border-t-purple-400',
  'ML Operations Remediator': 'border-t-green-400',
}

const agentLabels = {
  'ML Model Monitor': 'Monitor Agent',
  'ML Incident Investigator': 'Investigator Agent',
  'ML Operations Remediator': 'Remediator Agent',
}

function derivePhases(lines, crewRunning, crewResult, crewError) {
  const agentsSeen = new Set()
  const agentsCompleted = new Set()
  let lastAgent = null

  for (const line of lines) {
    if (line.agent) {
      agentsSeen.add(line.agent)
      lastAgent = line.agent
    }
    if (line.agent && agentsSeen.size > 1) {
      for (const a of agentsSeen) {
        if (a !== line.agent) agentsCompleted.add(a)
      }
    }
  }

  if (crewResult || crewError) {
    for (const a of agentsSeen) agentsCompleted.add(a)
  }

  return pipeline.map((step) => {
    if (agentsCompleted.has(step.agent)) return 'complete'
    if (agentsSeen.has(step.agent) && step.agent === lastAgent && crewRunning) return 'active'
    if (agentsSeen.has(step.agent)) return 'complete'
    return 'pending'
  })
}

const checkpointLabels = {
  agent_start: 'Agent started',
  tool_call: 'Running tool',
  task_complete: 'Task complete',
  reasoning: 'Reasoning',
  error: 'Error',
  complete: 'Done',
}

function deriveCheckpoint(lines, phase) {
  if (phase === 'pending') return null
  if (phase === 'complete') {
    const lastSignificant = [...lines].reverse().find(l =>
      l.event_type === 'task_complete' || l.event_type === 'complete'
    )
    if (lastSignificant) {
      const text = lastSignificant.data?.length > 60
        ? lastSignificant.data.slice(0, 60) + '...'
        : lastSignificant.data
      return { label: 'Complete', text, type: 'complete' }
    }
    return { label: 'Complete', text: `${lines.length} lines processed`, type: 'complete' }
  }
  // active — find last significant event
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const label = checkpointLabels[line.event_type]
    if (label) {
      const text = line.data?.length > 60 ? line.data.slice(0, 60) + '...' : line.data
      return { label, text, type: line.event_type }
    }
  }
  return { label: 'Processing', text: 'Working...', type: 'active' }
}

function StatusCheckpoint({ lines, phase, accentColor, dark }) {
  const checkpoint = deriveCheckpoint(lines, phase)
  if (!checkpoint) return (
    <div className={`mt-1.5 px-3 py-1.5 rounded text-[10px] ${
      dark ? 'bg-gray-900 text-gray-600' : 'bg-gray-100 text-gray-400'
    }`}>
      Pending
    </div>
  )

  const dotColor = checkpoint.type === 'complete'
    ? (dark ? 'bg-green-400' : 'bg-green-500')
    : checkpoint.type === 'error'
      ? (dark ? 'bg-red-400' : 'bg-red-500')
      : (accentColor ? accentColor.replace('border-t-', 'bg-') : (dark ? 'bg-gray-400' : 'bg-gray-500'))

  return (
    <div className={`mt-1.5 px-3 py-1.5 rounded text-[10px] flex items-center gap-2 transition-all duration-300 ${
      dark ? 'bg-gray-900/80 text-gray-400' : 'bg-gray-100 text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${
        phase === 'active' ? 'animate-pulse' : ''
      }`} />
      <span className="font-semibold shrink-0">{checkpoint.label}</span>
      <span className="truncate opacity-70">{checkpoint.text}</span>
    </div>
  )
}

// Friendly labels for tool names
const toolDisplayNames = {
  query_model_metrics: 'Query model metrics',
  query_feature_drift: 'Check feature drift',
  query_data_quality: 'Check data quality',
  check_model_health: 'Check model health',
  query_metric_trend: 'Query metric trends',
  search_runbooks: 'Search runbooks',
  search_incidents: 'Search past incidents',
  trigger_retraining: 'Trigger retraining',
  check_training_status: 'Check training status',
  rollback_model: 'Rollback model',
}

function extractToolName(data) {
  if (!data) return null
  // Match patterns like "Using tool: xyz", "Tool Name: xyz", "Tool: xyz"
  const match = data.match(/(?:using tool|tool name|tool):\s*(\S+)/i)
  return match ? match[1] : null
}

function deriveChecklist(lines, phase) {
  const items = []
  const seen = new Set()

  for (const line of lines) {
    if (line.event_type === 'agent_start' && !seen.has('__agent_start')) {
      seen.add('__agent_start')
      items.push({ id: '__agent_start', label: 'Agent initialized', status: 'done' })
    }
    if (line.event_type === 'tool_call') {
      const tool = extractToolName(line.data)
      if (tool && !seen.has(tool)) {
        seen.add(tool)
        items.push({ id: tool, label: toolDisplayNames[tool] || tool, status: 'done' })
      }
    }
    if (line.event_type === 'reasoning' && !seen.has('__reasoning')) {
      seen.add('__reasoning')
      items.push({ id: '__reasoning', label: 'Analyzing results', status: 'done' })
    }
    if (line.event_type === 'task_complete' && !seen.has('__task_complete')) {
      seen.add('__task_complete')
      items.push({ id: '__task_complete', label: 'Task complete', status: 'done' })
    }
  }

  // Mark the last item as active if agent is still running
  if (phase === 'active' && items.length > 0) {
    items[items.length - 1].status = 'active'
  }

  return items
}

function TaskChecklist({ lines, phase, accentColor, dark }) {
  const items = useMemo(() => deriveChecklist(lines, phase), [lines, phase])

  if (phase === 'pending') return null

  const dotBg = accentColor ? accentColor.replace('border-t-', 'bg-') : 'bg-gray-400'

  return (
    <div className={`mt-1 px-2 py-1.5 rounded text-[10px] space-y-0.5 ${
      dark ? 'bg-gray-900/60 text-gray-400' : 'bg-gray-50 text-gray-500'
    }`}>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          {item.status === 'done' ? (
            <svg className={`w-3 h-3 shrink-0 ${dark ? 'text-green-400' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${dotBg}`} />
          )}
          <span className={item.status === 'active' ? 'font-semibold' : 'opacity-80'}>{item.label}</span>
        </div>
      ))}
      {items.length === 0 && (
        <div className="flex items-center gap-1.5 opacity-50">
          <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${dotBg}`} />
          <span>Starting...</span>
        </div>
      )}
    </div>
  )
}

function HandoffConnector({ visible, dark }) {
  if (!visible) return null
  return (
    <div
      className="flex flex-col items-center justify-center px-1 shrink-0 self-center"
      style={{ animation: 'handoffSlide 0.4s ease-out both' }}
    >
      <div className={`w-px flex-1 ${dark ? 'bg-gray-700' : 'bg-gray-300'}`} />
      <span className={`text-lg leading-none ${dark ? 'text-gray-500' : 'text-gray-400'}`}>▶</span>
      <div className={`w-px flex-1 ${dark ? 'bg-gray-700' : 'bg-gray-300'}`} />
    </div>
  )
}

function PipelineStep({ step, status, index, isLast, dark }) {
  const colorMap = dark ? {
    cyan: { text: 'text-cyan-400', bg: 'bg-cyan-400', ring: 'ring-cyan-400/30', glow: 'shadow-cyan-400/20' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-400', ring: 'ring-purple-400/30', glow: 'shadow-purple-400/20' },
    green: { text: 'text-green-400', bg: 'bg-green-400', ring: 'ring-green-400/30', glow: 'shadow-green-400/20' },
  } : {
    cyan: { text: 'text-cyan-700', bg: 'bg-cyan-500', ring: 'ring-cyan-500/30', glow: 'shadow-cyan-500/20' },
    purple: { text: 'text-purple-700', bg: 'bg-purple-500', ring: 'ring-purple-500/30', glow: 'shadow-purple-500/20' },
    green: { text: 'text-green-700', bg: 'bg-green-500', ring: 'ring-green-500/30', glow: 'shadow-green-500/20' },
  }
  const colors = colorMap[step.color]
  const circleBg = dark ? 'bg-gray-800' : 'bg-gray-200'
  const lineBg = dark ? 'bg-gray-800' : 'bg-gray-200'
  const badgeBg = dark ? 'bg-gray-800' : 'bg-gray-200'

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
          status === 'complete'
            ? `${colors.bg} text-gray-900 shadow-lg ${colors.glow}`
            : status === 'active'
              ? `${circleBg} ${colors.text} ring-2 ${colors.ring} animate-pulse`
              : `${circleBg} text-gray-600`
        }`}>
          {status === 'complete' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            index + 1
          )}
        </div>
        {!isLast && (
          <div className={`w-0.5 h-6 mt-1 transition-all duration-500 ${
            status === 'complete' ? colors.bg : lineBg
          }`} />
        )}
      </div>
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <h4 className={`font-medium transition-colors duration-300 ${
            status === 'pending' ? (dark ? 'text-gray-600' : 'text-gray-400') : colors.text
          }`}>
            {step.role}
          </h4>
          {status === 'active' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeBg} ${colors.text} animate-pulse`}>
              Running
            </span>
          )}
          {status === 'complete' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeBg} ${dark ? 'text-green-400' : 'text-green-600'}`}>
              Done
            </span>
          )}
        </div>
        <p className={`text-sm mt-0.5 transition-colors duration-300 ${
          status === 'pending' ? (dark ? 'text-gray-700' : 'text-gray-400') : (dark ? 'text-gray-400' : 'text-gray-500')
        }`}>
          {step.description}
        </p>
      </div>
    </div>
  )
}

export default function CrewTab() {
  const { state, dispatch } = useApp()
  const t = useTheme()
  const monitorRef = useRef(null)
  const investigatorRef = useRef(null)
  const remediatorRef = useRef(null)

  const phases = useMemo(
    () => derivePhases(state.crewLines, state.crewRunning, state.crewResult, state.crewError),
    [state.crewLines, state.crewRunning, state.crewResult, state.crewError]
  )

  // Filter lines per agent. Lines with agent=null go to whichever agent is currently active.
  const { monitorLines, investigatorLines, remediatorLines } = useMemo(() => {
    const monitor = []
    const investigator = []
    const remediator = []
    let currentAgent = null

    for (const line of state.crewLines) {
      if (line.event_type === 'crew_start') continue // skip global events

      if (line.agent) currentAgent = line.agent

      if (line.agent === 'ML Model Monitor' || (!line.agent && currentAgent === 'ML Model Monitor')) {
        monitor.push(line)
      } else if (line.agent === 'ML Incident Investigator' || (!line.agent && currentAgent === 'ML Incident Investigator')) {
        investigator.push(line)
      } else if (line.agent === 'ML Operations Remediator' || (!line.agent && currentAgent === 'ML Operations Remediator')) {
        remediator.push(line)
      } else if (!line.agent && !currentAgent) {
        // Before any agent starts, route to monitor
        monitor.push(line)
      }
    }

    return { monitorLines: monitor, investigatorLines: investigator, remediatorLines: remediator }
  }, [state.crewLines])

  const completedCount = phases.filter(p => p === 'complete').length

  // AI summary of crew result
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const summaryRequestedRef = useRef(null)

  useEffect(() => {
    if (!state.crewResult || summaryRequestedRef.current === state.crewResult) return
    summaryRequestedRef.current = state.crewResult
    setSummary(null)
    setSummaryLoading(true)
    const text = typeof state.crewResult === 'string' ? state.crewResult : JSON.stringify(state.crewResult)
    postJSON('/api/crew/summarize', { text })
      .then(res => setSummary(res.summary))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [state.crewResult])

  // Auto-scroll active terminal into view on agent transition
  const activeIndex = phases.indexOf('active')
  const prevActiveRef = useRef(activeIndex)
  useEffect(() => {
    if (activeIndex !== prevActiveRef.current) {
      prevActiveRef.current = activeIndex
      const refs = [monitorRef, investigatorRef, remediatorRef]
      const targetRef = refs[activeIndex]
      if (targetRef?.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [activeIndex])

  return (
    <div>
      <h2 className={`text-2xl font-bold ${t.heading} mb-4`}>Crew Execution</h2>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {/* Side-by-side agent terminals */}
          <div className="flex gap-0 items-stretch h-[420px]">
            {/* Monitor Agent Terminal */}
            <div ref={monitorRef} className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <Terminal
                  lines={monitorLines}
                  title={agentLabels['ML Model Monitor']}
                  accentColor={agentAccentColors['ML Model Monitor']}
                  active={phases[0] === 'active'}
                  compact={phases[0] === 'complete' || phases[0] === 'pending'}
                />
              </div>
              <StatusCheckpoint
                lines={monitorLines}
                phase={phases[0]}
                accentColor={agentAccentColors['ML Model Monitor']}
                dark={t.dark}
              />
              <TaskChecklist
                lines={monitorLines}
                phase={phases[0]}
                accentColor={agentAccentColors['ML Model Monitor']}
                dark={t.dark}
              />
            </div>

            {/* Handoff: Monitor → Investigator */}
            <HandoffConnector
              visible={phases[0] === 'complete' && phases[1] !== 'pending'}
              dark={t.dark}
            />

            {/* Investigator Agent Terminal */}
            <div ref={investigatorRef} className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <Terminal
                  lines={investigatorLines}
                  title={agentLabels['ML Incident Investigator']}
                  accentColor={agentAccentColors['ML Incident Investigator']}
                  active={phases[1] === 'active'}
                  compact={phases[1] === 'complete' || phases[1] === 'pending'}
                />
              </div>
              <StatusCheckpoint
                lines={investigatorLines}
                phase={phases[1]}
                accentColor={agentAccentColors['ML Incident Investigator']}
                dark={t.dark}
              />
              <TaskChecklist
                lines={investigatorLines}
                phase={phases[1]}
                accentColor={agentAccentColors['ML Incident Investigator']}
                dark={t.dark}
              />
            </div>

            {/* Handoff: Investigator → Remediator */}
            <HandoffConnector
              visible={phases[1] === 'complete' && phases[2] !== 'pending'}
              dark={t.dark}
            />

            {/* Remediator Agent Terminal */}
            <div ref={remediatorRef} className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <Terminal
                  lines={remediatorLines}
                  title={agentLabels['ML Operations Remediator']}
                  accentColor={agentAccentColors['ML Operations Remediator']}
                  active={phases[2] === 'active'}
                  compact={phases[2] === 'complete' || phases[2] === 'pending'}
                />
              </div>
              <StatusCheckpoint
                lines={remediatorLines}
                phase={phases[2]}
                accentColor={agentAccentColors['ML Operations Remediator']}
                dark={t.dark}
              />
              <TaskChecklist
                lines={remediatorLines}
                phase={phases[2]}
                accentColor={agentAccentColors['ML Operations Remediator']}
                dark={t.dark}
              />
            </div>
          </div>

          {state.crewResult && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${
              t.dark ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-green-50 border border-green-300 text-green-700'
            }`}>
              <h3 className="font-semibold mb-2">Crew Result</h3>

              {/* AI Summary */}
              {summaryLoading && (
                <div className={`mb-3 p-3 rounded-md flex items-center gap-2 ${
                  t.dark ? 'bg-green-900/40' : 'bg-green-100'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  <span className="text-xs">Generating AI summary...</span>
                </div>
              )}
              {summary && (
                <div className={`mb-3 p-3 rounded-md ${
                  t.dark ? 'bg-green-900/40' : 'bg-green-100'
                }`}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">AI Summary</h4>
                  <div className="whitespace-pre-wrap">{summary}</div>
                </div>
              )}

              <details>
                <summary className={`cursor-pointer text-xs ${t.dark ? 'text-green-400' : 'text-green-600'} hover:underline`}>
                  Show full output
                </summary>
                <pre className="whitespace-pre-wrap mt-2">
                  {typeof state.crewResult === 'string' ? state.crewResult : JSON.stringify(state.crewResult, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {state.crewError && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${
              t.dark ? 'bg-red-900/30 border border-red-700 text-red-300' : 'bg-red-50 border border-red-300 text-red-700'
            }`}>
              <h3 className="font-semibold mb-2">Error</h3>
              <p>{state.crewError}</p>
            </div>
          )}
        </div>

        <div className="xl:col-span-1">
          <div className={`${t.card} rounded-lg p-5 border ${t.border} sticky top-6`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-semibold ${t.heading}`}>Pipeline</h3>
              {state.crewRunning || completedCount > 0 ? (
                <span className={`text-xs ${t.textFaint}`}>{completedCount}/3</span>
              ) : null}
            </div>

            {(state.crewRunning || completedCount > 0) && (
              <div className="mb-5">
                <div className={`h-1.5 ${t.progressBg} rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(completedCount / 3) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-4">
              {pipeline.map((step, i) => (
                <PipelineStep
                  key={i}
                  step={step}
                  status={phases[i]}
                  index={i}
                  isLast={i === pipeline.length - 1}
                  dark={t.dark}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
