import ReactMarkdown from 'react-markdown'
import { useTheme } from '../hooks/useTheme'

export default function Markdown({ children }) {
  const t = useTheme()

  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className={`text-xl font-bold ${t.heading} mt-4 mb-2`}>{children}</h1>,
        h2: ({ children }) => <h2 className={`text-lg font-semibold ${t.heading} mt-3 mb-2`}>{children}</h2>,
        h3: ({ children }) => <h3 className={`text-base font-semibold ${t.heading} mt-3 mb-1`}>{children}</h3>,
        p: ({ children }) => <p className={`text-sm ${t.text} mb-2 leading-relaxed`}>{children}</p>,
        ul: ({ children }) => <ul className={`text-sm ${t.text} list-disc pl-5 mb-2 space-y-1`}>{children}</ul>,
        ol: ({ children }) => <ol className={`text-sm ${t.text} list-decimal pl-5 mb-2 space-y-1`}>{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className={`font-semibold ${t.heading}`}>{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ inline, children }) =>
          inline
            ? <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${t.dark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{children}</code>
            : <code className={`block p-3 rounded-lg text-xs font-mono overflow-x-auto mb-2 ${t.dark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>{children}</code>,
        pre: ({ children }) => <pre className="mb-2">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className={`border-l-4 pl-4 my-2 italic ${t.dark ? 'border-gray-700 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{children}</a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
