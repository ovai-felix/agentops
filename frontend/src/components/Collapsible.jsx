import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'

export default function Collapsible({ title, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const t = useTheme()

  return (
    <div className={`${t.card} rounded-lg border ${t.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full text-left px-5 py-4 flex items-center justify-between ${t.hoverBg} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <h3 className={`text-lg font-semibold ${t.heading}`}>{title}</h3>
          {badge}
        </div>
        <span className={`text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''} ${t.textMuted}`}>
          &#9660;
        </span>
      </button>
      {open && (
        <div className={`px-5 pb-5 border-t ${t.border}`}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}
