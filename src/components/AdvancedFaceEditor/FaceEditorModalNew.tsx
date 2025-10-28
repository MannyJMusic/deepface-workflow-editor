import React, { useState, useCallback, useEffect } from 'react'
import SegmentationEditor from './SegmentationEditor'
import LandmarkEditor from './LandmarkEditor'
import { apiClient } from '../../services/api'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  RotateCcw,
  Save,
  Copy,
  Trash2,
  HelpCircle,
  ZoomIn,
  Move,
  Edit3,
  Eraser,
  Grid3X3,
  MousePointer
} from 'lucide-react'

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

const FaceEditorModalNew: React.FC<FaceEditorModalProps> = ({
  faceImage,
  faceImages,
  onClose,
  onUpdateFace,
  nodeId,
  inputDir,
  eyebrowExpandMod = 1
}) => {
  const [viewMode, setViewMode] = useState<'landmarks' | 'segmentation'>('segmentation')
  const [currentPolygon, setCurrentPolygon] = useState<number[][][] | number[][] | undefined>(undefined)
  const [currentLandmarks, setCurrentLandmarks] = useState<number[][] | undefined>(faceImage?.landmarks)
  
  // Debug logging
  console.log('FaceEditorModalNew faceImage data:', {
    filename: faceImage?.filename,
    hasSegmentation: !!faceImage?.segmentationPolygon,
    segmentationLength: faceImage?.segmentationPolygon?.length,
    hasLandmarks: !!faceImage?.landmarks,
    landmarksLength: faceImage?.landmarks?.length,
    currentPolygon: currentPolygon,
    currentLandmarks: currentLandmarks
  })

  // Load detailed face data when modal opens
  useEffect(() => {
    const loadDetailedFaceData = async () => {
      if (!faceImage?.filename || !nodeId || !inputDir) return

      try {
        console.log('Loading detailed face data for:', faceImage.filename)
        const response = await apiClient.getFaceData(nodeId, faceImage.filename.replace(/\.(jpg|jpeg|png)$/i, ''), inputDir)
        console.log('Detailed face data loaded:', response)
        
        if (response.success) {
          const { landmarks, segmentation_polygons, segmentation } = response
          // Use segmentation_polygons if available, otherwise fall back to segmentation
          const finalSegmentation = segmentation_polygons || segmentation
          console.log('Face data loaded successfully:', {
            hasLandmarks: !!landmarks,
            landmarksCount: landmarks?.length,
            hasSegmentation: !!finalSegmentation,
            segmentationCount: finalSegmentation?.length,
            segmentationData: finalSegmentation,
            rawSegmentation: segmentation,
            rawSegmentationPolygons: segmentation_polygons
          })
          if (landmarks) {
            setCurrentLandmarks(landmarks)
          }
          if (finalSegmentation && finalSegmentation.length > 0) {
            // Backend returns array of polygons - pass the entire array
            console.log('Using all segmentation polygons:', {
              polygonsCount: finalSegmentation.length,
              sampleFirstPolygon: finalSegmentation[0]?.slice(0, 3),
              isArray: Array.isArray(finalSegmentation),
              isFirstPolygonArray: Array.isArray(finalSegmentation[0])
            })
            setCurrentPolygon(finalSegmentation as number[][][])
            
            // Auto-switch to segmentation mode if segmentation data is available
            if (viewMode === 'landmarks') {
              console.log('Auto-switching to segmentation mode since segmentation data is available')
              setViewMode('segmentation')
            }
          }
        } else {
          console.log('No face data found for this image. User may need to run "Import face data" first.')
        }
      } catch (error) {
        console.error('Failed to load detailed face data:', error)
      }
    }

    loadDetailedFaceData()
  }, [faceImage?.filename, nodeId, inputDir])
  const [isSaving, setIsSaving] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Tool states
  const [selectedTool, setSelectedTool] = useState<'select' | 'draw' | 'erase' | 'pan' | 'zoom'>('select')
  const [brushSize, setBrushSize] = useState(5)
  const [opacity, setOpacity] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [showLandmarks, setShowLandmarks] = useState(false)
  const [showSegmentation, setShowSegmentation] = useState(true)
  
  // Facial region selection for landmarks
  const [selectedRegions, setSelectedRegions] = useState({
    all: true,
    outer: true,
    leftEyebrow: true,
    leftEye: true,
    rightEyebrow: true,
    rightEye: true,
    nose: true,
    mouth: true
  })

  // Update visibility based on view mode
  useEffect(() => {
    console.log('FaceEditorModalNew mode switching effect triggered:', {
      viewMode,
      currentShowSegmentation: showSegmentation,
      currentShowLandmarks: showLandmarks
    })
    
    if (viewMode === 'segmentation') {
      console.log('Setting showSegmentation=true, showLandmarks=false')
      setShowSegmentation(true)
      setShowLandmarks(false)
    } else if (viewMode === 'landmarks') {
      console.log('Setting showSegmentation=false, showLandmarks=true')
      setShowSegmentation(false)
      setShowLandmarks(true)
    }
  }, [viewMode])

  // Force initial mode setting on mount
  useEffect(() => {
    console.log('FaceEditorModalNew initial mount effect:', {
      viewMode,
      showSegmentation,
      showLandmarks
    })
    
    // Force set the correct values based on current viewMode
    if (viewMode === 'segmentation') {
      setShowSegmentation(true)
      setShowLandmarks(false)
    } else {
      setShowSegmentation(false)
      setShowLandmarks(true)
    }
  }, []) // Run only on mount

  // Update current index when face image changes
  useEffect(() => {
    if (faceImage && faceImages.length > 0) {
      const index = faceImages.findIndex(f => f.id === faceImage.id)
      if (index !== -1) {
        setCurrentIndex(index)
      }
    }
  }, [faceImage, faceImages])

  // Update current data when face image changes
  useEffect(() => {
    if (faceImage) {
      setCurrentPolygon(faceImage.segmentationPolygon)
      setCurrentLandmarks(faceImage.landmarks)
    }
  }, [faceImage])

  // Generate image URL using API endpoint
  const getImageUrl = useCallback((filename: string) => {
    const baseUrl = 'http://localhost:8001/api'
    const url = `${baseUrl}/nodes/${nodeId}/face-image/${encodeURIComponent(filename)}?input_dir=${encodeURIComponent(inputDir)}`
    return url
  }, [nodeId, inputDir])

  const handleSave = useCallback(async (polygon?: number[][]) => {
    if (!faceImage) return
    
    setIsSaving(true)
    try {
      const updates: Partial<FaceImage> = {}
      
      if (viewMode === 'segmentation' && polygon) {
        updates.segmentationPolygon = polygon
      } else if (viewMode === 'landmarks' && currentLandmarks) {
        updates.landmarks = currentLandmarks
      }
      
      await apiClient.updateFaceData(nodeId, faceImage.id, updates)
      onUpdateFace(faceImage.id, updates)
    } catch (error) {
      console.error('Failed to save face data:', error)
    } finally {
      setIsSaving(false)
    }
  }, [faceImage, viewMode, currentLandmarks, nodeId, onUpdateFace])

  const handlePolygonChange = useCallback((polygon: number[][]) => {
    setCurrentPolygon(polygon)
  }, [])

  const handleLandmarksChange = useCallback((landmarks: number[][]) => {
    setCurrentLandmarks(landmarks)
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

  const handleCopyToNext = useCallback(() => {
    if (currentIndex < faceImages.length - 1) {
      const nextFace = faceImages[currentIndex + 1]
      if (nextFace) {
        const updates: Partial<FaceImage> = {}
        if (viewMode === 'segmentation' && currentPolygon) {
          updates.segmentationPolygon = currentPolygon
        } else if (viewMode === 'landmarks' && currentLandmarks) {
          updates.landmarks = currentLandmarks
        }
        onUpdateFace(nextFace.id, updates)
      }
    }
  }, [currentIndex, faceImages, viewMode, currentPolygon, currentLandmarks, onUpdateFace])

  const handleCopyToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevFace = faceImages[currentIndex - 1]
      if (prevFace) {
        const updates: Partial<FaceImage> = {}
        if (viewMode === 'segmentation' && currentPolygon) {
          updates.segmentationPolygon = currentPolygon
        } else if (viewMode === 'landmarks' && currentLandmarks) {
          updates.landmarks = currentLandmarks
        }
        onUpdateFace(prevFace.id, updates)
      }
    }
  }, [currentIndex, faceImages, viewMode, currentPolygon, currentLandmarks, onUpdateFace])

  const handleReset = useCallback(() => {
    if (viewMode === 'segmentation') {
      setCurrentPolygon(faceImage?.segmentationPolygon)
    } else {
      setCurrentLandmarks(faceImage?.landmarks)
    }
  }, [viewMode, faceImage])

  const handleRegionToggle = useCallback((region: keyof typeof selectedRegions) => {
    setSelectedRegions(prev => ({
      ...prev,
      [region]: !prev[region]
    }))
  }, [])

  if (!faceImage) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
        {/* Header with thumbnail strip */}
        <div className="flex flex-col border-b border-gray-200 dark:border-gray-700">
          {/* Top bar with title and close */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Face Editor
              </h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Face editor filename: {faceImage.filename}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          
        </div>
{/* Thumbnail strip */}
<div className="px-4 pb-4">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {/* Jump to first */}}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={handlePrevious}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex-1 flex space-x-1 overflow-x-auto max-w-md">
                {/* Thumbnail strip - show actual thumbnails */}
                {faceImages.slice(Math.max(0, currentIndex - 5), currentIndex + 6).map((face, index) => {
                  const actualIndex = Math.max(0, currentIndex - 5) + index
                  const isActive = actualIndex === currentIndex
                  return (
                    <button
                      key={face.id}
                      type="button"
                      className={`flex-shrink-0 w-12 h-12 rounded border-2 ${
                        isActive 
                          ? 'border-blue-500' 
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                      onClick={() => {
                        const targetFace = faceImages[actualIndex]
                        if (targetFace) {
                          onUpdateFace(targetFace.id, { active: true })
                        }
                      }}
                    >
                      <img
                        src={getImageUrl(face.filename)}
                        alt={face.filename}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </button>
                  )
                })}
              </div>
              
              <button 
                onClick={handleNext}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button 
                onClick={() => {/* Jump to last */}}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
              
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                Number: {currentIndex + 1}/{faceImages.length}
              </span>
            </div>
          </div>
        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side - Main editor area */}
          <div className="flex-1 flex flex-col">
            {/* Main editor canvas - full size without toolbar */}
            <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
              {viewMode === 'segmentation' ? (
                (() => {
                  console.log('FaceEditorModalNew rendering SegmentationEditor with props:', {
                    viewMode,
                    showSegmentation,
                    showLandmarks,
                    hasCurrentPolygon: !!currentPolygon,
                    polygonLength: currentPolygon?.length,
                    hasCurrentLandmarks: !!currentLandmarks,
                    landmarksLength: currentLandmarks?.length,
                    opacity,
                    brushSize,
                    selectedTool,
                    showGrid,
                    currentPolygonSample: currentPolygon?.slice(0, 3),
                    currentLandmarksSample: currentLandmarks?.slice(0, 3)
                  })
                  
                  // Force showSegmentation to true for segmentation mode
                  const forceShowSegmentation = viewMode === 'segmentation' ? true : showSegmentation
                  const forceShowLandmarks = viewMode === 'landmarks' ? true : showLandmarks
                  
                  console.log('Forced visibility values:', {
                    forceShowSegmentation,
                    forceShowLandmarks,
                    originalShowSegmentation: showSegmentation,
                    originalShowLandmarks: showLandmarks
                  })
                  
                  return (
                    <SegmentationEditor
                      key={`segmentation-${faceImage.id}-${viewMode}`}
                      imagePath={getImageUrl(faceImage.filename)}
                      initialPolygon={currentPolygon}
                      landmarks={currentLandmarks}
                      eyebrowExpandMod={eyebrowExpandMod}
                      onPolygonChange={handlePolygonChange}
                      onSave={handleSave}
                      width={800}
                      height={600}
                      showSegmentation={forceShowSegmentation}
                      showLandmarks={forceShowLandmarks}
                      opacity={opacity}
                      brushSize={brushSize}
                      selectedTool={selectedTool}
                      showGrid={showGrid}
                    />
                  )
                })()
              ) : (
                <LandmarkEditor
                  imagePath={getImageUrl(faceImage.filename)}
                  landmarks={currentLandmarks}
                  onLandmarksChange={handleLandmarksChange}
                  width={800}
                  height={600}
                  showLandmarks={showLandmarks}
                  selectedRegions={selectedRegions}
                  opacity={opacity}
                />
              )}
            </div>
          </div>

          {/* Right side - Controls panel */}
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto">
            {/* Mode toggle */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Mode</h3>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => {
                    console.log('Landmarks button clicked, setting viewMode to landmarks')
                    setViewMode('landmarks')
                  }}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    viewMode === 'landmarks'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Landmarks
                </button>
                <button
                  onClick={() => {
                    console.log('Segmentation button clicked, setting viewMode to segmentation')
                    setViewMode('segmentation')
                  }}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    viewMode === 'segmentation'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Segmentation
                </button>
              </div>
            </div>

            {/* Opacity and Brush controls */}
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="opacity-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Opacity
                </label>
                <input
                  id="opacity-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{Math.round(opacity * 100)}%</span>
              </div>
              
              <div>
                <label htmlFor="brush-size-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brush size
                </label>
                <input
                  id="brush-size-slider"
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{brushSize}px</span>
              </div>
            </div>

            {/* Segmentation controls */}
            {viewMode === 'segmentation' && (
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Segmentation</h3>
                
                <div className="space-y-2">
                  <label htmlFor="show-segmentation" className="flex items-center">
                    <input
                      id="show-segmentation"
                      type="checkbox"
                      checked={showSegmentation}
                      onChange={(e) => setShowSegmentation(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show Segmentation</span>
                  </label>
                  
                  <div>
                    <label htmlFor="segmentation-model" className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Segmentation Model</label>
                    <select id="segmentation-model" className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700">
                      <option>BiSeNet</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  
                  <button className="w-full text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
                    Load model
                  </button>
                </div>
              </div>
            )}

            {/* Landmark region controls */}
            {viewMode === 'landmarks' && (
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Facial Regions</h3>
                
                <div className="space-y-2">
                  {Object.entries(selectedRegions).map(([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => handleRegionToggle(key as keyof typeof selectedRegions)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {key.replaceAll(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
                
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Alignment editor is in readonly mode.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Alignments are editable on video frames.
                  </p>
                </div>
              </div>
            )}

            {/* Tool palette */}
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tools</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedTool('select')}
                  className={`p-2 rounded ${selectedTool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <MousePointer className="h-4 w-4 mx-auto" />
                </button>
                <button
                  onClick={() => setSelectedTool('draw')}
                  className={`p-2 rounded ${selectedTool === 'draw' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <Edit3 className="h-4 w-4 mx-auto" />
                </button>
                <button
                  onClick={() => setSelectedTool('erase')}
                  className={`p-2 rounded ${selectedTool === 'erase' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <Eraser className="h-4 w-4 mx-auto" />
                </button>
                <button
                  onClick={() => setSelectedTool('pan')}
                  className={`p-2 rounded ${selectedTool === 'pan' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <Move className="h-4 w-4 mx-auto" />
                </button>
                <button
                  onClick={() => setSelectedTool('zoom')}
                  className={`p-2 rounded ${selectedTool === 'zoom' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <ZoomIn className="h-4 w-4 mx-auto" />
                </button>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-2 rounded ${showGrid ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <Grid3X3 className="h-4 w-4 mx-auto" />
                </button>
              </div>
            </div>

            {/* Cursor and point info */}
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Info</h3>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Light Cursor</span>
                </label>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>Poly points: 0</div>
                  <div>Point approximation</div>
                  <div>Points: {currentPolygon?.length || 0}</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
              
              <button
                onClick={handleCopyToPrevious}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <Copy className="h-4 w-4" />
                <span>Paste previous frame</span>
              </button>
              
              <button
                onClick={() => handleSave(currentPolygon)}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Saving...' : 'Paste'}</span>
              </button>
              
              <button
                onClick={handleCopyToNext}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
            
            <button
              onClick={handlePrevious}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Previous
            </button>
            
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Next
            </button>
            
            <button className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
              Cycle Faces
            </button>
            
            <button className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currentIndex + 1} / {faceImages.length} Reset
            </span>
            
            <button className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaceEditorModalNew
