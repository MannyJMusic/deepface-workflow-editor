import React, { useState, useCallback, useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface Polygon {
  id: string
  points: Point[]
  isClosed: boolean
  isSelected: boolean
}

interface PolygonToolsProps {
  imagePath: string
  initialPolygons?: number[][][]
  onPolygonsChange: (polygons: number[][][]) => void
  width?: number
  height?: number
  showGrid?: boolean
  snapToGrid?: boolean
  gridSize?: number
}

const PolygonTools: React.FC<PolygonToolsProps> = ({
  imagePath,
  initialPolygons = [],
  onPolygonsChange,
  width = 800,
  height = 600,
  showGrid = true,
  snapToGrid = false,
  gridSize = 20
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [polygons, setPolygons] = useState<Polygon[]>([])
  const [currentPolygon, setCurrentPolygon] = useState<Polygon | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedPolygon, setSelectedPolygon] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{ polygonId: string; pointIndex: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [canvasSize] = useState({ width, height })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [tool, setTool] = useState<'draw' | 'edit' | 'delete'>('draw')

  // Initialize polygons from props
  useEffect(() => {
    if (initialPolygons.length > 0) {
      const newPolygons: Polygon[] = initialPolygons.map((polygon, index) => ({
        id: `polygon-${index}`,
        points: polygon.map(point => ({ x: point[0], y: point[1] })),
        isClosed: true,
        isSelected: false
      }))
      setPolygons(newPolygons)
    }
  }, [initialPolygons])

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
      
      // Draw grid if enabled
      if (showGrid) {
        drawGrid(ctx)
      }
      
      // Draw polygons
      for (const polygon of polygons) {
        drawPolygon(ctx, polygon)
      }
      
      // Draw current polygon being drawn
      if (currentPolygon && currentPolygon.points.length > 0) {
        drawCurrentPolygon(ctx, currentPolygon)
      }
    }
    img.src = imagePath
  }, [imageLoaded, polygons, currentPolygon, scale, offset, imageSize, showGrid, imagePath])

  // Draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)'
    ctx.lineWidth = 1
    
    const scaledGridSize = gridSize * scale
    
    // Vertical lines
    for (let x = offset.x; x <= offset.x + imageSize.width * scale; x += scaledGridSize) {
      ctx.beginPath()
      ctx.moveTo(x, offset.y)
      ctx.lineTo(x, offset.y + imageSize.height * scale)
      ctx.stroke()
    }
    
    // Horizontal lines
    for (let y = offset.y; y <= offset.y + imageSize.height * scale; y += scaledGridSize) {
      ctx.beginPath()
      ctx.moveTo(offset.x, y)
      ctx.lineTo(offset.x + imageSize.width * scale, y)
      ctx.stroke()
    }
  }, [offset, scale, imageSize, gridSize])

  // Draw a polygon
  const drawPolygon = useCallback((ctx: CanvasRenderingContext2D, polygon: Polygon) => {
    if (polygon.points.length < 2) return

    ctx.beginPath()
    const startPoint = imageToCanvas(polygon.points[0].x, polygon.points[0].y)
    ctx.moveTo(startPoint.x, startPoint.y)

    for (let i = 1; i < polygon.points.length; i++) {
      const point = imageToCanvas(polygon.points[i].x, polygon.points[i].y)
      ctx.lineTo(point.x, point.y)
    }

    if (polygon.isClosed) {
      ctx.closePath()
    }

    // Fill polygon
    ctx.fillStyle = polygon.isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)'
    ctx.fill()

    // Stroke polygon
    ctx.strokeStyle = polygon.isSelected ? '#3b82f6' : '#22c55e'
    ctx.lineWidth = 2
    ctx.stroke()

      // Draw points
      for (const point of polygon.points) {
        const canvasPoint = imageToCanvas(point.x, point.y)
        ctx.beginPath()
        ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, 2 * Math.PI)
        ctx.fillStyle = polygon.isSelected ? '#3b82f6' : '#22c55e'
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
  }, [])

  // Draw current polygon being drawn
  const drawCurrentPolygon = useCallback((ctx: CanvasRenderingContext2D, polygon: Polygon) => {
    if (polygon.points.length < 1) return

    ctx.beginPath()
    const startPoint = imageToCanvas(polygon.points[0].x, polygon.points[0].y)
    ctx.moveTo(startPoint.x, startPoint.y)

    for (let i = 1; i < polygon.points.length; i++) {
      const point = imageToCanvas(polygon.points[i].x, polygon.points[i].y)
      ctx.lineTo(point.x, point.y)
    }

    // Stroke current polygon
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])

    // Draw points
    for (const point of polygon.points) {
      const canvasPoint = imageToCanvas(point.x, point.y)
      ctx.beginPath()
      ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, 2 * Math.PI)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [])

  // Redraw when polygons change
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Convert canvas coordinates to image coordinates
  const canvasToImage = useCallback((canvasX: number, canvasY: number) => {
    let imageX = (canvasX - offset.x) / scale
    let imageY = (canvasY - offset.y) / scale

    // Snap to grid if enabled
    if (snapToGrid) {
      imageX = Math.round(imageX / gridSize) * gridSize
      imageY = Math.round(imageY / gridSize) * gridSize
    }

    return { x: imageX, y: imageY }
  }, [offset, scale, snapToGrid, gridSize])

  // Convert image coordinates to canvas coordinates
  const imageToCanvas = useCallback((imageX: number, imageY: number) => {
    const canvasX = offset.x + imageX * scale
    const canvasY = offset.y + imageY * scale
    return { x: canvasX, y: canvasY }
  }, [offset, scale])

  // Snap point to grid
  const snapPoint = useCallback((point: Point): Point => {
    if (!snapToGrid) return point
    
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    }
  }, [snapToGrid, gridSize])

  // Find polygon at coordinates
  const findPolygonAt = useCallback((canvasX: number, canvasY: number) => {
    const imageCoords = canvasToImage(canvasX, canvasY)
    
    for (let i = polygons.length - 1; i >= 0; i--) {
      const polygon = polygons[i]
      if (isPointInPolygon(imageCoords, polygon.points)) {
        return polygon
      }
    }
    return null
  }, [polygons, canvasToImage, isPointInPolygon])

  // Find point at coordinates
  const findPointAt = useCallback((canvasX: number, canvasY: number) => {
    for (const polygon of polygons) {
      for (let i = 0; i < polygon.points.length; i++) {
        const point = polygon.points[i]
        const canvasPoint = imageToCanvas(point.x, point.y)
        const distance = Math.sqrt(
          Math.pow(canvasX - canvasPoint.x, 2) + Math.pow(canvasY - canvasPoint.y, 2)
        )
        if (distance <= 8) {
          return { polygonId: polygon.id, pointIndex: i }
        }
      }
    }
    return null
  }, [polygons, imageToCanvas])

  // Check if point is inside polygon
  const isPointInPolygon = useCallback((point: Point, polygon: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside
      }
    }
    return inside
  }, [])

  // Handle drawing tool mouse down
  const handleDrawMouseDown = useCallback((canvasX: number, canvasY: number) => {
    const imageCoords = canvasToImage(canvasX, canvasY)
    const snappedCoords = snapPoint(imageCoords)

    if (!isDrawing) {
      // Start new polygon
      const newPolygon: Polygon = {
        id: `polygon-${Date.now()}`,
        points: [snappedCoords],
        isClosed: false,
        isSelected: false
      }
      setCurrentPolygon(newPolygon)
      setIsDrawing(true)
    } else if (currentPolygon) {
      // Add point to current polygon
      const newPoints = [...currentPolygon.points, snappedCoords]
      setCurrentPolygon({ ...currentPolygon, points: newPoints })
    }
  }, [isDrawing, currentPolygon, canvasToImage, snapPoint])

  // Handle edit tool mouse down
  const handleEditMouseDown = useCallback((canvasX: number, canvasY: number) => {
    // Check if clicking on a point
    const pointAt = findPointAt(canvasX, canvasY)
    if (pointAt) {
      setSelectedPoint(pointAt)
      setIsDragging(true)
      const polygon = polygons.find(p => p.id === pointAt.polygonId)
      if (polygon) {
        const point = polygon.points[pointAt.pointIndex]
        const canvasPoint = imageToCanvas(point.x, point.y)
        setDragOffset({
          x: canvasX - canvasPoint.x,
          y: canvasY - canvasPoint.y
        })
      }
    } else {
      // Check if clicking on a polygon
      const polygonAt = findPolygonAt(canvasX, canvasY)
      if (polygonAt) {
        // Deselect all polygons
        const newPolygons = polygons.map(p => ({ ...p, isSelected: false }))
        // Select clicked polygon
        const updatedPolygon = { ...polygonAt, isSelected: true }
        const polygonIndex = newPolygons.findIndex(p => p.id === polygonAt.id)
        newPolygons[polygonIndex] = updatedPolygon
        setPolygons(newPolygons)
        setSelectedPolygon(polygonAt.id)
      } else {
        // Deselect all
        const newPolygons = polygons.map(p => ({ ...p, isSelected: false }))
        setPolygons(newPolygons)
        setSelectedPolygon(null)
      }
    }
  }, [findPointAt, findPolygonAt, polygons, imageToCanvas])

  // Handle delete tool mouse down
  const handleDeleteMouseDown = useCallback((canvasX: number, canvasY: number) => {
    const polygonAt = findPolygonAt(canvasX, canvasY)
    if (polygonAt) {
      const newPolygons = polygons.filter(p => p.id !== polygonAt.id)
      setPolygons(newPolygons)
      setSelectedPolygon(null)
      notifyPolygonsChange(newPolygons)
    }
  }, [findPolygonAt, polygons, notifyPolygonsChange])

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    if (tool === 'draw') {
      handleDrawMouseDown(canvasX, canvasY)
    } else if (tool === 'edit') {
      handleEditMouseDown(canvasX, canvasY)
    } else if (tool === 'delete') {
      handleDeleteMouseDown(canvasX, canvasY)
    }
  }, [tool, handleDrawMouseDown, handleEditMouseDown, handleDeleteMouseDown])

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    if (isDragging && selectedPoint) {
      const imageCoords = canvasToImage(canvasX - dragOffset.x, canvasY - dragOffset.y)
      const snappedCoords = snapPoint(imageCoords)

      const newPolygons = polygons.map(polygon => {
        if (polygon.id === selectedPoint.polygonId) {
          const newPoints = [...polygon.points]
          newPoints[selectedPoint.pointIndex] = snappedCoords
          return { ...polygon, points: newPoints }
        }
        return polygon
      })
      setPolygons(newPolygons)
    }
  }, [isDragging, selectedPoint, dragOffset, canvasToImage, snapPoint, polygons])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragOffset({ x: 0, y: 0 })
  }, [])

  // Handle double click to close polygon
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'draw' && currentPolygon && currentPolygon.points.length >= 3) {
      // Close the polygon
      const closedPolygon = { ...currentPolygon, isClosed: true }
      const newPolygons = [...polygons, closedPolygon]
      setPolygons(newPolygons)
      setCurrentPolygon(null)
      setIsDrawing(false)
      notifyPolygonsChange(newPolygons)
    }
  }, [tool, currentPolygon, polygons])

  // Handle right click
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    if (tool === 'draw' && currentPolygon) {
      // Close current polygon
      if (currentPolygon.points.length >= 3) {
        const closedPolygon = { ...currentPolygon, isClosed: true }
        const newPolygons = [...polygons, closedPolygon]
        setPolygons(newPolygons)
        setCurrentPolygon(null)
        setIsDrawing(false)
        notifyPolygonsChange(newPolygons)
      } else {
        // Cancel current polygon
        setCurrentPolygon(null)
        setIsDrawing(false)
      }
    }
  }, [tool, currentPolygon, polygons])

  // Notify parent of polygon changes
  const notifyPolygonsChange = useCallback((newPolygons: Polygon[]) => {
    const polygonArray = newPolygons.map(polygon => 
      polygon.points.map(point => [point.x, point.y])
    )
    onPolygonsChange(polygonArray)
  }, [onPolygonsChange])

  // Smooth polygon
  const smoothPolygon = useCallback((polygonId: string) => {
    const polygon = polygons.find(p => p.id === polygonId)
    if (!polygon || polygon.points.length < 3) return

    // Simple smoothing algorithm
    const smoothedPoints = polygon.points.map((point, index) => {
      const prev = polygon.points[(index - 1 + polygon.points.length) % polygon.points.length]
      const next = polygon.points[(index + 1) % polygon.points.length]
      
      return {
        x: (prev.x + point.x + next.x) / 3,
        y: (prev.y + point.y + next.y) / 3
      }
    })

    const newPolygons = polygons.map(p => 
      p.id === polygonId ? { ...p, points: smoothedPoints } : p
    )
    setPolygons(newPolygons)
    notifyPolygonsChange(newPolygons)
  }, [polygons, notifyPolygonsChange])

  // Clear all polygons
  const clearAllPolygons = useCallback(() => {
    setPolygons([])
    setCurrentPolygon(null)
    setIsDrawing(false)
    setSelectedPolygon(null)
    setSelectedPoint(null)
    onPolygonsChange([])
  }, [onPolygonsChange])

  // Reset polygons to initial state
  const resetPolygons = useCallback(() => {
    if (initialPolygons.length > 0) {
      const newPolygons: Polygon[] = initialPolygons.map((polygon, index) => ({
        id: `polygon-${index}`,
        points: polygon.map(point => ({ x: point[0], y: point[1] })),
        isClosed: true,
        isSelected: false
      }))
      setPolygons(newPolygons)
      setCurrentPolygon(null)
      setIsDrawing(false)
      setSelectedPolygon(null)
      setSelectedPoint(null)
      notifyPolygonsChange(newPolygons)
    }
  }, [initialPolygons, notifyPolygonsChange])

  return (
    <div className="flex flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setTool('draw')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors duration-200 ${
              tool === 'draw' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Draw new polygons"
          >
            Draw
          </button>
          <button
            onClick={() => setTool('edit')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors duration-200 ${
              tool === 'edit' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Edit existing polygons"
          >
            Edit
          </button>
          <button
            onClick={() => setTool('delete')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors duration-200 ${
              tool === 'delete' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Delete polygons"
          >
            Delete
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>

        <button
          onClick={clearAllPolygons}
          className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors duration-200"
          title="Clear all polygons"
        >
          Clear All
        </button>
        <button
          onClick={resetPolygons}
          className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors duration-200"
          title="Reset to original polygons"
        >
          Reset
        </button>

        {selectedPolygon && (
          <button
            onClick={() => smoothPolygon(selectedPolygon)}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors duration-200"
            title="Smooth selected polygon"
          >
            Smooth
          </button>
        )}

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => {
                // This would be handled by parent component
                console.log('Toggle grid:', e.target.checked)
              }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Grid</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => {
                // This would be handled by parent component
                console.log('Toggle snap to grid:', e.target.checked)
              }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Snap</span>
          </label>
        </div>

        <div className="flex-1"></div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {polygons.length} polygons
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className={(() => {
            switch (tool) {
              case 'draw': return 'cursor-crosshair'
              case 'edit': return 'cursor-pointer'
              default: return 'cursor-not-allowed'
            }
          })()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
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
          <p>• <strong>Draw:</strong> Click to add points, double-click or right-click to close polygon</p>
          <p>• <strong>Edit:</strong> Click and drag points to move them, click polygon to select</p>
          <p>• <strong>Delete:</strong> Click polygon to delete it</p>
          <p>• Use Clear All to remove all polygons</p>
          <p>• Use Reset to restore original polygons</p>
          <p>• Use Smooth to smooth selected polygon</p>
        </div>
      </div>
    </div>
  )
}

export default PolygonTools