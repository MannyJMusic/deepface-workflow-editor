import React, { useState, useEffect } from 'react'
import { useWorkflowStore } from '../stores/workflowStore'
import { NodePreset } from '../types'
import { apiClient } from '../services/api'

const NodePresetManager: React.FC = () => {
  const { activeNodeInSingleMode } = useWorkflowStore()
  const [presets, setPresets] = useState<NodePreset[]>([])
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = async () => {
    try {
      setLoading(true)
      const presetsList = await apiClient.listNodePresets()
      setPresets(presetsList)
    } catch (error) {
      console.error('Failed to load presets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePreset = async () => {
    if (!activeNodeInSingleMode || !presetName.trim()) return

    try {
      setLoading(true)
      const preset: NodePreset = {
        id: `preset-${Date.now()}`,
        name: presetName.trim(),
        description: presetDescription.trim() || undefined,
        nodeType: activeNodeInSingleMode.type,
        parameters: { ...activeNodeInSingleMode.parameters },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await apiClient.saveNodePreset(preset)
      await loadPresets()
      setShowSaveDialog(false)
      setPresetName('')
      setPresetDescription('')
    } catch (error) {
      console.error('Failed to save preset:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPreset = async (presetId: string) => {
    try {
      setLoading(true)
      const preset = await apiClient.loadNodePreset(presetId)
      
      if (activeNodeInSingleMode) {
        // Update the current node with preset parameters
        const updatedNode = {
          ...activeNodeInSingleMode,
          parameters: { ...preset.parameters }
        }
        useWorkflowStore.getState().setActiveNodeInSingleMode(updatedNode)
      }
    } catch (error) {
      console.error('Failed to load preset:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return

    try {
      setLoading(true)
      await apiClient.deleteNodePreset(presetId)
      await loadPresets()
    } catch (error) {
      console.error('Failed to delete preset:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPresets = activeNodeInSingleMode 
    ? presets.filter(preset => preset.nodeType === activeNodeInSingleMode.type)
    : presets

  return (
    <div className="p-4 space-y-4">
      {/* Save Preset Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
          Save Current Configuration
        </h4>
        
        {!showSaveDialog ? (
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!activeNodeInSingleMode}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Save as Preset
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="preset-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                Preset Name
              </label>
              <input
                id="preset-name"
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Enter preset name..."
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
              />
            </div>
            <div>
              <label htmlFor="preset-description" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
                Description (optional)
              </label>
              <textarea
                id="preset-description"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                placeholder="Enter description..."
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleSavePreset}
                disabled={loading || !presetName.trim()}
                className="flex-1 px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setPresetName('')
                  setPresetDescription('')
                }}
                className="flex-1 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Load Presets Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
          Load Preset
        </h4>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredPresets.length > 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            {activeNodeInSingleMode 
              ? `No presets found for ${activeNodeInSingleMode.type}`
              : 'No presets available'
            }
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                className={`p-3 rounded-lg border transition-colors duration-200 cursor-pointer ${
                  selectedPreset === preset.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                onClick={() => setSelectedPreset(preset.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate transition-colors duration-300">
                      {preset.name}
                    </h5>
                    {preset.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 transition-colors duration-300">
                        {preset.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors duration-300">
                      {new Date(preset.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLoadPreset(preset.id)
                      }}
                      className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors duration-200"
                      title="Load preset"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePreset(preset.id)
                      }}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors duration-200"
                      title="Delete preset"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load into Workflow Section */}
      {selectedPreset && (
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-600">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Workflow Integration
          </h4>
          <button
            onClick={() => {
              // This will be implemented when we add the workflow integration
              console.log('Load preset into workflow:', selectedPreset)
            }}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
          >
            Load into Workflow
          </button>
        </div>
      )}
    </div>
  )
}

export default NodePresetManager
