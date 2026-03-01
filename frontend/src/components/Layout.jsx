import { useApp } from '../context/AppContext'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const { state } = useApp()
  const dark = state.theme === 'dark'

  return (
    <div className={`min-h-screen flex ${dark ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
