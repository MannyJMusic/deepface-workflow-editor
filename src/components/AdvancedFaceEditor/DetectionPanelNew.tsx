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

const DetectionPanelNew: React.FC<DetectionPanelProps> = ({
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
      <div className="w-12 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        {mode === 'faces' ? (
          <>
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
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
                  placeholder="Enter directory path..."
                />
                <button
                  onClick={async () => {
                    if (window.electronAPI && window.electronAPI.showOpenDialog) {
                      try {
                        const result = await window.electronAPI.showOpenDialog({
                          title: 'Select Face Images Directory',
                          properties: ['openDirectory'],
                          filters: [{ name: 'All Files', extensions: ['*'] }]
                        })
                        
                        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                          onInputDirChange?.(result.filePaths[0])
                        }
                      } catch (error) {
                        console.error('Error opening directory picker:', error)
                        const input = document.getElementById('input-dir') as HTMLInputElement
                        if (input) {
                          input.focus()
                          input.select()
                        }
                      }
                    } else {
                      const input = document.getElementById('input-dir') as HTMLInputElement
                      if (input) {
                        input.focus()
                        input.select()
                      }
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
            <div className="space-y-2">
              <label htmlFor="detection-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Detection Name
              </label>
              <select
                id="detection-name"
                value="default"
                onChange={() => {}}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
              >
                <option value="default">default</option>
              </select>
            </div>

            {/* Face Type */}
            <div className="space-y-2">
              <label htmlFor="face-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Face Type
              </label>
              <select
                id="face-type"
                value={detectionSettings.faceType}
                onChange={(e) => handleSettingChange('faceType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
              >
                <option value="full_face">Full Face</option>
                <option value="half_face">Half Face</option>
                <option value="whole_face">Whole Face</option>
                <option value="head">Head</option>
              </select>
            </div>

            {/* Detection Model */}
            <div className="space-y-2">
              <label htmlFor="detection-model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Detection Model
              </label>
              <select
                id="detection-model"
                value={detectionSettings.detectionModel}
                onChange={(e) => handleSettingChange('detectionModel', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
              >
                <option value="VGGFace2">VGGFace2</option>
                <option value="Facenet">Facenet</option>
                <option value="OpenFace">OpenFace</option>
                <option value="ArcFace">ArcFace</option>
              </select>
            </div>

            {/* Similarity Threshold */}
            <div className="space-y-2">
              <label htmlFor="similarity-threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Similarity Threshold: {detectionSettings.similarityThreshold}
              </label>
              <input
                id="similarity-threshold"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={detectionSettings.similarityThreshold}
                onChange={(e) => handleSettingChange('similarityThreshold', Number.parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer transition-colors duration-300"
              />
            </div>

            {/* Eyebrow Expand Mod */}
            <div className="space-y-2">
              <label htmlFor="eyebrow-expand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Eyebrow Expand Mod: {detectionSettings.eyebrowExpandMod}
              </label>
              <input
                id="eyebrow-expand"
                type="range"
                min="1"
                max="4"
                step="1"
                value={detectionSettings.eyebrowExpandMod}
                onChange={(e) => handleSettingChange('eyebrowExpandMod', Number.parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer transition-colors duration-300"
              />
            </div>

            {/* Action Buttons */}
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
                className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Load BiSeNet Model
              </button>

              <button
                onClick={onGenerateMasks}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Generate Masks
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
          </>
        ) : (
          <>
            {/* Video Frame Mode Content */}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Video Frame Mode
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                Process video frames
              </div>
            </div>

            {/* Video Input */}
            <div className="space-y-2">
              <label htmlFor="video-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Video Input
              </label>
              <div className="flex space-x-2">
                <input
                  id="video-input"
                  type="text"
                  placeholder="Select video file..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
                />
                <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                  Browse
                </button>
              </div>
            </div>

            {/* Output Directory */}
            <div className="space-y-2">
              <label htmlFor="output-dir" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Output Directory
              </label>
              <div className="flex space-x-2">
                <input
                  id="output-dir"
                  type="text"
                  placeholder="Select output directory..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
                />
                <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                  Browse
                </button>
              </div>
            </div>

            {/* Video Processing Options */}
            <div className="space-y-2">
              <label htmlFor="frame-rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                Frame Rate
              </label>
              <select
                id="frame-rate"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
              >
                <option value="30">30 FPS</option>
                <option value="24">24 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>

            {/* Action Buttons for Video Frame Mode */}
            <div className="space-y-3">
              <button className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200">
                Extract Frames
              </button>

              <button className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                Process Video
              </button>

              <button className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200">
                Merge Frames
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DetectionPanelNew
