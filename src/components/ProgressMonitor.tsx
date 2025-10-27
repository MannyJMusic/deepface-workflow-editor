import React, { useState, useEffect } from 'react'
import { useWorkflowStore } from '../stores/workflowStore'
import { WorkflowExecution } from '../types'

const ProgressMonitor: React.FC = () => {
  const { execution, isExecuting } = useWorkflowStore()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!isExecuting && !execution) {
    return null
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Header */}
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              execution?.status === 'running' ? 'bg-blue-500 animate-pulse' :
              execution?.status === 'completed' ? 'bg-green-500' :
              execution?.status === 'error' ? 'bg-red-500' :
              execution?.status === 'paused' ? 'bg-yellow-500' :
              'bg-gray-400'
            }`} />
            <div>
              <h3 className="text-sm font-medium text-gray-800">
                Workflow Execution
              </h3>
              <p className="text-xs text-gray-600">
                {execution?.status === 'running' && 'Running...'}
                {execution?.status === 'completed' && 'Completed'}
                {execution?.status === 'error' && 'Error'}
                {execution?.status === 'paused' && 'Paused'}
                {execution?.status === 'idle' && 'Idle'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {execution && (
              <span className="text-sm text-gray-600">
                {Math.round(execution.progress)}%
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Progress Bar */}
        {execution && execution.progress > 0 && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  execution.status === 'completed' ? 'bg-green-500' :
                  execution.status === 'error' ? 'bg-red-500' :
                  execution.status === 'paused' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${execution.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && execution && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <div className="space-y-3">
            {/* Current Node */}
            {execution.current_node && (
              <div>
                <h4 className="text-sm font-medium text-gray-700">Current Node</h4>
                <p className="text-sm text-gray-600">{execution.current_node}</p>
              </div>
            )}

            {/* Message */}
            {execution.message && (
              <div>
                <h4 className="text-sm font-medium text-gray-700">Message</h4>
                <p className="text-sm text-gray-600">{execution.message}</p>
              </div>
            )}

            {/* Error */}
            {execution.error && (
              <div>
                <h4 className="text-sm font-medium text-red-700">Error</h4>
                <p className="text-sm text-red-600">{execution.error}</p>
              </div>
            )}

            {/* Timing */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {execution.started_at && (
                <div>
                  <span className="font-medium text-gray-700">Started:</span>
                  <p className="text-gray-600">
                    {new Date(execution.started_at).toLocaleTimeString()}
                  </p>
                </div>
              )}
              
              {execution.completed_at && (
                <div>
                  <span className="font-medium text-gray-700">Completed:</span>
                  <p className="text-gray-600">
                    {new Date(execution.completed_at).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgressMonitor
