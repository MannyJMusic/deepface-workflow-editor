import React, { useState, useCallback, useRef, useEffect } from 'react'
import SegmentationEditor from './SegmentationEditor'
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
      if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevious, handleNext, onClose])

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
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Segmentation Editor */}
          {viewMode === 'segmentation' && (
            <div className="flex-1">
              <SegmentationEditor
                imagePath={faceImage.filePath}
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
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
              <div className="relative">
                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                  <img
                    src={faceImage.filePath}
                    alt={faceImage.filename}
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: '700px' }}
                  />

                  {/* Landmarks Overlay */}
                  {currentLandmarks && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {currentLandmarks.map((landmark, index) => (
                        <circle
                          key={`landmark-${index}`}
                          cx={landmark[0] * 100}
                          cy={landmark[1] * 100}
                          r="0.5"
                          fill="#ff0000"
                          opacity="0.8"
                        />
                      ))}
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevious}
              className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
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
