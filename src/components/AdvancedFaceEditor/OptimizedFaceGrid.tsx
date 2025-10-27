import React, { useCallback } from 'react'

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

interface FaceGridProps {
  faceImages: FaceImage[]
  viewMode: 'normal' | 'segmentation' | 'alignments'
  onFaceSelect: (faceId: string) => void
  onFaceMultiSelect: (faceId: string, selected: boolean) => void
  loading: boolean
  nodeId: string
  inputDir: string
}

const OptimizedFaceGrid: React.FC<FaceGridProps> = ({
  faceImages,
  viewMode,
  onFaceSelect,
  onFaceMultiSelect,
  loading,
  nodeId,
  inputDir
}) => {
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

  // Render individual face thumbnail
  const renderFaceThumbnail = useCallback((face: FaceImage, index: number) => {
    const size = 120

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
      >
        {/* Face Image */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden relative" style={{ height: size }}>
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
          {viewMode === 'segmentation' && face.segmentationPolygon && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polygon
                points={face.segmentationPolygon.map(point => `${point[0]},${point[1]}`).join(' ')}
                fill="none"
                stroke="#00ff00"
                strokeWidth="0.5"
                opacity="0.8"
              />
            </svg>
          )}

          {/* Landmarks Overlay */}
          {viewMode === 'alignments' && face.landmarks && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {face.landmarks.map((landmark, index) => (
                <circle
                  key={index}
                  cx={landmark[0]}
                  cy={landmark[1]}
                  r="0.5"
                  fill="#ff0000"
                  opacity="0.8"
                />
              ))}
              {/* Connect landmarks with lines for facial features */}
              {face.landmarks.length >= 5 && (
                <>
                  {/* Left eye */}
                  <line
                    x1={face.landmarks[0][0]}
                    y1={face.landmarks[0][1]}
                    x2={face.landmarks[1][0]}
                    y2={face.landmarks[1][1]}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity="0.6"
                  />
                  {/* Right eye */}
                  <line
                    x1={face.landmarks[2][0]}
                    y1={face.landmarks[2][1]}
                    x2={face.landmarks[3][0]}
                    y2={face.landmarks[3][1]}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity="0.6"
                  />
                  {/* Nose */}
                  <line
                    x1={face.landmarks[4][0]}
                    y1={face.landmarks[4][1]}
                    x2={face.landmarks[4][0]}
                    y2={face.landmarks[4][1] + 2}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity="0.6"
                  />
                </>
              )}
            </svg>
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
  }, [getImageUrl, handleFaceClick, handleFaceCheckboxChange, viewMode])

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
            {/* View Mode Indicator */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                View Mode:
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                viewMode === 'normal' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                viewMode === 'segmentation' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
              }`}>
                {viewMode === 'normal' ? 'Normal' : 
                 viewMode === 'segmentation' ? 'Segmentation' : 'Alignments'}
              </span>
            </div>
          </div>

          {/* Face Count */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {faceImages.length} faces loaded
          </div>
        </div>
      </div>

      {/* Face Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
          {faceImages.map((face, index) => renderFaceThumbnail(face, index))}
        </div>
      </div>
    </div>
  )
}

export default OptimizedFaceGrid