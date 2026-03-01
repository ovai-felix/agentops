import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { fetchJSON, postJSON } from '../api'

const tabs = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'data', label: 'Data Quality' },
  { id: 'trends', label: 'Trends' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'actions', label: 'Actions' },
  { id: 'crew', label: 'Crew AI' },
]

function ServiceDot({ ok }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
  )
}

export default function Sidebar() {
  const { state, dispatch } = useApp()

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const data = await fetchJSON('/api/health')
        if (mounted) dispatch({ type: 'SET_SERVICES', payload: data })
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [dispatch])

  const handleStartCrew = async () => {
    if (state.crewRunning) return
    dispatch({ type: 'CREW_START' })
    dispatch({ type: 'SET_TAB', payload: 'crew' })
    try {
      await postJSON('/api/crew/start', {})
    } catch (err) {
      dispatch({ type: 'CREW_ERROR', payload: err.message })
    }
  }

  const services = state.services
  const dark = state.theme === 'dark'

  return (
    <div className={`w-[280px] border-r flex flex-col shrink-0 h-screen ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className={`p-5 border-b flex items-center justify-between ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${dark ? '' : 'text-gray-900'}`}>AgentOps</h1>
          <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>ML Monitoring Dashboard</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          className={`p-2 rounded-lg text-sm transition-colors ${dark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? '\u2600\uFE0F' : '\u{1F319}'}
        </button>
      </div>

      <div className={`p-4 border-b ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
        <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          Services
        </h2>
        {services && typeof services === 'object' ? (
          <div className="space-y-2">
            {Object.entries(services).map(([name, info]) => (
              <div key={name} className="flex items-center gap-2 text-sm">
                <ServiceDot ok={info != null && (typeof info === 'object' ? info.status === 'ok' : !!info)} />
                <span className={`capitalize ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-400'}`}>Loading...</p>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
            className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
              state.activeTab === tab.id
                ? dark ? 'bg-gray-800 text-white font-medium' : 'bg-gray-200 text-gray-900 font-medium'
                : dark ? 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={`p-4 border-t ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={handleStartCrew}
          disabled={state.crewRunning}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
            state.crewRunning
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {state.crewRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Crew Running...
            </span>
          ) : (
            'Run Full Crew'
          )}
        </button>
        {state.crewResult && (
          <div className="mt-2 text-xs text-green-400 text-center">Completed</div>
        )}
        {state.crewError && (
          <div className="mt-2 text-xs text-red-400 text-center">Error</div>
        )}
      </div>
    </div>
  )
}
