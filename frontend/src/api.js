import { useEffect, useRef } from 'react'

export async function fetchJSON(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`)
  return res.json()
}

export async function postJSON(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path}: ${res.status}`)
  return res.json()
}

export function useCrewStream(onEvent, enabled) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return

    const eventSource = new EventSource('/api/crew/stream')
    const eventTypes = [
      'stdout', 'agent_start', 'tool_call', 'task_complete',
      'reasoning', 'complete', 'error', 'crew_start', 'ping',
    ]

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, (e) => {
        try {
          const data = JSON.parse(e.data)
          onEventRef.current({ ...data, event_type: type })
        } catch {
          onEventRef.current({ event_type: type, data: e.data })
        }
      })
    })

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => eventSource.close()
  }, [enabled])
}
