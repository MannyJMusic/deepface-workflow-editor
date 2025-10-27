import React, { useState, useEffect } from 'react'
import { useWorkflowStore } from '../stores/workflowStore'
import { NodeType, NodeDefinition } from '../types'
import { apiClient } from '../services/api'
import { GPUSelector } from './GPUSelector'
import FilePathPicker from './FilePathPicker'
import DirectoryPathPicker from './DirectoryPathPicker'
import NodePresetManager from './NodePresetManager'
import { AdvancedFaceEditorView } from './AdvancedFaceEditor'

const SingleNodeView: React.FC = () => {
  const { 
    activeNodeInSingleMode, 
    setActiveNodeInSingleMode, 
    createNodeForSingleMode,
    nodeDefinitions 
  } = useWorkflowStore()
  
  const [definition, setDefinition] = useState<NodeDefinition | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null)

  // Helper function to get status styling
  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      case 'running':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
    }
  }

  // Initialize with Advanced Face Editor if none selected
  useEffect(() => {
    if (!activeNodeInSingleMode && nodeDefinitions.length > 0) {
      // Look for Advanced Face Editor first, fallback to first available node type
      const advancedFaceEditor = nodeDefinitions.find(def => def.id === 'advanced_face_editor')
      const firstNodeType = advancedFaceEditor ? advancedFaceEditor.type : nodeDefinitions[0].type
      setSelectedNodeType(firstNodeType)
      createNodeForSingleMode(firstNodeType)
    }
  }, [activeNodeInSingleMode, nodeDefinitions, createNodeForSingleMode])

  // Load node definition when node type changes
  useEffect(() => {
    if (selectedNodeType) {
      loadNodeDefinition()
    }
  }, [selectedNodeType])

  const loadNodeDefinition = async () => {
    if (!selectedNodeType) return

    try {
      setLoading(true)
      const def = await apiClient.getNodeDefinition(selectedNodeType)
      setDefinition(def)
    } catch (error) {
      console.error('Failed to load node definition:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNodeTypeChange = (nodeType: NodeType) => {
    setSelectedNodeType(nodeType)
    createNodeForSingleMode(nodeType)
  }

  const handleParameterChange = (key: string, value: any) => {
    if (!activeNodeInSingleMode) return

    const updatedParameters = {
      ...activeNodeInSingleMode.parameters,
      [key]: value,
    }

    setActiveNodeInSingleMode({
      ...activeNodeInSingleMode,
      parameters: updatedParameters
    })
  }

  const handleExecuteNode = async () => {
    if (!activeNodeInSingleMode) return

    try {
      setLoading(true)
      
      // Get the input directory from node parameters if it's an Advanced Face Editor node
      const inputDir = activeNodeInSingleMode.type === 'xseg_editor' || activeNodeInSingleMode.type === 'advanced_face_editor' 
        ? activeNodeInSingleMode.parameters?.input_dir 
        : undefined
      
      const execution = await apiClient.startNodeExecution(activeNodeInSingleMode.id, inputDir)
      console.log('Single node execution started:', execution)
    } catch (error) {
      console.error('Failed to start single node execution:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderParameterInput = (key: string, paramDef: any) => {
    const value = activeNodeInSingleMode?.parameters[key] ?? paramDef.default

    switch (paramDef.type) {
      case 'string':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
            placeholder={paramDef.description}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value || paramDef.default || 0}
            min={paramDef.min}
            max={paramDef.max}
            onChange={(e) => handleParameterChange(key, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleParameterChange(key, e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 transition-colors duration-200"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">{paramDef.description}</span>
          </label>
        )

      case 'select':
        return (
          <select
            value={value || paramDef.default || ''}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            {paramDef.options.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case 'gpu':
        return (
          <GPUSelector
            selectedGPU={value || null}
            onGPUChange={(gpuId) => handleParameterChange(key, gpuId)}
            className="w-full"
          />
        )

      case 'file-path':
        return (
          <FilePathPicker
            value={value || ''}
            onChange={(path) => handleParameterChange(key, path)}
            placeholder={paramDef.description}
            filters={paramDef.filters || [{ name: 'All Files', extensions: ['*'] }]}
            className="w-full"
          />
        )

      case 'directory-path':
        return (
          <DirectoryPathPicker
            value={value || ''}
            onChange={(path) => handleParameterChange(key, path)}
            placeholder={paramDef.description}
            className="w-full"
          />
        )

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
            placeholder={paramDef.description}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading node definition...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-300">
              Single Node Mode
            </h2>
            
            {/* Node Type Selector */}
            <div className="flex items-center space-x-2">
            <label htmlFor="node-type-selector" className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
              Node Type:
            </label>
            <select
              id="node-type-selector"
              value={selectedNodeType || ''}
              onChange={(e) => handleNodeTypeChange(e.target.value as NodeType)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
            >
              {nodeDefinitions.length === 0 ? (
                <option value="">Loading node types...</option>
              ) : (
                <>
                  <option value="">Select a node type...</option>
                  {nodeDefinitions.map((def) => (
                    <option key={def.id} value={def.type}>
                      {def.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecuteNode}
            disabled={loading || !activeNodeInSingleMode}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? 'Executing...' : 'Execute Node'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Check if this is an advanced face editor node */}
        {activeNodeInSingleMode?.type === 'xseg_editor' ? (
          <AdvancedFaceEditorView />
        ) : (
          <>
            {/* Left Panel - Parameters */}
            <div className="flex-1 overflow-y-auto p-6">
              {definition && activeNodeInSingleMode ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Node Info */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2 transition-colors duration-300">
                      {definition.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 transition-colors duration-300">
                      {definition.description}
                    </p>
                    
                    {/* Status */}
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">Status:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium transition-colors duration-300 ${getStatusStyling(activeNodeInSingleMode.status)}`}>
                          {activeNodeInSingleMode.status}
                        </span>
                      </div>

                      {/* Progress */}
                      {activeNodeInSingleMode.progress > 0 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">Progress:</span>
                          <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 transition-colors duration-300">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${activeNodeInSingleMode.progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                            {Math.round(activeNodeInSingleMode.progress)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Message */}
                    {activeNodeInSingleMode.message && (
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                        {activeNodeInSingleMode.message}
                      </div>
                    )}
                  </div>

                  {/* Parameters */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 transition-colors duration-300">
                      Parameters
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(definition.parameters).map(([key, paramDef]) => (
                        <div key={key} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </label>
                          {renderParameterInput(key, paramDef)}
                          {paramDef.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">{paramDef.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : nodeDefinitions.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>Loading node definitions...</p>
                    <p className="text-sm mt-2">Please wait while we load available node types.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>Select a node type to get started</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Preset Manager */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                  Presets
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NodePresetManager />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SingleNodeView
