import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../hooks/useTheme'

const darkTypeColors = {
  agent_start: 'text-cyan-400',
  tool_call: 'text-yellow-400',
  task_complete: 'text-green-400',
  reasoning: 'text-gray-500',
  error: 'text-red-400',
  stdout: 'text-gray-300',
  crew_start: 'text-cyan-400',
  complete: 'text-green-400',
}

const lightTypeColors = {
  agent_start: 'text-cyan-700',
  tool_call: 'text-amber-600',
  task_complete: 'text-green-700',
  reasoning: 'text-gray-400',
  error: 'text-red-600',
  stdout: 'text-gray-700',
  crew_start: 'text-cyan-700',
  complete: 'text-green-700',
}

function StreamingLine({ line, animate, dark }) {
  const [displayed, setDisplayed] = useState(animate ? '' : line.data)
  const [done, setDone] = useState(!animate)
  const typeColors = dark ? darkTypeColors : lightTypeColors

  useEffect(() => {
    if (!animate || !line.data) {
      setDisplayed(line.data)
      setDone(true)
      return
    }

    let idx = 0
    const text = line.data
    // Reveal ~3 chars per frame at 16ms, finishing in roughly 0.3-0.8s
    const charsPerTick = Math.max(1, Math.ceil(text.length / 50))

    const interval = setInterval(() => {
      idx += charsPerTick
      if (idx >= text.length) {
        setDisplayed(text)
        setDone(true)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, idx))
      }
    }, 16)

    return () => clearInterval(interval)
  }, [line.data, animate])

  return (
    <div className="animate-[fadeIn_0.15s_ease-out] break-words" style={{ overflowWrap: 'anywhere' }}>
      {line.timestamp && (
        <span className={`${dark ? 'text-gray-600' : 'text-gray-400'} mr-1`}>
          {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <span className={typeColors[line.event_type] || (dark ? 'text-gray-300' : 'text-gray-700')}>
        {displayed}
        {!done && (
          <span className={`inline-block w-1.5 h-3 ml-0.5 animate-pulse align-middle ${
            dark ? 'bg-green-400' : 'bg-green-600'
          }`} />
        )}
      </span>
    </div>
  )
}

export default function Terminal({ lines, onClear, title = 'Agent Terminal', compact = false, active = false, accentColor = '' }) {
  const containerRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [visibleCount, setVisibleCount] = useState(0)
  const prevLenRef = useRef(0)
  const timerRef = useRef(null)
  const t = useTheme()

  // Queue-based reveal: when new lines arrive, reveal them one at a time
  // with a small staggered delay so each line streams in sequentially
  useEffect(() => {
    const prevLen = prevLenRef.current
    const newLen = lines.length

    if (newLen <= prevLen) {
      // Lines were cleared or no change
      setVisibleCount(newLen)
      prevLenRef.current = newLen
      return
    }

    // New lines arrived — drip them in one by one
    const newLines = newLen - prevLen
    prevLenRef.current = newLen

    if (newLines === 1) {
      // Single line — show immediately with typing
      setVisibleCount(newLen)
      return
    }

    // Multiple lines arrived at once — stagger reveal
    let revealed = 0
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      revealed++
      setVisibleCount(prevLen + revealed)
      if (revealed >= newLines) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }, 60) // 60ms between each line reveal

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [lines.length])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [visibleCount, autoScroll])

  const visibleLines = lines.slice(0, visibleCount)

  return (
    <div className={`rounded-lg font-mono text-[11px] leading-relaxed flex flex-col border transition-all duration-500 ease-in-out h-full min-h-0 ${
      accentColor ? `border-t-4 ${accentColor}` : ''
    } ${
      compact ? 'opacity-60' : 'opacity-100'
    } ${
      t.dark
        ? 'bg-gray-950 border-gray-800'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={`flex items-center justify-between px-4 py-2 border-b shrink-0 ${
        t.dark
          ? 'border-gray-800 bg-gray-900/50'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center gap-2">
          {!compact && (
            <>
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </>
          )}
          {active && (
            <span className={`w-2 h-2 rounded-full animate-pulse ${accentColor ? accentColor.replace('border-t-', 'bg-') : 'bg-green-400'}`} />
          )}
          <span className={`${compact ? '' : 'ml-2'} text-xs ${t.dark ? 'text-gray-400' : 'text-gray-500'}`}>
            {title}
          </span>
          {lines.length > 0 && (
            <span className={`text-xs ml-2 ${t.dark ? 'text-gray-600' : 'text-gray-400'}`}>
              ({lines.length} lines)
            </span>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-1 text-xs cursor-pointer ${
              t.dark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={() => setAutoScroll(!autoScroll)}
                className="rounded"
              />
              Auto-scroll
            </label>
            {onClear && (
              <button
                onClick={onClear}
                className={`text-xs px-2 py-1 rounded ${
                  t.dark
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 break-words overflow-wrap-anywhere">
        {visibleLines.length === 0 && (
          <div className={`italic flex items-center gap-2 ${
            t.dark ? 'text-gray-600' : 'text-gray-400'
          }`}>
            <span className={`inline-block w-2 h-4 animate-pulse ${
              t.dark ? 'bg-gray-600' : 'bg-gray-400'
            }`} />
            Waiting for agent output...
          </div>
        )}
        {visibleLines.map((line, i) => (
          <StreamingLine
            key={i}
            line={line}
            animate={i === visibleCount - 1 && visibleCount === lines.length}
            dark={t.dark}
          />
        ))}
        {visibleLines.length > 0 && (
          <div className={`inline-block w-2 h-4 animate-pulse mt-1 ${
            t.dark ? 'bg-green-400' : 'bg-green-600'
          }`} />
        )}
      </div>
    </div>
  )
}
