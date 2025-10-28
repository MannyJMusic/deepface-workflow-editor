import React, { useState, useCallback, useMemo } from 'react'

interface FaceImage {
  id: string
  filename: string
  filePath: string
  thumbnailUrl?: string | null
  segmentationPolygon?: any
  landmarks?: any
  selected?: boolean
  active?: boolean
  hasFaceData?: boolean
}

interface FaceGridProps {
  faceImages: FaceImage[]
  showSegmentation?: boolean
  showAlignments?: boolean
  allFaceData?: Record<string, { landmarks?: number[][]; segmentation?: number[][][]; face_type?: string; source_filename?: string }>
  faceDataImported?: boolean
  onFaceSelect: (faceId: string) => void
  onFaceMultiSelect: (faceId: string, selected: boolean) => void
  loading: boolean
  nodeId: string
  inputDir: string
}

type ViewMode = 'list' | 'grid'
type SortMode = 'filename' | 'date' | 'size' | 'similarity'
type FrameSize = 10 | 25 | 50 | 75 | 100

const FaceGrid: React.FC<FaceGridProps> = ({
  faceImages,
  showSegmentation = false,
  showAlignments = false,
  allFaceData = {},
  faceDataImported = false,
  onFaceSelect,
  onFaceMultiSelect,
  loading,
  nodeId,
  inputDir
}) => {
  // State for grid controls
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [frameSize, setFrameSize] = useState<FrameSize>(25)
  const [sortMode, setSortMode] = useState<SortMode>('filename')
  const [frameRange, setFrameRange] = useState({ start: 0, end: faceImages.length })
  const [selectedFaces, setSelectedFaces] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1)

  // Generate image URL using API endpoint
  const getImageUrl = useCallback((filename: string) => {
    const baseUrl = 'http://localhost:8001/api'
    const url = `${baseUrl}/nodes/${nodeId}/face-image/${encodeURIComponent(filename)}?input_dir=${encodeURIComponent(inputDir)}`
    return url
  }, [nodeId, inputDir])

  // Debug logging
  React.useEffect(() => {
    console.log('FaceGridNew received faceImages:', faceImages.length)
    console.log('FaceGridNew nodeId:', nodeId)
    console.log('FaceGridNew inputDir:', inputDir)
    if (faceImages.length > 0) {
      console.log('First face image:', faceImages[0])
    }
  }, [faceImages, nodeId, inputDir])

  // Update frame range when face images change
  React.useEffect(() => {
    if (faceImages.length > 0) {
      setFrameRange({ start: 0, end: faceImages.length })
    }
  }, [faceImages.length])

  // Sort face images based on current sort mode
  const sortedFaceImages = useMemo(() => {
    const sorted = [...faceImages].sort((a, b) => {
      switch (sortMode) {
        case 'filename':
          return a.filename.localeCompare(b.filename)
        case 'date':
          // For now, use filename as proxy for date since we don't have file dates
          return a.filename.localeCompare(b.filename)
        case 'size':
          // For now, use filename as proxy for size since we don't have file sizes
          return a.filename.localeCompare(b.filename)
        case 'similarity':
          // For now, use filename as proxy for similarity since we don't have similarity data
          return a.filename.localeCompare(b.filename)
        default:
          return 0
      }
    })
    
    // Apply frame range filter
    return sorted.slice(frameRange.start, frameRange.end)
  }, [faceImages, sortMode, frameRange])

  // Handle face selection with Ctrl+Click and Shift+Click support
  const handleFaceClick = useCallback((faceId: string, event: React.MouseEvent) => {
    const currentIndex = sortedFaceImages.findIndex(f => f.id === faceId)
    
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle selection
      const newSelected = new Set(selectedFaces)
      if (newSelected.has(faceId)) {
        newSelected.delete(faceId)
      } else {
        newSelected.add(faceId)
      }
      setSelectedFaces(newSelected)
      onFaceMultiSelect(faceId, !selectedFaces.has(faceId))
    } else if (event.shiftKey && lastSelectedIndex !== -1) {
      // Shift+Click: Range selection
      const start = Math.min(lastSelectedIndex, currentIndex)
      const end = Math.max(lastSelectedIndex, currentIndex)
      const newSelected = new Set(selectedFaces)
      
      for (let i = start; i <= end; i++) {
        const faceId = sortedFaceImages[i].id
        newSelected.add(faceId)
        onFaceMultiSelect(faceId, true)
      }
      setSelectedFaces(newSelected)
    } else {
      // Regular click: Select only this face
      const newSelected = new Set([faceId])
      setSelectedFaces(newSelected)
      
      // Update all faces
      for (const face of sortedFaceImages) {
        onFaceMultiSelect(face.id, face.id === faceId)
      }
      
      onFaceSelect(faceId)
    }
    
    setLastSelectedIndex(currentIndex)
  }, [sortedFaceImages, selectedFaces, lastSelectedIndex, onFaceSelect, onFaceMultiSelect])

  const handleFaceCheckboxChange = useCallback((faceId: string, checked: boolean) => {
    const newSelected = new Set(selectedFaces)
    if (checked) {
      newSelected.add(faceId)
    } else {
      newSelected.delete(faceId)
    }
    setSelectedFaces(newSelected)
    onFaceMultiSelect(faceId, checked)
  }, [selectedFaces, onFaceMultiSelect])

  const handleBookmark = useCallback((faceId: string) => {
    console.log('Bookmarking face:', faceId)
    // TODO: Implement bookmark functionality
  }, [])

  const handleSort = useCallback(() => {
    // Sort is handled by the useMemo hook above
    console.log('Sorting by:', sortMode)
  }, [sortMode])

  const handleFilter = useCallback(() => {
    // Filter is handled by the frame range
    console.log('Filtering range:', frameRange)
  }, [frameRange])

  const renderFaceThumbnail = (face: FaceImage, index: number) => {
    const size = Math.round(120 * (frameSize / 100)) // Dynamic size based on frame size
    const imageUrl = getImageUrl(face.filename)
    const isSelected = selectedFaces.has(face.id)
    const hasFaceData = faceDataImported && allFaceData[face.id]
    
    // Debug logging for first few images
    if (index < 3) {
      console.log(`Face ${index}:`, {
        id: face.id,
        filename: face.filename,
        imageUrl,
        nodeId,
        inputDir
      })
    }
    
    return (
      <div
        key={face.id}
        className={`relative group cursor-pointer transition-all duration-200 pb-6 ${
          face.active 
            ? 'ring-2 ring-blue-500' 
            : isSelected 
            ? 'ring-2 ring-green-500' 
            : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600'
        } ${hasFaceData ? 'ring-1 ring-blue-300 dark:ring-blue-600' : ''}`}
        style={{ width: size }}
        onClick={(e) => handleFaceClick(face.id, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleFaceClick(face.id, e as any)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Face ${face.filename}`}
      >
        {/* Face Image */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden relative" style={{ height: size }}>
          <img
            src={imageUrl}
            alt={face.filename}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Failed to load image:', imageUrl)
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />

          {/* Selection Checkbox */}
          <div className="absolute top-1 left-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation()
                handleFaceCheckboxChange(face.id, e.target.checked)
              }}
              className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Bookmark Icon */}
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                handleBookmark(face.id)
              }}
              className="text-yellow-500 hover:text-yellow-600 text-xs"
              title="Bookmark face"
            >
              🔖
            </button>
          </div>

          {/* Face Data Indicator */}
          {hasFaceData && (
            <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-1 rounded">
              ✓
            </div>
          )}

          {/* View Mode Overlays */}
          {showSegmentation && face.segmentationPolygon && (
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full">
                <polygon
                  points={face.segmentationPolygon.map((p: any) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(0, 255, 0, 0.3)"
                  stroke="green"
                  strokeWidth="1"
                />
              </svg>
            </div>
          )}

          {showAlignments && face.landmarks && (
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full">
                {face.landmarks.map((landmark: any, index: number) => (
                  <circle
                    key={`${face.id}-landmark-${index}`}
                    cx={landmark.x}
                    cy={landmark.y}
                    r="2"
                    fill="red"
                    stroke="white"
                    strokeWidth="1"
                  />
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* Filename */}
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center break-all px-1">
          {face.filename}
        </div>
      </div>
    )
  }

  const renderListView = () => (
    <div className="space-y-2">
      {sortedFaceImages.map((face, index) => (
        <div
          key={face.id}
          className={`flex items-center p-2 rounded-md cursor-pointer transition-colors duration-200 ${
            face.active 
              ? 'bg-blue-100 dark:bg-blue-900/30' 
              : selectedFaces.has(face.id) 
              ? 'bg-green-100 dark:bg-green-900/30' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={(e) => handleFaceClick(face.id, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleFaceClick(face.id, e as any)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Face ${face.filename}`}
        >
          <input
            type="checkbox"
            checked={selectedFaces.has(face.id)}
            onChange={(e) => {
              e.stopPropagation()
              handleFaceCheckboxChange(face.id, e.target.checked)
            }}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-3"
          />
          
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 mr-3">
            <img
              src={getImageUrl(face.filename)}
              alt={face.filename}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {face.filename}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {faceDataImported && allFaceData[face.id] ? 'Face data available' : 'No face data'}
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleBookmark(face.id)
            }}
            className="text-yellow-500 hover:text-yellow-600 text-sm"
            title="Bookmark face"
          >
            🔖
          </button>
        </div>
      ))}
    </div>
  )

  if (loading && faceImages.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* View Mode Indicator */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  View Mode:
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  showSegmentation ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                  showAlignments ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {showSegmentation ? 'Segmentation' : 
                   showAlignments ? 'Alignments' : 'Normal'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading faces...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Controls Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">View:</span>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  title="List view"
                >
                  📋
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  title="Grid view"
                >
                  ⊞
                </button>
              </div>
            </div>

            {/* Frame Size Control */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Size:</span>
              <select
                value={frameSize}
                onChange={(e) => setFrameSize(Number(e.target.value) as FrameSize)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={10}>10%</option>
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
              </select>
            </div>

            {/* Sort & Filter Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sort:</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="filename">Filename</option>
                <option value="date">Date</option>
                <option value="size">Size</option>
                <option value="similarity">Similarity</option>
              </select>
              <button
                onClick={handleSort}
                className="px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
              >
                Sort
              </button>
            </div>

            {/* Frame Range Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Range:</span>
              <input
                type="number"
                value={frameRange.start}
                onChange={(e) => setFrameRange(prev => ({ ...prev, start: Number(e.target.value) }))}
                className="w-16 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Start"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">-</span>
              <input
                type="number"
                value={frameRange.end}
                onChange={(e) => setFrameRange(prev => ({ ...prev, end: Number(e.target.value) }))}
                className="w-16 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="End"
              />
              <button
                onClick={handleFilter}
                className="px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Face Count and Selection Info */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedFaces.size > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {selectedFaces.size} selected
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sortedFaceImages.length} faces
              {loading && faceImages.length > 0 && (
                <span className="ml-2 text-blue-500">(loading more...)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Face Grid/List */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
            {sortedFaceImages.map(renderFaceThumbnail)}
          </div>
        ) : (
          renderListView()
        )}
      </div>
    </div>
  )
}

export default FaceGrid

