import { useEffect, useRef, useState } from 'react'

const typeColors = {
  agent_start: 'text-cyan-400',
  tool_call: 'text-yellow-400',
  task_complete: 'text-green-400',
  reasoning: 'text-gray-500',
  error: 'text-red-400',
  stdout: 'text-gray-300',
  crew_start: 'text-cyan-400',
  complete: 'text-green-400',
}

export default function Terminal({ lines, onClear }) {
  const containerRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  return (
    <div className="bg-gray-900 rounded-lg font-mono text-sm flex flex-col h-[500px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-2 text-gray-400 text-xs">Agent Terminal</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-gray-400 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={() => setAutoScroll(!autoScroll)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {lines.length === 0 && (
          <div className="text-gray-600 italic">
            Waiting for agent output...
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            {line.timestamp && (
              <span className="text-gray-600 shrink-0">
                {new Date(line.timestamp).toLocaleTimeString()}
              </span>
            )}
            {line.agent && (
              <span className="text-purple-400 shrink-0">[{line.agent}]</span>
            )}
            <span className={typeColors[line.event_type] || 'text-gray-300'}>
              {line.data}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
