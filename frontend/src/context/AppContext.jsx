import { createContext, useContext, useReducer } from 'react'

const initialState = {
  services: { snowflake: null, rag: null, mlmonitor: null },
  modelMetrics: null,
  dataQuality: null,
  featureDrift: [],
  f1Trend: [],
  driftTrend: [],
  alerts: [],
  incidents: [],
  diagnosis: null,
  investigationPrefill: null,
  actions: [],
  crewRunning: false,
  crewResult: null,
  crewError: null,
  crewLines: [],
  activeTab: 'metrics',
  theme: 'dark',
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SERVICES':
      return { ...state, services: action.payload }
    case 'SET_METRICS':
      return { ...state, modelMetrics: action.payload }
    case 'SET_DATA_QUALITY':
      return { ...state, dataQuality: action.payload }
    case 'SET_FEATURE_DRIFT':
      return { ...state, featureDrift: action.payload }
    case 'SET_F1_TREND':
      return { ...state, f1Trend: action.payload }
    case 'SET_DRIFT_TREND':
      return { ...state, driftTrend: action.payload }
    case 'SET_ALERTS':
      return { ...state, alerts: action.payload }
    case 'SET_INCIDENTS':
      return { ...state, incidents: action.payload }
    case 'SET_DIAGNOSIS':
      return { ...state, diagnosis: action.payload }
    case 'PREFILL_INVESTIGATION':
      return { ...state, investigationPrefill: action.payload }
    case 'CLEAR_INVESTIGATION_PREFILL':
      return { ...state, investigationPrefill: null }
    case 'SET_ACTIONS':
      return { ...state, actions: action.payload }
    case 'UPDATE_ACTION':
      return {
        ...state,
        actions: state.actions.map((a, i) =>
          i === action.payload.index ? { ...a, ...action.payload.updates } : a
        ),
      }
    case 'CREW_START':
      return { ...state, crewRunning: true, crewResult: null, crewError: null, crewLines: [] }
    case 'CREW_LINE':
      return {
        ...state,
        crewLines: [...state.crewLines.slice(-999), action.payload],
      }
    case 'CREW_COMPLETE':
      return { ...state, crewRunning: false, crewResult: action.payload }
    case 'CREW_ERROR':
      return { ...state, crewRunning: false, crewError: action.payload }
    case 'CLEAR_CREW':
      return { ...state, crewLines: [], crewResult: null, crewError: null }
    case 'SET_TAB':
      return { ...state, activeTab: action.payload }
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }
    default:
      return state
  }
}

const AppContext = createContext()

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
