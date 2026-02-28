import { useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { useCrewStream } from './api'
import Layout from './components/Layout'
import MetricsTab from './components/MetricsTab'
import DataQualityTab from './components/DataQualityTab'
import TrendsTab from './components/TrendsTab'
import AlertsTab from './components/AlertsTab'
import InvestigateTab from './components/InvestigateTab'
import ActionsTab from './components/ActionsTab'
import CrewTab from './components/CrewTab'

function TabContent() {
  const { state, dispatch } = useApp()

  const handleCrewEvent = useCallback((event) => {
    if (event.event_type === 'complete') {
      dispatch({ type: 'CREW_COMPLETE', payload: event.data })
    } else if (event.event_type === 'error') {
      dispatch({ type: 'CREW_ERROR', payload: event.data })
    } else if (event.event_type !== 'ping') {
      dispatch({ type: 'CREW_LINE', payload: event })
    }
  }, [dispatch])

  useCrewStream(handleCrewEvent, state.crewRunning)

  switch (state.activeTab) {
    case 'metrics':
      return <MetricsTab />
    case 'data':
      return <DataQualityTab />
    case 'trends':
      return <TrendsTab />
    case 'alerts':
      return <AlertsTab />
    case 'investigation':
      return <InvestigateTab />
    case 'actions':
      return <ActionsTab />
    case 'crew':
      return <CrewTab />
    default:
      return null
  }
}

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <TabContent />
      </Layout>
    </AppProvider>
  )
}
