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
  allFaceData: Record<string, { landmarks?: number[][]; segmentation?: number[][][]; face_type?: string; source_filename?: string }>
  faceDataImported: boolean
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
  allFaceData,
  faceDataImported,
  onFaceSelect,
  onFaceMultiSelect,
  loading,
  nodeId,
  inputDir
}) => {
  // Grid and container state
  const gridRef = useRef<FixedSizeGrid>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

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

  // Get face data from pre-imported data
  const getFaceData = useCallback((faceId: string) => {
    // Remove file extension to match backend keys (e.g., "00001_0.jpg" -> "00001_0")
    const keyWithoutExtension = faceId.replace(/\.(jpg|jpeg|png)$/i, '')
    const data = allFaceData[keyWithoutExtension] || null
    console.log(`getFaceData called for ${faceId}:`, {
      hasData: !!data,
      originalFaceId: faceId,
      keyWithoutExtension,
      dataKeys: Object.keys(allFaceData).slice(0, 10), // Show first 10 keys
      totalDataKeys: Object.keys(allFaceData).length,
      showSegmentation,
      showAlignments,
      allFaceDataSample: Object.keys(allFaceData).slice(0, 3).map(key => ({ key, hasData: !!allFaceData[key] }))
    })
    if (data && (showSegmentation || showAlignments)) {
      console.log(`Face ${faceId} data:`, {
        hasLandmarks: !!data.landmarks,
        landmarksCount: data.landmarks?.length || 0,
        landmarksSample: data.landmarks?.slice(0, 3),
        hasSegmentation: !!data.segmentation,
        segmentationCount: data.segmentation?.length || 0,
        segmentationSample: data.segmentation?.[0]?.slice(0, 3),
        showSegmentation,
        showAlignments,
        fullData: data
      })
    }
    return data
  }, [allFaceData, showSegmentation, showAlignments])

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
    const cachedData = getFaceData(face.filename)
    const isLoadingData = false // No more loading since data is pre-imported

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
          {showSegmentation && cachedData?.segmentation && (() => {
            console.log(`Rendering segmentation for ${face.id}:`, {
              showSegmentation,
              hasSegmentation: !!cachedData?.segmentation,
              segmentationCount: cachedData?.segmentation?.length,
              segmentationSample: cachedData?.segmentation?.[0]?.slice(0, 3)
            })
            return true
          })() && (
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
          {showAlignments && cachedData?.landmarks && (() => {
            console.log(`Rendering landmarks for ${face.id}:`, {
              showAlignments,
              hasLandmarks: !!cachedData?.landmarks,
              landmarksCount: cachedData?.landmarks?.length,
              landmarksSample: cachedData?.landmarks?.slice(0, 3)
            })
            return true
          })() && (
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
  }, [getImageUrl, handleFaceClick, handleFaceCheckboxChange, showSegmentation, showAlignments, getFaceData])

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
              {(showSegmentation || showAlignments) && !faceDataImported && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠ Face data not imported yet
                </span>
              )}
              {(showSegmentation || showAlignments) && faceDataImported && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  ✓ Face data imported ({Object.keys(allFaceData).length} images)
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