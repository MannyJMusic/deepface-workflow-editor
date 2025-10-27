import React, { useCallback, useEffect, useState, useRef } from 'react'
import { FixedSizeGrid } from 'react-window'
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
  hasFaceData?: boolean  // New property to track if face data has been imported
}

interface FaceGridProps {
  faceImages: FaceImage[]
  showSegmentation: boolean
  showAlignments: boolean
  onFaceSelect: (faceId: string) => void
  onFaceMultiSelect: (faceId: string, selected: boolean) => void
  loading: boolean
  nodeId: string
  inputDir: string
}

const OptimizedFaceGrid: React.FC<FaceGridProps> = ({
  faceImages,
  showSegmentation,
  showAlignments,
  onFaceSelect,
  onFaceMultiSelect,
  loading,
  nodeId,
  inputDir
}) => {
  // State for face data
  const [faceDataCache, setFaceDataCache] = useState<Map<string, { landmarks?: number[][]; segmentation?: number[][][] }>>(new Map())
  const [loadingFaceData, setLoadingFaceData] = useState<Set<string>>(new Set())
  const gridRef = useRef<FixedSizeGrid>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const loadingStartedRef = useRef(false)
  const requestedFaceIdsRef = useRef<Set<string>>(new Set())

  // Generate image URL using API endpoint
  const getImageUrl = useCallback((filename: string) => {
    const baseUrl = 'http://localhost:8001/api'
    const url = `${baseUrl}/nodes/${nodeId}/face-image/${encodeURIComponent(filename)}?input_dir=${encodeURIComponent(inputDir)}`
    return url
  }, [nodeId, inputDir])

  const handleFaceClick = useCallback((faceId: string) => {
    onFaceSelect(faceId)
  }, [onFaceSelect])

  const handleFaceCheckboxChange = useCallback((faceId: string, checked: boolean) => {
    onFaceMultiSelect(faceId, checked)
  }, [onFaceMultiSelect])

  // Fetch face data for a specific image
  const fetchFaceData = useCallback(async (faceId: string) => {
    // Check if already requested or cached
    if (requestedFaceIdsRef.current.has(faceId) || faceDataCache.has(faceId)) {
      return // Already requested or cached
    }

    requestedFaceIdsRef.current.add(faceId)
    setLoadingFaceData(prev => new Set(prev).add(faceId))

    try {
      const response = await apiClient.getFaceData(nodeId, faceId, inputDir)
      if (response.success) {
        setFaceDataCache(prev => {
          const newCache = new Map(prev)
          newCache.set(faceId, {
            landmarks: response.landmarks,
            segmentation: response.segmentation
          })
          return newCache
        })
      }
    } catch (error) {
      console.error(`Failed to fetch face data for ${faceId}:`, error)
    } finally {
      setLoadingFaceData(prev => {
        const newSet = new Set(prev)
        newSet.delete(faceId)
        return newSet
      })
    }
  }, [nodeId, inputDir, faceDataCache])

  // Fetch face data in batches for better performance
  const fetchFaceDataBatch = useCallback(async (faceIds: string[]) => {
    // Filter out already cached or requested faces
    const facesToLoad = faceIds.filter(faceId => 
      !requestedFaceIdsRef.current.has(faceId) && !faceDataCache.has(faceId)
    )
    
    if (facesToLoad.length === 0) {
      return
    }

    // Mark all faces as requested
    facesToLoad.forEach(faceId => requestedFaceIdsRef.current.add(faceId))
    setLoadingFaceData(prev => {
      const newSet = new Set(prev)
      facesToLoad.forEach(faceId => newSet.add(faceId))
      return newSet
    })

    try {
      const response = await apiClient.getFaceDataBatch(nodeId, facesToLoad, inputDir)
      if (response.success) {
        setFaceDataCache(prev => {
          const newCache = new Map(prev)
          Object.entries(response.results).forEach(([faceId, faceData]) => {
            if (faceData.success) {
              newCache.set(faceId, {
                landmarks: faceData.landmarks,
                segmentation: faceData.segmentation
              })
            }
          })
          return newCache
        })
      }
    } catch (error) {
      console.error(`Failed to fetch batch face data:`, error)
    } finally {
      setLoadingFaceData(prev => {
        const newSet = new Set(prev)
        facesToLoad.forEach(faceId => newSet.delete(faceId))
        return newSet
      })
    }
  }, [nodeId, inputDir])

  // Fetch face data when view mode changes to segmentation or alignments
  useEffect(() => {
    if (showSegmentation || showAlignments) {
      // Prevent multiple simultaneous loading operations
      if (loadingStartedRef.current) {
        return
      }
      
      loadingStartedRef.current = true
      
      // Load data for all images using batch API
      const loadAllFaceData = async () => {
        const batchSize = 50 // Process 50 images at a time (much larger batches with new API)
        const totalImages = faceImages.length
        
        for (let i = 0; i < totalImages; i += batchSize) {
          const batch = faceImages.slice(i, i + batchSize)
          const faceIds = batch.map(face => face.id)
          
          // Use batch API for much better performance
          await fetchFaceDataBatch(faceIds)
          
          // Small delay between batches to prevent server overload
          if (i + batchSize < totalImages) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
      }
      
      loadAllFaceData()
    } else {
      // Reset loading flag when overlays are disabled
      loadingStartedRef.current = false
      requestedFaceIdsRef.current.clear()
    }
  }, [showSegmentation, showAlignments, faceImages.length, fetchFaceDataBatch])

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Calculate grid dimensions
  const itemSize = 160 // Width and height of each cell (120px image + padding)
  const columnCount = Math.max(1, Math.floor(containerSize.width / itemSize))
  const rowCount = Math.ceil(faceImages.length / columnCount)

  // Render individual face thumbnail
  const renderFaceThumbnail = useCallback((face: FaceImage, index: number) => {
    const size = 120
    const cachedData = faceDataCache.get(face.id)
    const isLoadingData = loadingFaceData.has(face.id)

    return (
      <div
        key={face.id}
        className={`relative group cursor-pointer transition-all duration-200 pb-6 ${
          face.active 
            ? 'ring-2 ring-blue-500' 
            : face.selected 
            ? 'ring-2 ring-green-500' 
            : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600'
        }`}
        style={{ width: size }}
        onClick={() => handleFaceClick(face.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleFaceClick(face.id)
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Face image ${face.filename}${face.hasFaceData ? ' with imported face data' : ''}`}
        title={face.hasFaceData ? 'Face data imported - blue outline indicates embedded metadata' : 'No face data imported'}
      >
        {/* Face Image */}
        <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden relative ${
          face.hasFaceData ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''
        }`} style={{ height: size }}>
          <img
            src={getImageUrl(face.filename)}
            alt={face.filename}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to filename if image fails to load
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const fallback = target.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          
          {/* Fallback display when image fails to load */}
          <div 
            className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs"
            style={{ display: 'none' }}
          >
            {face.filename}
          </div>

          {/* Segmentation Polygon Overlay */}
          {showSegmentation && cachedData?.segmentation && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {cachedData.segmentation.map((polygon, polygonIndex) => {
                // Convert pixel coordinates to 0-100 SVG coordinates
                // For DeepFaceLab aligned images, polygons are in 640x640 coordinate system
                const imageSize = 640
                const scale = 100 / imageSize
                
                return (
                  <polygon
                    key={polygonIndex}
                    points={polygon.map(point => `${point[0] * scale},${point[1] * scale}`).join(' ')}
                    fill="rgba(0, 255, 0, 0.2)"
                    stroke="#00ff00"
                    strokeWidth="0.3"
                    opacity="0.8"
                  />
                )
              })}
            </svg>
          )}

          {/* Landmarks Overlay */}
          {showAlignments && cachedData?.landmarks && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {(() => {
                // The landmarks are in pixel coordinates relative to the original image
                // We need to map them to the 100x100 SVG coordinate system
                const landmarks = cachedData.landmarks
                
                // For DeepFaceLab aligned images, landmarks are in a 640x640 coordinate system
                // Map them to 0-100 SVG coordinates
                const imageSize = 640 // Actual DeepFaceLab aligned image size
                const scale = 100 / imageSize
                
                return landmarks.map((landmark, index) => (
                  <circle
                    key={index}
                    cx={landmark[0] * scale}
                    cy={landmark[1] * scale}
                    r="0.6"
                    fill="#ff0000"
                    opacity="0.9"
                  />
                ))
              })()}
              {/* Connect landmarks with lines for facial features */}
              {cachedData.landmarks.length >= 5 && (() => {
                const landmarks = cachedData.landmarks
                const imageSize = 640
                const scale = 100 / imageSize
                
                return (
                  <>
                    {/* Left eye */}
                    <line
                      x1={landmarks[36][0] * scale}
                      y1={landmarks[36][1] * scale}
                      x2={landmarks[39][0] * scale}
                      y2={landmarks[39][1] * scale}
                      stroke="#ff0000"
                      strokeWidth="0.2"
                      opacity="0.7"
                    />
                    {/* Right eye */}
                    <line
                      x1={landmarks[42][0] * scale}
                      y1={landmarks[42][1] * scale}
                      x2={landmarks[45][0] * scale}
                      y2={landmarks[45][1] * scale}
                      stroke="#ff0000"
                      strokeWidth="0.2"
                      opacity="0.7"
                    />
                    {/* Nose bridge */}
                    <line
                      x1={landmarks[27][0] * scale}
                      y1={landmarks[27][1] * scale}
                      x2={landmarks[30][0] * scale}
                      y2={landmarks[30][1] * scale}
                      stroke="#ff0000"
                      strokeWidth="0.2"
                      opacity="0.7"
                    />
                    {/* Mouth */}
                    <line
                      x1={landmarks[48][0] * scale}
                      y1={landmarks[48][1] * scale}
                      x2={landmarks[54][0] * scale}
                      y2={landmarks[54][1] * scale}
                      stroke="#ff0000"
                      strokeWidth="0.2"
                      opacity="0.7"
                    />
                  </>
                )
              })()}
            </svg>
          )}

          {/* Loading indicator for face data */}
          {isLoadingData && (showSegmentation || showAlignments) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-md">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}

          {/* Face Data Indicator */}
          {face.hasFaceData && (
            <div className="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full border border-white dark:border-gray-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          )}

          {/* Selection Checkbox */}
          <div className="absolute top-1 left-1">
            <input
              type="checkbox"
              checked={face.selected || false}
              onChange={(e) => {
                e.stopPropagation()
                handleFaceCheckboxChange(face.id, e.target.checked)
              }}
              className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Bookmark Icon */}
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button className="text-yellow-500 hover:text-yellow-600 text-xs">
              🔖
            </button>
          </div>
        </div>

        {/* Filename */}
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center break-all px-1">
          {face.filename}
        </div>
      </div>
    )
  }, [getImageUrl, handleFaceClick, handleFaceCheckboxChange, showSegmentation, showAlignments, faceDataCache, loadingFaceData])

  // Cell renderer for virtual grid
  const Cell = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * columnCount + columnIndex
    if (index >= faceImages.length) {
      return null
    }

    const face = faceImages[index]
    return (
      <div style={style}>
        <div className="p-2 h-full">
          {renderFaceThumbnail(face, index)}
        </div>
      </div>
    )
  }, [faceImages, columnCount, renderFaceThumbnail])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading faces...</p>
        </div>
      </div>
    )
  }

  if (faceImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-4">👤</div>
          <p className="text-lg font-medium mb-2">No faces detected</p>
          <p className="text-sm">Click "Detect Faces" to scan the input directory</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Overlay Status Indicator */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Overlays:
              </span>
              {showSegmentation && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  Segmentation
                </span>
              )}
              {showAlignments && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                  Alignments
                </span>
              )}
              {!showSegmentation && !showAlignments && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  None
                </span>
              )}
              {(showSegmentation || showAlignments) && loadingFaceData.size > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Loading data for {loadingFaceData.size} images... ({faceDataCache.size}/{faceImages.length} loaded)
                </span>
              )}
              {(showSegmentation || showAlignments) && loadingFaceData.size === 0 && faceDataCache.size > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  ✓ All {faceDataCache.size} images loaded
                </span>
              )}
            </div>
          </div>

          {/* Face Count */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {faceImages.length} faces loaded {faceImages.length > 1000 && '(virtualized)'}
          </div>
        </div>
      </div>

      {/* Face Grid - Virtual Scrolling */}
      <div ref={containerRef} className="flex-1">
        <FixedSizeGrid
          ref={gridRef}
          columnCount={columnCount}
          columnWidth={itemSize}
          height={containerSize.height}
          rowCount={rowCount}
          rowHeight={itemSize}
          width={containerSize.width}
          className="bg-gray-50 dark:bg-gray-900"
        >
          {Cell}
        </FixedSizeGrid>
      </div>
    </div>
  )
}

export default OptimizedFaceGrid