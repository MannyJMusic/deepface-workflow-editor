import React, { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  node_id?: string
  message: string
}

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Connect to WebSocket for real-time logs
    const handleMessage = (data: any) => {
      if (data.type === 'log_message') {
        const logEntry: LogEntry = {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: data.timestamp || new Date().toISOString(),
          level: data.level || 'info',
          node_id: data.node_id,
          message: data.message,
        }
        
        setLogs(prev => [...prev, logEntry])
      }
    }

    const handleError = (error: any) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }

    const handleConnect = () => {
      setIsConnected(true)
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    // Connect to WebSocket
    apiClient.connectWebSocket(handleMessage, handleError)
    
    // Check connection status periodically
    const checkConnection = () => {
      const socket = (apiClient as any).socket
      if (socket && socket.readyState === WebSocket.OPEN) {
        setIsConnected(true)
      } else {
        setIsConnected(false)
      }
    }

    const interval = setInterval(checkConnection, 1000)

    return () => {
      clearInterval(interval)
      apiClient.disconnectWebSocket()
    }
  }, [])

  const filteredLogs = logs.filter(log => 
    filter === 'all' || log.level === filter
  )

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warn':
        return 'text-yellow-600 bg-yellow-50'
      case 'info':
        return 'text-blue-600 bg-blue-50'
      case 'debug':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800">Logs</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>

          <label className="flex items-center space-x-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Auto-scroll</span>
          </label>

          <button
            onClick={clearLogs}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No logs available
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded text-xs font-mono ${
                log.level === 'error' ? 'bg-red-50 border-l-2 border-red-500' :
                log.level === 'warn' ? 'bg-yellow-50 border-l-2 border-yellow-500' :
                'bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-2">
                <span className={`px-1 py-0.5 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className="text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.node_id && (
                  <span className="text-gray-500">
                    [{log.node_id}]
                  </span>
                )}
              </div>
              <div className="mt-1 text-gray-800">
                {log.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default LogViewer
