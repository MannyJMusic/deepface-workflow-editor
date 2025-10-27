import React from 'react'
import { useWorkflowStore } from '../stores/workflowStore'
import { ViewMode } from '../types'

const ViewModeToggle: React.FC = () => {
  const { viewMode, setViewMode } = useWorkflowStore()

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
        Mode:
      </span>
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 transition-colors duration-300">
        <button
          onClick={() => handleModeChange('workflow')}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
            viewMode === 'workflow'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <span className="mr-1">🔗</span>
          Workflow
        </button>
        <button
          onClick={() => handleModeChange('single-node')}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
            viewMode === 'single-node'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <span className="mr-1">⚙️</span>
          Single Node
        </button>
      </div>
    </div>
  )
}

export default ViewModeToggle


