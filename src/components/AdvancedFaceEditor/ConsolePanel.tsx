import React, { useEffect, useRef } from 'react'

interface ConsolePanelProps {
  logs: string[]
  onClearLogs: () => void
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ logs, onClearLogs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="h-48 bg-gray-900 border-t border-gray-700 flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h4 className="text-sm font-medium text-gray-200 transition-colors duration-300">
          Console
        </h4>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            {logs.length} messages
          </span>
          <button
            onClick={onClearLogs}
            className="px-2 py-1 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors duration-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Logs */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            No console messages yet
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => {
              // Determine log level and styling
              let logStyle = 'text-gray-300'
              if (log.toLowerCase().includes('error')) {
                logStyle = 'text-red-400'
              } else if (log.toLowerCase().includes('warning')) {
                logStyle = 'text-yellow-400'
              } else if (log.toLowerCase().includes('success') || log.toLowerCase().includes('loaded') || log.toLowerCase().includes('found')) {
                logStyle = 'text-green-400'
              } else if (log.toLowerCase().includes('info') || log.toLowerCase().includes('scanning') || log.toLowerCase().includes('generating')) {
                logStyle = 'text-blue-400'
              }

              return (
                <div
                  key={`log-${index}-${log.substring(0, 20)}`}
                  className={`${logStyle} transition-colors duration-200`}
                >
                  {log}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Ready</span>
          <span>Verbose logging enabled</span>
        </div>
      </div>
    </div>
  )
}

export default ConsolePanel
