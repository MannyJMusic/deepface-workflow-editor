import React, { useState, useEffect } from 'react'
import { useWorkflowStore } from '../stores/workflowStore'
import { NodeDefinition } from '../types'
import { apiClient } from '../services/api'
import { GPUSelector } from './GPUSelector'
import FilePathPicker from './FilePathPicker'
import DirectoryPathPicker from './DirectoryPathPicker'
import { AdvancedFaceEditorView } from './AdvancedFaceEditor'

const NodeEditor: React.FC = () => {
  const { selectedNode, updateNode, nodeDefinitions } = useWorkflowStore()
  const [definition, setDefinition] = useState<NodeDefinition | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedNode) {
      loadNodeDefinition()
    }
  }, [selectedNode])

  const loadNodeDefinition = async () => {
    if (!selectedNode) return

    try {
      setLoading(true)
      const def = await apiClient.getNodeDefinition(selectedNode.type)
      setDefinition(def)
    } catch (error) {
      console.error('Failed to load node definition:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleParameterChange = (key: string, value: any) => {
    if (!selectedNode) return

    const updatedParameters = {
      ...selectedNode.parameters,
      [key]: value,
    }

    updateNode(selectedNode.id, { parameters: updatedParameters })
  }

  const handleExecuteNode = async () => {
    if (!selectedNode) return

    try {
      setLoading(true)
      
      // Get the input directory from node parameters if it's an Advanced Face Editor node
      const inputDir = selectedNode.type === 'xseg_editor' || selectedNode.type === 'advanced_face_editor' 
        ? selectedNode.parameters?.input_dir 
        : undefined
      
      const execution = await apiClient.startNodeExecution(selectedNode.id, inputDir)
      console.log('Single node execution started:', execution)
    } catch (error) {
      console.error('Failed to start single node execution:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderParameterInput = (key: string, paramDef: any) => {
    const value = selectedNode?.parameters[key] ?? paramDef.default

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

  if (!selectedNode) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 transition-colors duration-300">
        Select a node to edit its parameters
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 transition-colors duration-300">
        Loading node definition...
      </div>
    )
  }

  if (!definition) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 transition-colors duration-300">
        Node definition not found
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Check if this is an advanced face editor node */}
      {selectedNode?.type === 'xseg_editor' ? (
        <AdvancedFaceEditorView />
      ) : (
        <div className="p-4 space-y-4">
          {/* Node Info */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 transition-colors duration-300">
            <h3 className="font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">{definition.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-300">{definition.description}</p>
            
            {/* Status */}
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium transition-colors duration-300 ${
                selectedNode.status === 'idle' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                selectedNode.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                selectedNode.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                selectedNode.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
              }`}>
                {selectedNode.status}
              </span>
            </div>

            {/* Progress */}
            {selectedNode.progress > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1 transition-colors duration-300">
                  <span>Progress</span>
                  <span>{Math.round(selectedNode.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 transition-colors duration-300">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${selectedNode.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Message */}
            {selectedNode.message && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                {selectedNode.message}
              </div>
            )}
          </div>

          {/* Parameters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">Parameters</h4>
              <button
                onClick={handleExecuteNode}
                disabled={loading || !selectedNode}
                className="px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Executing...' : 'Execute Node'}
              </button>
            </div>
            
            {Object.entries(definition.parameters).map(([key, paramDef]) => (
              <div key={key} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
                {renderParameterInput(key, paramDef)}
                {paramDef.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">{paramDef.description}</p>
                )}
              </div>
            ))}
          </div>

          {/* Inputs/Outputs */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">Connections</h4>
            
            {/* Inputs */}
            {definition.inputs.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-300">Inputs</h5>
                <div className="space-y-2">
                  {definition.inputs.map((input) => (
                    <div key={input.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded transition-colors duration-300">
                      <span className="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-300">{input.label}</span>
                      <span className={`px-2 py-1 rounded text-xs transition-colors duration-300 ${
                        selectedNode.inputs[input.id] ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {selectedNode.inputs[input.id] ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outputs */}
            {definition.outputs.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-300">Outputs</h5>
                <div className="space-y-2">
                  {definition.outputs.map((output) => (
                    <div key={output.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded transition-colors duration-300">
                      <span className="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-300">{output.label}</span>
                      <span className={`px-2 py-1 rounded text-xs transition-colors duration-300 ${
                        selectedNode.outputs[output.id] ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {selectedNode.outputs[output.id] ? 'Generated' : 'Not generated'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NodeEditor