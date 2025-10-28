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
  // Detection Profiles
  detectionProfiles?: string[]
  selectedProfile?: string
  onProfileChange?: (profile: string) => void
  onAddProfile?: (name: string) => void
  onRemoveProfile?: (name: string) => void
  onResetProfile?: (name: string) => void
  // Parent Frame Folder
  parentFrameFolder?: string
  onParentFrameFolderChange?: (path: string) => void
  // Faces Folder
  facesFolder?: string
  onFacesFolderChange?: (path: string) => void
  onlyParentData?: boolean
  onOnlyParentDataChange?: (value: boolean) => void
  recalculateFaceData?: boolean
  onRecalculateFaceDataChange?: (value: boolean) => void
  onCopyEmbeddedData?: () => void
  onOpenXSegEditor?: () => void
  // XSeg Model
  xsegModelPath?: string
  onXsegModelPathChange?: (path: string) => void
  onTrainXSeg?: () => void
  onApplyXSeg?: () => void
  // Embedded Detections
  setFacesToParent?: boolean
  onSetFacesToParentChange?: (value: boolean) => void
  onUpdateParentFrames?: () => void
  onImportFaceData?: () => void
  // Progress tracking
  importProgress?: number
  importMessage?: string
  isImporting?: boolean
  processedCount?: number
  totalCount?: number
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
  onInputDirChange,
  // Detection Profiles
  detectionProfiles = ['default'],
  selectedProfile = 'default',
  onProfileChange,
  onAddProfile,
  onRemoveProfile,
  onResetProfile,
  // Parent Frame Folder
  parentFrameFolder = '',
  onParentFrameFolderChange,
  // Faces Folder
  facesFolder = '',
  onFacesFolderChange,
  onlyParentData = false,
  onOnlyParentDataChange,
  recalculateFaceData = false,
  onRecalculateFaceDataChange,
  onCopyEmbeddedData,
  onOpenXSegEditor,
  // XSeg Model
  xsegModelPath = '',
  onXsegModelPathChange,
  onTrainXSeg,
  onApplyXSeg,
  // Embedded Detections
  setFacesToParent = false,
  onSetFacesToParentChange,
  onUpdateParentFrames,
  onImportFaceData,
  // Progress tracking
  importProgress = 0,
  importMessage = '',
  isImporting = false,
  processedCount = 0,
  totalCount = 0
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
            {/* Frame count display */}
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                Frame count {faceCount}
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
          onChange={(e) => onInputDirChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
          placeholder="Select faces folder..."
        />
        <button 
          onClick={async () => {
            if (window.electronAPI?.showOpenDialog) {
              try {
                const result = await window.electronAPI.showOpenDialog({
                  title: 'Select Faces Folder',
                  properties: ['openDirectory'],
                  filters: [{ name: 'All Files', extensions: ['*'] }]
                })
                
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                  onInputDirChange(result.filePaths[0])
                }
              } catch (error) {
                console.error('Error selecting directory:', error)
              }
            } else {
              // Fallback for web mode
              const input = document.createElement('input')
              input.type = 'file'
              input.webkitdirectory = true
              input.multiple = true
              input.style.display = 'none'
              
              document.body.appendChild(input)
              
              input.onchange = (e) => {
                const target = e.target as HTMLInputElement
                const files = target.files
                
                if (files && files.length > 0) {
                  const firstFile = files[0]
                  const relativePath = firstFile.webkitRelativePath
                  
                  if (relativePath) {
                    const directoryName = relativePath.split('/')[0]
                    onInputDirChange(directoryName)
                  }
                }
                
                input.remove()
              }
              
              input.click()
            }
          }}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
        >
          Browse
        </button>
      </div>
    </div>

            {/* Detection Profiles Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Detection Profiles
              </h4>
              
              {/* Profile Dropdown */}
              <div>
                <label htmlFor="detection-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Detection Name
                </label>
                <select
                  id="detection-name"
                  value={selectedProfile}
                  onChange={(e) => onProfileChange?.(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {detectionProfiles.map(profile => (
                    <option key={profile} value={profile}>{profile}</option>
                  ))}
                </select>
              </div>

              {/* Profile Management Buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <button 
                    onClick={() => {
                      const name = prompt('Enter profile name:')
                      if (name && name.trim()) {
                        onAddProfile?.(name.trim())
                      }
                    }}
                    className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors duration-200"
                    title="Add new detection profile"
                  >
                    Add Name
                  </button>
                  <button 
                    onClick={() => {
                      if (selectedProfile !== 'default' && confirm(`Remove profile "${selectedProfile}"?`)) {
                        onRemoveProfile?.(selectedProfile)
                      }
                    }}
                    disabled={selectedProfile === 'default'}
                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove current profile (cannot remove default)"
                  >
                    Remove
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    if (confirm(`Reset profile "${selectedProfile}" to defaults?`)) {
                      onResetProfile?.(selectedProfile)
                    }
                  }}
                  className="w-full px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                  title="Reset current profile to default settings"
                >
                  Reset
                </button>
                
                <button 
                  onClick={() => {
                    if (confirm('Remove all selected faces from current profile?')) {
                      // This would remove selected faces from the current profile
                      console.log('Remove selected faces from profile:', selectedProfile)
                    }
                  }}
                  className="w-full px-2 py-1 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded transition-colors duration-200"
                  title="Remove selected faces from current profile"
                >
                  Remove Selected
                </button>
              </div>
            </div>



            {/* Embedded Detections Section */}
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Embedded Detections
              </h4>
              
              {/* Set faces to parent frames checkbox */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setFacesToParent}
                  onChange={(e) => onSetFacesToParentChange?.(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Set faces to parent frames</span>
              </label>

              {/* Import face data button */}
              <button 
                onClick={onImportFaceData}
                disabled={loading || isImporting}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title="Import face data from images"
              >
                {isImporting ? 'Importing...' : 'Import face data'}
              </button>

              {/* Embed mask polygons button */}
              <button
                onClick={onEmbedPolygons}
                disabled={loading || faceCount === 0}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title="Embed mask polygons into images"
              >
                Embed Mask Polygons
              </button>

              {/* Eyebrow expand mod input */}
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
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Faces Folder
              </h4>
              
              {/* Faces folder path input */}
              <div>
                <label htmlFor="faces-folder" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Faces Folder Path
                </label>
                <div className="flex space-x-1">
                  <input
                    id="faces-folder"
                    type="text"
                    value={facesFolder}
                    onChange={(e) => onFacesFolderChange?.(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Select faces folder..."
                  />
                  <button 
                    onClick={async () => {
                      if (window.electronAPI?.showOpenDialog) {
                        try {
                          const result = await window.electronAPI.showOpenDialog({
                            title: 'Select Faces Folder',
                            properties: ['openDirectory'],
                            filters: [{ name: 'All Files', extensions: ['*'] }]
                          })
                          
                          if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                            onFacesFolderChange?.(result.filePaths[0])
                          }
                        } catch (error) {
                          console.error('Error opening directory picker:', error)
                        }
                      }
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                    title="Browse for faces folder"
                  >
                    📁
                  </button>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyParentData}
                    onChange={(e) => onOnlyParentDataChange?.(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Only parent data</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recalculateFaceData}
                    onChange={(e) => onRecalculateFaceDataChange?.(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Recalculate face data</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true} // This would be a state variable for "Copy embedded data"
                    onChange={() => {}} // This would be handled by a callback
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Copy embedded data</span>
                </label>
              </div>

              {/* Copy Embedded Data button */}
              <button 
                onClick={onCopyEmbeddedData}
                disabled={loading || !facesFolder}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title="Copy embedded data to faces folder"
              >
                Copy Embedded Data
              </button>

              {/* Open XSeg Editor button */}
              <button 
                onClick={onOpenXSegEditor}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors duration-200"
                title="Open XSeg Editor for mask editing"
              >
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
                  value={xsegModelPath}
                  onChange={(e) => onXsegModelPathChange?.(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button 
                  onClick={async () => {
                    if (window.electronAPI?.showOpenDialog) {
                      try {
                        const result = await window.electronAPI.showOpenDialog({
                          title: 'Select XSeg Model Directory',
                          properties: ['openDirectory'],
                          filters: [{ name: 'All Files', extensions: ['*'] }]
                        })
                        
                        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                          onXsegModelPathChange?.(result.filePaths[0])
                        }
                      } catch (error) {
                        console.error('Error opening directory picker:', error)
                      }
                    }
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
                >
                  📁
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={onTrainXSeg}
                  disabled={loading || !xsegModelPath}
                  className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Train XSeg
                </button>
                <button 
                  onClick={onApplyXSeg}
                  disabled={loading || !xsegModelPath}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
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

export default DetectionPanelNew
