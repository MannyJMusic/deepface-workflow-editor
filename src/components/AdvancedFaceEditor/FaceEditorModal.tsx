import React, { useState, useCallback, useRef } from 'react'

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
  onClose: () => void
  onUpdateFace: (faceId: string, updates: Partial<FaceImage>) => void
}

const FaceEditorModal: React.FC<FaceEditorModalProps> = ({
  faceImage,
  onClose,
  onUpdateFace
}) => {
  const [viewMode, setViewMode] = useState<'landmarks' | 'segmentation'>('segmentation')
  const [brushSize, setBrushSize] = useState(5)
  const [opacity, setOpacity] = useState(0.5)
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser'>('brush')
  const [showGeneratedMask, setShowGeneratedMask] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleToolChange = useCallback((tool: 'brush' | 'eraser') => {
    setCurrentTool(tool)
  }, [])

  const handleBrushSizeChange = useCallback((size: number) => {
    setBrushSize(size)
  }, [])

  const handleOpacityChange = useCallback((opacity: number) => {
    setOpacity(opacity)
  }, [])

  const handleGenerateMask = useCallback(() => {
    if (!faceImage) return
    
    // Simulate mask generation
    const mockPolygon = [
      [20, 20], [80, 20], [80, 80], [20, 80]
    ]
    
    onUpdateFace(faceImage.id, {
      segmentationPolygon: mockPolygon
    })
  }, [faceImage, onUpdateFace])

  const handleReset = useCallback(() => {
    if (!faceImage) return
    
    onUpdateFace(faceImage.id, {
      segmentationPolygon: undefined
    })
  }, [faceImage, onUpdateFace])

  const handleCopy = useCallback(() => {
    // Copy current segmentation data
    console.log('Copy segmentation data')
  }, [])

  const handlePaste = useCallback(() => {
    // Paste segmentation data
    console.log('Paste segmentation data')
  }, [])

  const handlePrevious = useCallback(() => {
    // Navigate to previous face
    console.log('Previous face')
  }, [])

  const handleNext = useCallback(() => {
    // Navigate to next face
    console.log('Next face')
  }, [])

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
          {/* Image Canvas */}
          <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="relative">
              {/* Main Image */}
              <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                {faceImage.thumbnailUrl ? (
                  <img
                    src={faceImage.thumbnailUrl}
                    alt={faceImage.filename}
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: '500px' }}
                  />
                ) : (
                  <div className="w-96 h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    {faceImage.filename}
                  </div>
                )}

                {/* Segmentation Overlay */}
                {viewMode === 'segmentation' && faceImage.segmentationPolygon && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points={faceImage.segmentationPolygon.map(point => `${point[0]},${point[1]}`).join(' ')}
                      fill="rgba(0, 255, 0, 0.3)"
                      stroke="#00ff00"
                      strokeWidth="0.5"
                    />
                  </svg>
                )}

                {/* Landmarks Overlay */}
                {viewMode === 'landmarks' && faceImage.landmarks && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {faceImage.landmarks.map((landmark, index) => (
                      <circle
                        key={`landmark-${index}-${landmark[0]}-${landmark[1]}`}
                        cx={landmark[0]}
                        cy={landmark[1]}
                        r="1"
                        fill="#ff0000"
                        opacity="0.8"
                      />
                    ))}
                  </svg>
                )}

                {/* Drawing Canvas */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full cursor-crosshair"
                  style={{ opacity: opacity }}
                />
              </div>
            </div>
          </div>

          {/* Tools Panel */}
          <div className="w-80 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 space-y-6 transition-colors duration-300">
            {/* Tools */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                Tools
              </h4>

              {/* Opacity Slider */}
              <div className="space-y-2">
                <label htmlFor="opacity-slider" className="block text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                  Opacity: {Math.round(opacity * 100)}%
                </label>
                <input
                  id="opacity-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(Number.parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer transition-colors duration-200"
                />
              </div>

              {/* Brush Size Slider */}
              <div className="space-y-2">
                <label htmlFor="brush-size-slider" className="block text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                  Brush Size: {brushSize}px
                </label>
                <input
                  id="brush-size-slider"
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => handleBrushSizeChange(Number.parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer transition-colors duration-200"
                />
              </div>

              {/* Tool Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToolChange('brush')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    currentTool === 'brush'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  ✏️ Brush
                </button>
                <button
                  onClick={() => handleToolChange('eraser')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    currentTool === 'eraser'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  🗑️ Eraser
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200">
                  ↩️ Undo
                </button>
                <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200">
                  ↪️ Redo
                </button>
              </div>
            </div>

            {/* Segmentation Controls */}
            {viewMode === 'segmentation' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                  Segmentation
                </h4>

                <button
                  onClick={handleGenerateMask}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
                >
                  Load BiSeNet Model
                </button>

                <button
                  onClick={handleGenerateMask}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
                >
                  Generate Mask
                </button>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showGeneratedMask}
                    onChange={(e) => setShowGeneratedMask(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 transition-colors duration-200"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    Show Generated Mask
                  </span>
                </label>
              </div>
            )}

            {/* Landmarks Controls */}
            {viewMode === 'landmarks' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
                  Landmarks
                </h4>

                <div className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                  <p>Using 2D Landmarks</p>
                  <p className="text-xs mt-1">Landmark Model: dlib</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={true}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 transition-colors duration-200"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                      Show Landmarks
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
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
            <button
              onClick={handleReset}
              className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
            >
              Reset
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Copy
            </button>
            <button
              onClick={handlePaste}
              className="px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
            >
              Paste
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FaceEditorModal
