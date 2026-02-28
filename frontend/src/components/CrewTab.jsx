import { useApp } from '../context/AppContext'
import Terminal from './Terminal'

const pipeline = [
  { role: 'Monitor Agent', description: 'Checks model metrics, detects anomalies, identifies drift patterns', color: 'text-cyan-400' },
  { role: 'Investigator Agent', description: 'Searches runbooks and historical incidents, performs root cause analysis', color: 'text-purple-400' },
  { role: 'Remediator Agent', description: 'Generates remediation plan, executes approved actions, triggers retraining', color: 'text-green-400' },
]

export default function CrewTab() {
  const { state, dispatch } = useApp()

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4">Crew Execution</h2>

      <Terminal
        lines={state.crewLines}
        onClear={() => dispatch({ type: 'CLEAR_CREW' })}
      />

      {state.crewResult && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm">
          <h3 className="font-semibold mb-2">Crew Result</h3>
          <pre className="whitespace-pre-wrap">
            {typeof state.crewResult === 'string' ? state.crewResult : JSON.stringify(state.crewResult, null, 2)}
          </pre>
        </div>
      )}

      {state.crewError && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{state.crewError}</p>
        </div>
      )}

      <div className="mt-6 bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
        <div className="space-y-4">
          {pipeline.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold ${step.color}`}>
                  {i + 1}
                </div>
                {i < pipeline.length - 1 && <div className="w-0.5 h-6 bg-gray-800 mt-1" />}
              </div>
              <div>
                <h4 className={`font-medium ${step.color}`}>{step.role}</h4>
                <p className="text-sm text-gray-400 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
