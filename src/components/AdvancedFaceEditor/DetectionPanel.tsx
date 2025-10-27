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
        {mode === 'faces' ? (
          <>
            {/* Frame count display */}
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                Frame count {faceCount}
              </div>
            </div>

            {/* Detection Profiles Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Detection Profiles
              </h4>
              
              <div>
                <label htmlFor="detection-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Detection Name
                </label>
                <select
                  id="detection-name"
                  value="default"
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="default">default</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <button className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">
                  Add Name
                </button>
                <button className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded">
                  Remove Name
                </button>
                <button className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded col-span-2">
                  Reset Name Selected
                </button>
                <button className="px-2 py-1 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded col-span-2">
                  Permanently Remove Selected
                </button>
              </div>
            </div>

            {/* Image Information Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Image Information
              </h4>
              
              <div>
                <label htmlFor="image-type" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Face
                </label>
                <select
                  id="image-type"
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="face">Face</option>
                </select>
              </div>

              <div>
                <label htmlFor="parent-frame-folder" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parent Frame Folder
                </label>
                <div className="flex space-x-1">
                  <input
                    id="parent-frame-folder"
                    type="text"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded">
                    📁
                  </button>
                </div>
              </div>
            </div>

            {/* Embedded Detections Section */}
            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Embedded Detections
              </h4>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Set faces to parent frames</span>
              </label>

              <button
                onClick={onEmbedPolygons}
                disabled={loading || faceCount === 0}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Embed Mask Polygons
              </button>

              <button className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded">
                Import Face Data
              </button>

              <div>
                <label htmlFor="eyebrow-expand" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Eyebrow expand mod value between 1-4
                </label>
                <input
                  id="eyebrow-expand"
                  type="number"
                  min="1"
                  max="4"
                  value={detectionSettings.eyebrowExpandMod}
                  onChange={(e) => handleSettingChange('eyebrowExpandMod', Number.parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Faces Folder Section */}
            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
              <label htmlFor="faces-folder" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Faces Folder
              </label>
              <div className="flex space-x-1">
                <input
                  id="faces-folder"
                  type="text"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded">
                  📁
                </button>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Only parent data</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Recalculate face data</span>
              </label>

              <button className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded">
                Copy Embedded Data
              </button>

              <button className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded">
                Open XSeg Editor
              </button>
            </div>

            {/* XSeg Model Path Section */}
            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
              <label htmlFor="xseg-model-path" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                XSeg Model Path
              </label>
              <div className="flex space-x-1">
                <input
                  id="xseg-model-path"
                  type="text"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded">
                  📁
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded">
                  Train XSeg
                </button>
                <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">
                  Apply XSeg
                </button>
              </div>
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

export default DetectionPanel
