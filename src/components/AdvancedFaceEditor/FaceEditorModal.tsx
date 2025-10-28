import React, { useState, useCallback, useEffect } from 'react'
import SegmentationEditor from './SegmentationEditor'
import LandmarkEditor from './LandmarkEditor'
import HelpTooltip from './HelpTooltip'
import { apiClient } from '../../services/api'

interface FaceImage {
  id: string
  filename: string
  filePath: string
  thumbnailUrl?: string
  segmentationPolygon?: number[][]
  landmarks?: number[][]
  selected?: boolean
  active?: boolean
}

interface FaceEditorModalProps {
  faceImage: FaceImage | undefined
  faceImages: FaceImage[]
  onClose: () => void
  onUpdateFace: (faceId: string, updates: Partial<FaceImage>) => void
  nodeId: string
  inputDir: string
  eyebrowExpandMod?: number
}

const FaceEditorModal: React.FC<FaceEditorModalProps> = ({
  faceImage,
  faceImages,
  onClose,
  onUpdateFace,
  nodeId,
  inputDir,
  eyebrowExpandMod = 1
}) => {
  const [viewMode, setViewMode] = useState<'landmarks' | 'segmentation'>('segmentation')
  const [currentPolygon, setCurrentPolygon] = useState<number[][] | undefined>(faceImage?.segmentationPolygon)
  const [currentLandmarks, setCurrentLandmarks] = useState<number[][] | undefined>(faceImage?.landmarks)
  const [isSaving, setIsSaving] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Rotation and alignment state
  const [rotationAngle, setRotationAngle] = useState(0)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)

  // Update current index when face image changes
  useEffect(() => {
    if (faceImage && faceImages.length > 0) {
      const index = faceImages.findIndex(f => f.id === faceImage.id)
      if (index >= 0) {
        setCurrentIndex(index)
      }
    }
  }, [faceImage, faceImages])

  // Load face data when face changes
  useEffect(() => {
    if (faceImage) {
      loadFaceData()
    }
  }, [faceImage])

  const loadFaceData = async () => {
    if (!faceImage) return

    try {
      const response = await apiClient.getFaceData(nodeId, faceImage.id, inputDir)
      if (response.success) {
        setCurrentPolygon(response.segmentation?.[0] || faceImage.segmentationPolygon)
        setCurrentLandmarks(response.landmarks || faceImage.landmarks)
      }
    } catch (error) {
      console.error('Failed to load face data:', error)
      setCurrentPolygon(faceImage.segmentationPolygon)
      setCurrentLandmarks(faceImage.landmarks)
    }
  }

  const handlePolygonChange = useCallback((polygon: number[][]) => {
    setCurrentPolygon(polygon)
  }, [])

  const handleSave = useCallback(async (polygon: number[][]) => {
    if (!faceImage) return

    setIsSaving(true)
    try {
      await apiClient.saveSegmentation(nodeId, faceImage.id, inputDir, [polygon])

      onUpdateFace(faceImage.id, {
        segmentationPolygon: polygon
      })

      console.log('Segmentation saved successfully')
    } catch (error) {
      console.error('Failed to save segmentation:', error)
    } finally {
      setIsSaving(false)
    }
  }, [faceImage, nodeId, inputDir, onUpdateFace])

  const handleReset = useCallback(() => {
    if (!faceImage) return

    // Reset to original polygon
    loadFaceData()
  }, [faceImage, loadFaceData])

  // Rotation and alignment handlers
  const handleRotationChange = useCallback((angle: number) => {
    setRotationAngle(angle)
    
    // Apply rotation to landmarks and polygon
    if (currentLandmarks) {
      const rotatedLandmarks = rotatePoints(currentLandmarks, angle)
      setCurrentLandmarks(rotatedLandmarks)
    }
    
    if (currentPolygon) {
      const rotatedPolygon = rotatePoints(currentPolygon, angle)
      setCurrentPolygon(rotatedPolygon)
    }
  }, [currentLandmarks, currentPolygon])

  const handleAlignToEyes = useCallback(() => {
    if (!currentLandmarks || currentLandmarks.length < 68) return
    
    // Find eye landmarks (typically points 36-47 for 68-point model)
    const leftEye = currentLandmarks[36] // Left eye center
    const rightEye = currentLandmarks[45] // Right eye center
    
    if (!leftEye || !rightEye) return
    
    // Calculate angle to align eyes horizontally
    const deltaX = rightEye[0] - leftEye[0]
    const deltaY = rightEye[1] - leftEye[1]
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)
    
    handleRotationChange(-angle)
  }, [currentLandmarks, handleRotationChange])

  const handleAlignToCenter = useCallback(() => {
    if (!currentLandmarks || currentLandmarks.length < 68) return
    
    // Find face center (typically nose tip at point 30)
    const noseTip = currentLandmarks[30]
    if (!noseTip) return
    
    // Calculate offset to center the face
    const centerX = 0.5
    const centerY = 0.5
    const offsetX = centerX - noseTip[0]
    const offsetY = centerY - noseTip[1]
    
    // Apply offset to all landmarks
    const centeredLandmarks = currentLandmarks.map(landmark => [
      landmark[0] + offsetX,
      landmark[1] + offsetY
    ])
    setCurrentLandmarks(centeredLandmarks)
    
    // Apply offset to polygon
    if (currentPolygon) {
      const centeredPolygon = currentPolygon.map(point => [
        point[0] + offsetX,
        point[1] + offsetY
      ])
      setCurrentPolygon(centeredPolygon)
    }
    
    // Face centered
  }, [currentLandmarks, currentPolygon])

  const handleResetAlignment = useCallback(() => {
    setRotationAngle(0)
    loadFaceData()
  }, [loadFaceData])

  // Generate image URL using API endpoint
  const getImageUrl = useCallback((filename: string) => {
    const baseUrl = 'http://localhost:8001/api'
    const url = `${baseUrl}/nodes/${nodeId}/face-image/${encodeURIComponent(filename)}?input_dir=${encodeURIComponent(inputDir)}`
    console.log('FaceEditorModal generating image URL:', {
      filename,
      nodeId,
      inputDir,
      url
    })
    return url
  }, [nodeId, inputDir])

  // Helper function to rotate points around center
  const rotatePoints = useCallback((points: number[][], angle: number) => {
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    
    return points.map(point => {
      const x = point[0] - 0.5 // Center around origin
      const y = point[1] - 0.5
      
      const rotatedX = x * cos - y * sin
      const rotatedY = x * sin + y * cos
      
      return [rotatedX + 0.5, rotatedY + 0.5] // Move back to original position
    })
  }, [])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevFace = faceImages[currentIndex - 1]
      if (prevFace) {
        onUpdateFace(prevFace.id, { active: true })
      }
    }
  }, [currentIndex, faceImages, onUpdateFace])

  const handleNext = useCallback(() => {
    if (currentIndex < faceImages.length - 1) {
      const nextFace = faceImages[currentIndex + 1]
      if (nextFace) {
        onUpdateFace(nextFace.id, { active: true })
      }
    }
  }, [currentIndex, faceImages, onUpdateFace])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for our shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            if (currentPolygon) {
              handleSave(currentPolygon)
            }
            break
          case 'r':
            e.preventDefault()
            handleReset()
            break
          case 'z':
            e.preventDefault()
            handleResetAlignment()
            break
          case 'e':
            e.preventDefault()
            handleAlignToEyes()
            break
          case 'c':
            e.preventDefault()
            handleAlignToCenter()
            break
          case 'l':
            e.preventDefault()
            setViewMode('landmarks')
            break
          case 'm':
            e.preventDefault()
            setViewMode('segmentation')
            break
        }
      } else {
        switch (e.key) {
          case 'ArrowLeft':
            handlePrevious()
            break
          case 'ArrowRight':
            handleNext()
            break
          case 'Escape':
            onClose()
            break
          case 'Delete':
          case 'Backspace':
            if (viewMode === 'landmarks' && currentLandmarks) {
              // Delete selected landmark
              console.log('Delete landmark')
            }
            break
          case ' ':
            e.preventDefault()
            // Toggle between landmarks and segmentation
            setViewMode(viewMode === 'landmarks' ? 'segmentation' : 'landmarks')
            break
        }
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevious, handleNext, onClose, handleSave, handleReset, handleResetAlignment, handleAlignToEyes, handleAlignToCenter, viewMode, currentPolygon, currentLandmarks])

  if (!faceImage) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col transition-colors duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-300">
              Face Editor: {faceImage.filename}
            </h3>
            
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 transition-colors duration-300">
                  <button
                    onClick={() => setViewMode('landmarks')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                      viewMode === 'landmarks'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Landmarks
                  </button>
                  <button
                    onClick={() => setViewMode('segmentation')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                      viewMode === 'segmentation'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Segmentation
                  </button>
                </div>

                {/* Rotation Controls */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                    <span>Rotation:</span>
                    <HelpTooltip content="Rotate the face image and landmarks. Use this to correct tilted faces or adjust alignment." />
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={rotationAngle}
                    onChange={(e) => handleRotationChange(Number(e.target.value))}
                    className="w-20"
                    title={`Current rotation: ${Math.round(rotationAngle)}°`}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                    {Math.round(rotationAngle)}°
                  </span>
                </div>

                {/* Alignment Controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleAlignToEyes}
                    className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                    disabled={!currentLandmarks || currentLandmarks.length < 68}
                    title="Automatically align face so eyes are horizontal (requires 68-point landmarks)"
                  >
                    Align Eyes
                  </button>
                  <button
                    onClick={handleAlignToCenter}
                    className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                    disabled={!currentLandmarks || currentLandmarks.length < 68}
                    title="Center the face based on nose tip position (requires 68-point landmarks)"
                  >
                    Center Face
                  </button>
                  <button
                    onClick={handleResetAlignment}
                    className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                    title="Reset all alignment changes and restore original position"
                  >
                    Reset
                  </button>
                </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
              title="Show keyboard shortcuts"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Segmentation Editor */}
          {viewMode === 'segmentation' && (
            <div className="flex-1">
              <SegmentationEditor
                imagePath={getImageUrl(faceImage.filename)}
                initialPolygon={currentPolygon}
                landmarks={currentLandmarks}
                eyebrowExpandMod={eyebrowExpandMod}
                onPolygonChange={handlePolygonChange}
                onSave={handleSave}
                width={1000}
                height={700}
              />
            </div>
          )}

              {/* Landmarks View */}
              {viewMode === 'landmarks' && (
                <div className="flex-1">
                  <LandmarkEditor
                    imagePath={getImageUrl(faceImage.filename)}
                    landmarks={currentLandmarks}
                    onLandmarksChange={setCurrentLandmarks}
                    width={1000}
                    height={700}
                  />
                </div>
              )}
        </div>

        {/* Keyboard Shortcuts Panel */}
        {showKeyboardShortcuts && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Navigation</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Previous face</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">←</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Next face</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">→</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Close modal</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Actions</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Save changes</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Reset changes</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+R</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Reset alignment</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+Z</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Align to eyes</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+E</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Center face</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+C</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">View Modes</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Switch to landmarks</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+L</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Switch to segmentation</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+M</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Toggle view mode</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Space</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Landmark Editing</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Delete selected landmark</span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Delete</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Add landmark point</span>
                      <span className="text-gray-500 dark:text-gray-400">Click on image</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Move landmark point</span>
                      <span className="text-gray-500 dark:text-gray-400">Drag point</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrevious}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
                  title="Go to previous face (Left Arrow key)"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleNext}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
                  title="Go to next face (Right Arrow key)"
                >
                  Next →
                </button>
              </div>

          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {currentIndex + 1} / {faceImages.length}
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
              disabled={isSaving}
              title="Reset all changes and restore original data (Ctrl+R)"
            >
              Reset
            </button>
            {isSaving && (
              <div className="flex items-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaceEditorModal
