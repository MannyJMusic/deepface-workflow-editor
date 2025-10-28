import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Play, Square, RotateCcw, Search, Download, Trash2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'

export interface ProcessInfo {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'completed'
  pid?: number
  startTime?: Date
  endTime?: Date
  output: string[]
  error?: string
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warning' | 'error' | 'success' | 'debug'
  message: string
  processId?: string
  processName?: string
}

interface ConsolePanelProps {
  logs: LogEntry[]
  processes: ProcessInfo[]
  onClearLogs: () => void
  onStartProcess?: (processId: string) => void
  onStopProcess?: (processId: string) => void
  onRestartProcess?: (processId: string) => void
  onExportLogs?: () => void
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ 
  logs, 
  processes, 
  onClearLogs, 
  onStartProcess, 
  onStopProcess, 
  onRestartProcess, 
  onExportLogs 
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [filterProcess, setFilterProcess] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set())
  const [showProcesses, setShowProcesses] = useState(true)

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Filter logs based on search term, level, and process
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = searchTerm === '' || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.processName?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesLevel = filterLevel === 'all' || log.level === filterLevel
      const matchesProcess = filterProcess === 'all' || log.processId === filterProcess
      
      return matchesSearch && matchesLevel && matchesProcess
    })
  }, [logs, searchTerm, filterLevel, filterProcess])

  // Get unique log levels for filter dropdown
  const logLevels = useMemo(() => {
    const levels = [...new Set(logs.map(log => log.level))]
    return ['all', ...levels]
  }, [logs])

  // Get unique processes for filter dropdown
  const processOptions = useMemo(() => {
    const processMap = new Map<string, string>()
    for (const log of logs) {
      if (log.processId && log.processName) {
        processMap.set(log.processId, log.processName)
      }
    }
    return ['all', ...Array.from(processMap.entries()).map(([id, name]) => id)]
  }, [logs])

  // Toggle process expansion
  const toggleProcessExpansion = useCallback((processId: string) => {
    setExpandedProcesses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(processId)) {
        newSet.delete(processId)
      } else {
        newSet.add(processId)
      }
      return newSet
    })
  }, [])

  // Get status color for processes
  const getStatusColor = (status: ProcessInfo['status']) => {
    switch (status) {
      case 'running':
        return 'text-green-400 bg-green-900/20'
      case 'stopped':
        return 'text-gray-400 bg-gray-900/20'
      case 'error':
        return 'text-red-400 bg-red-900/20'
      case 'completed':
        return 'text-blue-400 bg-blue-900/20'
      default:
        return 'text-gray-400 bg-gray-900/20'
    }
  }

  // Get log level color
  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'success':
        return 'text-green-400'
      case 'info':
        return 'text-blue-400'
      case 'debug':
        return 'text-gray-400'
      default:
        return 'text-gray-300'
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  return (
    <div className="h-96 bg-gray-900 border-t border-gray-700 flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h4 className="text-sm font-medium text-gray-200 transition-colors duration-300">
            Console
          </h4>
          
          {/* Process Toggle */}
          <button
            onClick={() => setShowProcesses(!showProcesses)}
            className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors duration-200"
          >
            {showProcesses ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{showProcesses ? 'Hide' : 'Show'} Processes</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            {filteredLogs.length} / {logs.length} messages
          </span>
          <button
            onClick={onExportLogs}
            className="p-1 text-gray-400 hover:text-white transition-colors duration-200"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClearLogs}
            className="px-2 py-1 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors duration-200"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Process Management Panel */}
      {showProcesses && processes.length > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="space-y-2">
            {processes.map(process => (
              <div key={process.id} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(process.status)}`}>
                    {process.status.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-200">{process.name}</div>
                    {process.pid && (
                      <div className="text-xs text-gray-400">PID: {process.pid}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {process.status === 'running' ? (
                    <button
                      onClick={() => onStopProcess?.(process.id)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors duration-200"
                      title="Stop process"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartProcess?.(process.id)}
                      className="p-1 text-green-400 hover:text-green-300 transition-colors duration-200"
                      title="Start process"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => onRestartProcess?.(process.id)}
                    className="p-1 text-blue-400 hover:text-blue-300 transition-colors duration-200"
                    title="Restart process"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => toggleProcessExpansion(process.id)}
                    className="p-1 text-gray-400 hover:text-gray-300 transition-colors duration-200"
                    title="Toggle process details"
                  >
                    {expandedProcesses.has(process.id) ? 
                      <ChevronUp className="w-4 h-4" /> : 
                      <ChevronDown className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2 py-1 text-sm bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Level Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-2 py-1 text-sm bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {logLevels.map(level => (
              <option key={level} value={level}>
                {level === 'all' ? 'All Levels' : level.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Process Filter */}
          <select
            value={filterProcess}
            onChange={(e) => setFilterProcess(e.target.value)}
            className="px-2 py-1 text-sm bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Processes</option>
            {processOptions.slice(1).map(processId => {
              const process = processes.find(p => p.id === processId)
              return (
                <option key={processId} value={processId}>
                  {process?.name || processId}
                </option>
              )
            })}
          </select>

          {/* Auto-scroll Toggle */}
          <label className="flex items-center space-x-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Logs */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            {logs.length === 0 ? 'No console messages yet' : 'No logs match current filters'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start space-x-2 py-1 hover:bg-gray-800/50 rounded px-2 transition-colors duration-200"
              >
                {/* Timestamp */}
                <span className="text-gray-500 text-xs flex-shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
                
                {/* Process Name */}
                {log.processName && (
                  <span className="text-blue-400 text-xs flex-shrink-0 font-medium">
                    [{log.processName}]
                  </span>
                )}
                
                {/* Log Level */}
                <span className={`text-xs font-medium flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                  [{log.level.toUpperCase()}]
                </span>
                
                {/* Message */}
                <span className={`${getLogLevelColor(log.level)} flex-1`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {processes.filter(p => p.status === 'running').length} processes running
          </span>
          <span>Verbose logging enabled</span>
        </div>
      </div>
    </div>
  )
}

export default ConsolePanel
