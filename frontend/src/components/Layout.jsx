import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="bg-gray-950 text-white min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
