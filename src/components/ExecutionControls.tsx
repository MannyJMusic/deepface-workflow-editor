import React, { useState } from 'react'
import { useWorkflowStore } from '../stores/workflowStore'
import { apiClient } from '../services/api'

const ExecutionControls: React.FC = () => {
  const { 
    currentWorkflow, 
    isExecuting, 
    setIsExecuting, 
    setExecution,
    nodes,
    saveWorkflowToFile,
    loadWorkflowFromFile,
    loadTemplate
  } = useWorkflowStore()
  
  const [loading, setLoading] = useState(false)

  const canExecute = currentWorkflow && nodes.length > 0 && !isExecuting

  const handleRunWorkflow = async () => {
    if (!currentWorkflow || !canExecute) return

    try {
      setLoading(true)
      setIsExecuting(true)
      
      // Start execution
      const execution = await apiClient.startExecution(currentWorkflow.id)
      setExecution(execution)
      
      console.log('Workflow execution started:', execution)
    } catch (error) {
      console.error('Failed to start workflow execution:', error)
      setIsExecuting(false)
    } finally {
      setLoading(false)
    }
  }

  const handleStopWorkflow = async () => {
    if (!isExecuting) return

    try {
      setLoading(true)
      
      // Stop execution (would need execution ID from store)
      // await apiClient.stopExecution(executionId)
      
      setIsExecuting(false)
      console.log('Workflow execution stopped')
    } catch (error) {
      console.error('Failed to stop workflow execution:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleSaveToFile = async () => {
    try {
      setLoading(true)
      await saveWorkflowToFile()
      console.log('Workflow saved to file successfully')
    } catch (error) {
      console.error('Failed to save workflow to file:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadFromFile = async () => {
    try {
      setLoading(true)
      await loadWorkflowFromFile()
      console.log('Workflow loaded from file successfully')
    } catch (error) {
      console.error('Failed to load workflow from file:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadTemplate = async () => {
    try {
      setLoading(true)
      await loadTemplate('basic-face-swap')
      console.log('Template loaded successfully')
    } catch (error) {
      console.error('Failed to load template:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewWorkflow = () => {
    useWorkflowStore.getState().createNewWorkflow()
  }

  return (
    <div className="flex items-center space-x-2">
      {/* New Workflow */}
      <button
        onClick={handleNewWorkflow}
        disabled={loading}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
      >
        New
      </button>

      {/* Load Template */}
      <button
        onClick={handleLoadTemplate}
        disabled={loading}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
      >
        Template
      </button>

      {/* Load from File */}
      <button
        onClick={handleLoadFromFile}
        disabled={loading}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
      >
        Load
      </button>

      {/* Save to File */}
      <button
        onClick={handleSaveToFile}
        disabled={loading || !currentWorkflow}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
      >
        Save As
      </button>

      {/* Run/Stop Workflow */}
      {isExecuting ? (
        <button
          onClick={handleStopWorkflow}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-700 border border-transparent rounded-md hover:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-colors duration-200"
        >
          {loading ? 'Stopping...' : 'Stop Workflow'}
        </button>
      ) : (
        <button
          onClick={handleRunWorkflow}
          disabled={loading || !canExecute}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {loading ? 'Starting...' : 'Run Workflow'}
        </button>
      )}

      {/* Status Indicator */}
      {isExecuting && (
        <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 transition-colors duration-300">
          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
          <span>Executing...</span>
        </div>
      )}
    </div>
  )
}

export default ExecutionControls
