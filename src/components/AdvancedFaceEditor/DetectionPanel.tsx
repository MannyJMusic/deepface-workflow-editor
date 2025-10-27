import React, { useState, useCallback } from 'react'

interface DetectionSettings {
  faceType: string
  detectionModel: string
  similarityThreshold: number
  eyebrowExpandMod: number
}

interface DetectionPanelProps {
  detectionSettings: DetectionSettings
  onSettingsChange: (updates: Partial<DetectionSettings>) => void
  onDetectFaces: () => void
  onLoadSegmentationModel: () => void
  onGenerateMasks: () => void
  onEmbedPolygons: () => void
  faceCount: number
  loading: boolean
  inputDir?: string
  onInputDirChange?: (dir: string) => void
}

const DetectionPanel: React.FC<DetectionPanelProps> = ({
  detectionSettings,
  onSettingsChange,
  onDetectFaces,
  onLoadSegmentationModel,
  onGenerateMasks,
  onEmbedPolygons,
  faceCount,
  loading,
  inputDir,
  onInputDirChange
}) => {
  const [mode, setMode] = useState<'video_frame' | 'faces'>('faces')
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleSettingChange = useCallback((key: keyof DetectionSettings, value: any) => {
    onSettingsChange({ [key]: value })
  }, [onSettingsChange])

  if (isCollapsed) {
    return (
      <div className="w-8 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
            Detection Management
          </h3>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <button
            onClick={() => setMode('video_frame')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              mode === 'video_frame'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Video Frame
          </button>
          <button
            onClick={() => setMode('faces')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              mode === 'faces'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Faces
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Frame Count */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors duration-300">
            {faceCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
            Frame count
          </div>
        </div>

        {/* Input Directory */}
        <div className="space-y-2">
          <label htmlFor="input-dir" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Input Directory
            {window.electronAPI ? (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">(Electron Mode)</span>
            ) : (
              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Web Mode)</span>
            )}
          </label>
          <div className="flex space-x-2">
            <input
              id="input-dir"
              type="text"
              value={inputDir || ''}
              onChange={(e) => onInputDirChange?.(e.target.value)}
              placeholder="/tmp/faces or /Users/username/faces"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={async () => {
                // Try to use Electron's file picker if available
                if (window.electronAPI && window.electronAPI.showOpenDialog) {
                  try {
                    const result = await window.electronAPI.showOpenDialog({
                      title: 'Select Face Images Directory',
                      properties: ['openDirectory'],
                      filters: [
                        { name: 'All Files', extensions: ['*'] }
                      ]
                    })
                    
                    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                      onInputDirChange?.(result.filePaths[0])
                    }
                  } catch (error) {
                    console.error('Error opening directory picker:', error)
                    // Fallback to manual input
                    const input = document.getElementById('input-dir') as HTMLInputElement
                    if (input) {
                      input.focus()
                      input.select()
                    }
                  }
                } else {
                  // Fallback: focus input and show helpful message
                  const input = document.getElementById('input-dir') as HTMLInputElement
                  if (input) {
                    input.focus()
                    input.select()
                  }
                  // Show a helpful message without blocking the UI
                  console.log('Please enter the full path to your face images directory.\n\nExample: /Users/username/faces\nOr: C:\\Users\\username\\faces')
                }
              }}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              title="Click to select directory (or focus input field in web mode)"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Detection Profiles */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
            Detection Profiles
          </h4>
          
          <div>
            <label htmlFor="detection-name-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">
              Detection Name
            </label>
            <select
              id="detection-name-select"
              value="default"
              onChange={() => {}} // Add empty onChange to prevent warning
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="default">default</option>
            </select>
          </div>

          <div className="flex space-x-1">
            <button className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
              Add Name
            </button>
            <button className="flex-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
              Remove
            </button>
          </div>
        </div>

        {/* Face Type */}
        <div className="space-y-2">
          <label htmlFor="face-type-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Face Type
          </label>
          <select
            id="face-type-select"
            value={detectionSettings.faceType}
            onChange={(e) => handleSettingChange('faceType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            <option value="mouth">Mouth</option>
            <option value="half_face">Half Face</option>
            <option value="midfull_face">Mid Full Face</option>
            <option value="full_face">Full Face</option>
            <option value="whole_face">Whole Face</option>
            <option value="head">Head</option>
          </select>
        </div>

        {/* Detection Model */}
        <div className="space-y-2">
          <label htmlFor="detection-model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Detection Model
          </label>
          <select
            id="detection-model-select"
            value={detectionSettings.detectionModel}
            onChange={(e) => handleSettingChange('detectionModel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
          >
            <option value="VGGFace2">VGGFace2</option>
            <option value="OpenCV">OpenCV</option>
            <option value="MTCNN">MTCNN</option>
          </select>
        </div>

        {/* Similarity Threshold */}
        <div className="space-y-2">
          <label htmlFor="similarity-threshold-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
            Similarity Threshold: {detectionSettings.similarityThreshold.toFixed(2)}
          </label>
          <input
            id="similarity-threshold-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={detectionSettings.similarityThreshold}
            onChange={(e) => handleSettingChange('similarityThreshold', Number.parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer transition-colors duration-200"
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onDetectFaces}
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? 'Detecting...' : 'Detect Faces'}
          </button>

          <button
            onClick={onLoadSegmentationModel}
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? 'Loading...' : 'Load BiSeNet Model'}
          </button>

          <button
            onClick={onGenerateMasks}
            disabled={loading || faceCount === 0}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? 'Generating...' : 'Generate Masks'}
          </button>
        </div>

        {/* Embed Mask Polygons Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
            Embed Mask Polygons
          </h4>

          <div className="space-y-2">
            <label htmlFor="eyebrow-expand-input" className="block text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
              Eyebrow expand mod value between 1-4:
            </label>
            <input
              id="eyebrow-expand-input"
              type="number"
              min="1"
              max="4"
              value={detectionSettings.eyebrowExpandMod}
              onChange={(e) => handleSettingChange('eyebrowExpandMod', Number.parseInt(e.target.value, 10))}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 transition-colors duration-200"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Set faces to parent frames
              </span>
            </label>
          </div>

          <button
            onClick={onEmbedPolygons}
            disabled={loading || faceCount === 0}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? 'Embedding...' : 'Embed Mask Polygons'}
          </button>

          <button className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200">
            Import Face Data
          </button>
        </div>

        {/* Additional Actions */}
        <div className="space-y-2">
          <button className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200">
            Open XSeg Editor
          </button>
        </div>
      </div>
    </div>
  )
}

export default DetectionPanel
