import React, { useState, useCallback } from 'react'

interface FaceImage {
  id: string
  filename: string
  filePath: string
  thumbnailUrl?: string | null
  segmentationPolygon?: any
  landmarks?: any
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

const FaceGrid: React.FC<FaceGridProps> = ({
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

  // Debug logging
  React.useEffect(() => {
    console.log('FaceGrid received faceImages:', faceImages)
    console.log('FaceGrid nodeId:', nodeId)
    console.log('FaceGrid inputDir:', inputDir)
    if (faceImages.length > 0) {
      console.log('First face image:', faceImages[0])
      console.log('First face filePath:', faceImages[0].filePath)
    }
  }, [faceImages, nodeId, inputDir])

  const handleFaceClick = useCallback((faceId: string) => {
    onFaceSelect(faceId)
  }, [onFaceSelect])

  const handleFaceCheckboxChange = useCallback((faceId: string, checked: boolean) => {
    onFaceMultiSelect(faceId, checked)
  }, [onFaceMultiSelect])

  const renderFaceThumbnail = (face: FaceImage) => {
    const size = 120 // Fixed size for consistent thumbnails
    
    // Generate the image URL
    const imageUrl = getImageUrl(face.filename)
    
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

          {/* View Mode Overlays */}
          {viewMode === 'segmentation' && face.segmentationPolygon && (
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

          {viewMode === 'alignments' && face.landmarks && (
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full">
                {face.landmarks.map((landmark: any, index: number) => (
                  <circle
                    key={index}
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
                  viewMode === 'normal' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                  viewMode === 'segmentation' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                  'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                }`}>
                  {viewMode === 'normal' ? 'Normal' : 
                   viewMode === 'segmentation' ? 'Segmentation' : 'Alignments'}
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
            {loading && faceImages.length > 0 && (
              <span className="ml-2 text-blue-500">(loading more...)</span>
            )}
          </div>
        </div>
      </div>

      {/* Face Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
          {faceImages.map(renderFaceThumbnail)}
        </div>
      </div>
    </div>
  )
}

export default FaceGrid

