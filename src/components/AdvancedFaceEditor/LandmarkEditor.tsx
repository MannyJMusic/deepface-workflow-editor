import React, { useState, useCallback, useRef, useEffect } from 'react'

interface Landmark {
  id: string
  x: number
  y: number
  index: number
}

interface LandmarkEditorProps {
  imagePath: string
  initialLandmarks?: number[][]
  onLandmarksChange: (landmarks: number[][]) => void
  width?: number
  height?: number
  showIndices?: boolean
  showLandmarks?: boolean
  selectedRegions?: {
    all: boolean
    outer: boolean
    leftEyebrow: boolean
    leftEye: boolean
    rightEyebrow: boolean
    rightEye: boolean
    nose: boolean
    mouth: boolean
  }
  opacity?: number
}

const LandmarkEditor: React.FC<LandmarkEditorProps> = ({
  imagePath,
  initialLandmarks = [],
  onLandmarksChange,
  width = 800,
  height = 600,
  showIndices = false,
  showLandmarks = true,
  selectedRegions = {
    all: true,
    outer: true,
    leftEyebrow: true,
    leftEye: true,
    rightEyebrow: true,
    rightEye: true,
    nose: true,
    mouth: true
  },
  opacity = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [selectedLandmark, setSelectedLandmark] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [canvasSize] = useState({ width, height })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Check if landmark is in selected region (68-point landmark model)
  const isLandmarkInSelectedRegion = useCallback((index: number) => {
    if (selectedRegions.all) return true
    
    // 68-point landmark regions
    const regions = {
      outer: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], // Jaw line
      leftEyebrow: [17, 18, 19, 20, 21], // Left eyebrow
      rightEyebrow: [22, 23, 24, 25, 26], // Right eyebrow
      nose: [27, 28, 29, 30, 31, 32, 33, 34, 35], // Nose
      leftEye: [36, 37, 38, 39, 40, 41], // Left eye
      rightEye: [42, 43, 44, 45, 46, 47], // Right eye
      mouth: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67] // Mouth
    }
    
    if (selectedRegions.outer && regions.outer.includes(index)) return true
    if (selectedRegions.leftEyebrow && regions.leftEyebrow.includes(index)) return true
    if (selectedRegions.rightEyebrow && regions.rightEyebrow.includes(index)) return true
    if (selectedRegions.nose && regions.nose.includes(index)) return true
    if (selectedRegions.leftEye && regions.leftEye.includes(index)) return true
    if (selectedRegions.rightEye && regions.rightEye.includes(index)) return true
    if (selectedRegions.mouth && regions.mouth.includes(index)) return true
    
    return false
  }, [selectedRegions])

  // Initialize landmarks from props
  useEffect(() => {
    if (initialLandmarks.length > 0) {
      const newLandmarks: Landmark[] = initialLandmarks.map((landmark, index) => ({
        id: `landmark-${index}`,
        x: landmark[0],
        y: landmark[1],
        index
      }))
      setLandmarks(newLandmarks)
    }
  }, [initialLandmarks])

  // Load and draw image
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height })
      
      // Calculate scale to fit image in canvas
      const scaleX = canvasSize.width / img.width
      const scaleY = canvasSize.height / img.height
      const newScale = Math.min(scaleX, scaleY, 1)
      setScale(newScale)
      
      // Center the image
      const scaledWidth = img.width * newScale
      const scaledHeight = img.height * newScale
      const newOffset = {
        x: (canvasSize.width - scaledWidth) / 2,
        y: (canvasSize.height - scaledHeight) / 2
      }
      setOffset(newOffset)
      
      setImageLoaded(true)
      drawCanvas()
    }
    img.src = imagePath
  }, [imagePath, canvasSize])

  // Draw canvas content
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageLoaded) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw image
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, offset.x, offset.y, imageSize.width * scale, imageSize.height * scale)
      
      // Draw landmarks if enabled
      if (showLandmarks) {
        for (const landmark of landmarks) {
          // Filter landmarks based on selected regions
          if (!isLandmarkInSelectedRegion(landmark.index)) return
          
          const x = offset.x + landmark.x * scale
          const y = offset.y + landmark.y * scale
          
          // Draw landmark circle
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, 2 * Math.PI)
          ctx.fillStyle = selectedLandmark === landmark.id ? '#ff6b6b' : '#4ecdc4'
          ctx.globalAlpha = opacity
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.globalAlpha = 1
          
          // Draw index if enabled
          if (showIndices) {
            ctx.fillStyle = '#ffffff'
            ctx.font = '12px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(landmark.index.toString(), x, y - 10)
          }
        }
      }
    }
    img.src = imagePath
  }, [imageLoaded, landmarks, selectedLandmark, scale, offset, imageSize, showIndices, imagePath, showLandmarks, selectedRegions, opacity, isLandmarkInSelectedRegion])

  // Redraw when landmarks change
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Convert canvas coordinates to image coordinates
  const canvasToImage = useCallback((canvasX: number, canvasY: number) => {
    const imageX = (canvasX - offset.x) / scale
    const imageY = (canvasY - offset.y) / scale
    return { x: imageX, y: imageY }
  }, [offset, scale])

  // Convert image coordinates to canvas coordinates
  const imageToCanvas = useCallback((imageX: number, imageY: number) => {
    const canvasX = offset.x + imageX * scale
    const canvasY = offset.y + imageY * scale
    return { x: canvasX, y: canvasY }
  }, [offset, scale])

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top
    const imageCoords = canvasToImage(canvasX, canvasY)

    // Check if clicking on existing landmark
    const clickedLandmark = landmarks.find(landmark => {
      const canvasCoords = imageToCanvas(landmark.x, landmark.y)
      const distance = Math.sqrt(
        Math.pow(canvasX - canvasCoords.x, 2) + Math.pow(canvasY - canvasCoords.y, 2)
      )
      return distance <= 10
    })

    if (clickedLandmark) {
      // Start dragging existing landmark
      setSelectedLandmark(clickedLandmark.id)
      setIsDragging(true)
      const canvasCoords = imageToCanvas(clickedLandmark.x, clickedLandmark.y)
      setDragOffset({
        x: canvasX - canvasCoords.x,
        y: canvasY - canvasCoords.y
      })
    } else {
      // Add new landmark
      const newLandmark: Landmark = {
        id: `landmark-${Date.now()}`,
        x: imageCoords.x,
        y: imageCoords.y,
        index: landmarks.length
      }
      
      const newLandmarks = [...landmarks, newLandmark]
      setLandmarks(newLandmarks)
      setSelectedLandmark(newLandmark.id)
      
      // Notify parent
      const landmarkArray = newLandmarks.map(l => [l.x, l.y])
      onLandmarksChange(landmarkArray)
    }
  }, [landmarks, canvasToImage, imageToCanvas, onLandmarksChange])

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedLandmark) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top
    const imageCoords = canvasToImage(canvasX - dragOffset.x, canvasY - dragOffset.y)

    // Update landmark position
    const newLandmarks = landmarks.map(landmark => 
      landmark.id === selectedLandmark 
        ? { ...landmark, x: imageCoords.x, y: imageCoords.y }
        : landmark
    )
    setLandmarks(newLandmarks)

    // Notify parent
    const landmarkArray = newLandmarks.map(l => [l.x, l.y])
    onLandmarksChange(landmarkArray)
  }, [isDragging, selectedLandmark, dragOffset, landmarks, canvasToImage, onLandmarksChange])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragOffset({ x: 0, y: 0 })
  }, [])

  // Handle right click to remove landmark
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    if (!selectedLandmark) return

    const newLandmarks = landmarks.filter(landmark => landmark.id !== selectedLandmark)
    setLandmarks(newLandmarks)
    setSelectedLandmark(null)

    // Notify parent
    const landmarkArray = newLandmarks.map(l => [l.x, l.y])
    onLandmarksChange(landmarkArray)
  }, [selectedLandmark, landmarks, onLandmarksChange])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedLandmark) {
        const newLandmarks = landmarks.filter(landmark => landmark.id !== selectedLandmark)
        setLandmarks(newLandmarks)
        setSelectedLandmark(null)

        // Notify parent
        const landmarkArray = newLandmarks.map(l => [l.x, l.y])
        onLandmarksChange(landmarkArray)
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [selectedLandmark, landmarks, onLandmarksChange])

  // Clear all landmarks
  const clearLandmarks = useCallback(() => {
    setLandmarks([])
    setSelectedLandmark(null)
    onLandmarksChange([])
  }, [onLandmarksChange])

  // Reset landmarks to initial state
  const resetLandmarks = useCallback(() => {
    if (initialLandmarks.length > 0) {
      const newLandmarks: Landmark[] = initialLandmarks.map((landmark, index) => ({
        id: `landmark-${index}`,
        x: landmark[0],
        y: landmark[1],
        index
      }))
      setLandmarks(newLandmarks)
      setSelectedLandmark(null)
      
      const landmarkArray = newLandmarks.map(l => [l.x, l.y])
      onLandmarksChange(landmarkArray)
    }
  }, [initialLandmarks, onLandmarksChange])

  return (
    <div className="flex flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          onClick={clearLandmarks}
          className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors duration-200"
          title="Clear all landmarks"
        >
          Clear All
        </button>
        <button
          onClick={resetLandmarks}
          className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors duration-200"
          title="Reset to original landmarks"
        >
          Reset
        </button>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={showIndices}
              onChange={(e) => {
                // This would be handled by parent component
                console.log('Toggle indices:', e.target.checked)
              }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show Indices</span>
          </label>
        </div>
        <div className="flex-1"></div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {landmarks.length} landmarks
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
        
        {/* Instructions overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading image...</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
        <div className="space-y-1">
          <p><strong>Instructions:</strong></p>
          <p>• Click to add a new landmark</p>
          <p>• Drag existing landmarks to move them</p>
          <p>• Right-click or press Delete to remove a landmark</p>
          <p>• Use Clear All to remove all landmarks</p>
          <p>• Use Reset to restore original landmarks</p>
        </div>
      </div>
    </div>
  )
}

export default LandmarkEditor
