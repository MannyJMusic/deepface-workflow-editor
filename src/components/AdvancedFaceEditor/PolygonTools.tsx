import React, { useState, useCallback, useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface Polygon {
  id: string
  points: Point[]
  closed: boolean
}

interface PolygonToolsProps {
  imagePath: string
  initialPolygon?: number[][]
  onPolygonChange: (polygon: number[][]) => void
  width?: number
  height?: number
  eyebrowExpandMod?: number
}

type Tool = 'select' | 'draw' | 'edit' | 'pan' | 'zoom'

const PolygonTools: React.FC<PolygonToolsProps> = ({
  imagePath,
  initialPolygon = [],
  onPolygonChange,
  width = 800,
  height = 600,
  eyebrowExpandMod = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [polygons, setPolygons] = useState<Polygon[]>([])
  const [currentPolygon, setCurrentPolygon] = useState<Polygon | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{ polygonId: string; pointIndex: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [currentTool, setCurrentTool] = useState<Tool>('select')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [canvasSize, setCanvasSize] = useState({ width, height })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState<Point | null>(null)
  const [showEyebrowRegion, setShowEyebrowRegion] = useState(false)

  // Initialize polygon from props
  useEffect(() => {
    if (initialPolygon.length > 0) {
      const points: Point[] = initialPolygon.map(p => ({ x: p[0], y: p[1] }))
      const polygon: Polygon = {
        id: 'main-polygon',
        points,
        closed: true
      }
      setPolygons([polygon])
      setCurrentPolygon(polygon)
    }
  }, [initialPolygon])

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
      
      // Draw polygons
      polygons.forEach((polygon) => {
        if (polygon.points.length < 2) return

        // Draw polygon fill
        ctx.beginPath()
        ctx.moveTo(offset.x + polygon.points[0].x * scale, offset.y + polygon.points[0].y * scale)
        for (let i = 1; i < polygon.points.length; i++) {
          ctx.lineTo(offset.x + polygon.points[i].x * scale, offset.y + polygon.points[i].y * scale)
        }
        if (polygon.closed) {
          ctx.closePath()
        }
        
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'
        ctx.fill()
        
        // Draw polygon outline
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw points
        polygon.points.forEach((point, index) => {
          const x = offset.x + point.x * scale
          const y = offset.y + point.y * scale
          
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, 2 * Math.PI)
          ctx.fillStyle = selectedPoint?.polygonId === polygon.id && selectedPoint?.pointIndex === index 
            ? '#ff6b6b' 
            : '#4ecdc4'
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.stroke()
        })

        // Draw eyebrow region if enabled
        if (showEyebrowRegion && polygon.id === 'main-polygon') {
          drawEyebrowRegion(ctx, polygon)
        }
      })
    }
    img.src = imagePath
  }, [imageLoaded, polygons, selectedPoint, scale, offset, imageSize, showEyebrowRegion, imagePath])

  // Draw eyebrow region visualization
  const drawEyebrowRegion = useCallback((ctx: CanvasRenderingContext2D, polygon: Polygon) => {
    // Find eyebrow points (typically points 17-26 in 68-point landmark model)
    // For now, we'll use a simple heuristic to find eyebrow-like points
    const eyebrowPoints = polygon.points.filter((_, index) => {
      // This is a simplified approach - in reality you'd use landmark indices
      return index >= 17 && index <= 26
    })

    if (eyebrowPoints.length > 0) {
      // Draw expanded eyebrow region
      const expandedPoints = eyebrowPoints.map(point => ({
        x: point.x,
        y: point.y - (eyebrowExpandMod * 10) // Expand upward
      }))

      ctx.beginPath()
      ctx.moveTo(offset.x + expandedPoints[0].x * scale, offset.y + expandedPoints[0].y * scale)
      for (let i = 1; i < expandedPoints.length; i++) {
        ctx.lineTo(offset.x + expandedPoints[i].x * scale, offset.y + expandedPoints[i].y * scale)
      }
      ctx.closePath()
      
      ctx.fillStyle = 'rgba(255, 165, 0, 0.2)'
      ctx.fill()
      ctx.strokeStyle = '#ffa500'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [scale, offset, eyebrowExpandMod])

  // Redraw when polygons change
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

    if (currentTool === 'pan') {
      setPanStart({ x: canvasX, y: canvasY })
      return
    }

    if (currentTool === 'draw') {
      if (!isDrawing) {
        // Start new polygon
        const newPolygon: Polygon = {
          id: `polygon-${Date.now()}`,
          points: [imageCoords],
          closed: false
        }
        setCurrentPolygon(newPolygon)
        setIsDrawing(true)
      } else {
        // Add point to current polygon
        if (currentPolygon) {
          const newPolygon = {
            ...currentPolygon,
            points: [...currentPolygon.points, imageCoords]
          }
          setCurrentPolygon(newPolygon)
        }
      }
      return
    }

    if (currentTool === 'select' || currentTool === 'edit') {
      // Check if clicking on existing point
      let clickedPoint: { polygonId: string; pointIndex: number } | null = null
      
      polygons.forEach(polygon => {
        polygon.points.forEach((point, index) => {
          const canvasCoords = imageToCanvas(point.x, point.y)
          const distance = Math.sqrt(
            Math.pow(canvasX - canvasCoords.x, 2) + Math.pow(canvasY - canvasCoords.y, 2)
          )
          if (distance <= 8) {
            clickedPoint = { polygonId: polygon.id, pointIndex: index }
          }
        })
      })

      if (clickedPoint) {
        setSelectedPoint(clickedPoint)
        setIsDragging(true)
        const polygon = polygons.find(p => p.id === clickedPoint!.polygonId)
        if (polygon) {
          const canvasCoords = imageToCanvas(polygon.points[clickedPoint!.pointIndex].x, polygon.points[clickedPoint!.pointIndex].y)
          setDragOffset({
            x: canvasX - canvasCoords.x,
            y: canvasY - canvasCoords.y
          })
        }
      } else {
        setSelectedPoint(null)
      }
    }
  }, [currentTool, isDrawing, currentPolygon, polygons, canvasToImage, imageToCanvas])

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    if (currentTool === 'pan' && panStart) {
      const deltaX = canvasX - panStart.x
      const deltaY = canvasY - panStart.y
      setOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      setPanStart({ x: canvasX, y: canvasY })
      return
    }

    if (isDragging && selectedPoint) {
      const imageCoords = canvasToImage(canvasX - dragOffset.x, canvasY - dragOffset.y)
      
      const newPolygons = polygons.map(polygon => {
        if (polygon.id === selectedPoint.polygonId) {
          const newPoints = [...polygon.points]
          newPoints[selectedPoint.pointIndex] = imageCoords
          return { ...polygon, points: newPoints }
        }
        return polygon
      })
      
      setPolygons(newPolygons)
      
      // Notify parent
      const mainPolygon = newPolygons.find(p => p.id === 'main-polygon')
      if (mainPolygon) {
        const polygonArray = mainPolygon.points.map(p => [p.x, p.y])
        onPolygonChange(polygonArray)
      }
    }
  }, [currentTool, panStart, isDragging, selectedPoint, dragOffset, polygons, canvasToImage, onPolygonChange])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragOffset({ x: 0, y: 0 })
    setPanStart(null)
  }, [])

  // Handle double click to close polygon
  const handleDoubleClick = useCallback(() => {
    if (currentTool === 'draw' && isDrawing && currentPolygon) {
      const closedPolygon = { ...currentPolygon, closed: true }
      setPolygons(prev => [...prev, closedPolygon])
      setCurrentPolygon(null)
      setIsDrawing(false)
      
      // Notify parent
      const polygonArray = closedPolygon.points.map(p => [p.x, p.y])
      onPolygonChange(polygonArray)
    }
  }, [currentTool, isDrawing, currentPolygon, onPolygonChange])

  // Smooth polygon
  const smoothPolygon = useCallback(() => {
    if (!selectedPoint) return

    const polygon = polygons.find(p => p.id === selectedPoint.polygonId)
    if (!polygon || polygon.points.length < 3) return

    // Simple smoothing algorithm
    const smoothedPoints = polygon.points.map((point, index) => {
      if (index === 0 || index === polygon.points.length - 1) {
        return point
      }
      
      const prev = polygon.points[index - 1]
      const next = polygon.points[index + 1]
      
      return {
        x: (prev.x + point.x + next.x) / 3,
        y: (prev.y + point.y + next.y) / 3
      }
    })

    const smoothedPolygon = { ...polygon, points: smoothedPoints }
    const newPolygons = polygons.map(p => p.id === polygon.id ? smoothedPolygon : p)
    setPolygons(newPolygons)

    // Notify parent
    const polygonArray = smoothedPolygon.points.map(p => [p.x, p.y])
    onPolygonChange(polygonArray)
  }, [selectedPoint, polygons, onPolygonChange])

  // Add point to polygon
  const addPointToPolygon = useCallback(() => {
    if (!selectedPoint) return

    const polygon = polygons.find(p => p.id === selectedPoint.polygonId)
    if (!polygon) return

    const pointIndex = selectedPoint.pointIndex
    const prevPoint = polygon.points[pointIndex]
    const nextPoint = polygon.points[pointIndex + 1] || polygon.points[0]
    
    const newPoint = {
      x: (prevPoint.x + nextPoint.x) / 2,
      y: (prevPoint.y + nextPoint.y) / 2
    }

    const newPoints = [...polygon.points]
    newPoints.splice(pointIndex + 1, 0, newPoint)
    
    const newPolygon = { ...polygon, points: newPoints }
    const newPolygons = polygons.map(p => p.id === polygon.id ? newPolygon : p)
    setPolygons(newPolygons)

    // Notify parent
    const polygonArray = newPolygon.points.map(p => [p.x, p.y])
    onPolygonChange(polygonArray)
  }, [selectedPoint, polygons, onPolygonChange])

  // Remove point from polygon
  const removePointFromPolygon = useCallback(() => {
    if (!selectedPoint) return

    const polygon = polygons.find(p => p.id === selectedPoint.polygonId)
    if (!polygon || polygon.points.length <= 3) return

    const newPoints = polygon.points.filter((_, index) => index !== selectedPoint.pointIndex)
    const newPolygon = { ...polygon, points: newPoints }
    const newPolygons = polygons.map(p => p.id === polygon.id ? newPolygon : p)
    setPolygons(newPolygons)

    setSelectedPoint(null)

    // Notify parent
    const polygonArray = newPolygon.points.map(p => [p.x, p.y])
    onPolygonChange(polygonArray)
  }, [selectedPoint, polygons, onPolygonChange])

  // Clear all polygons
  const clearPolygons = useCallback(() => {
    setPolygons([])
    setCurrentPolygon(null)
    setSelectedPoint(null)
    onPolygonChange([])
  }, [onPolygonChange])

  // Reset polygon to initial state
  const resetPolygon = useCallback(() => {
    if (initialPolygon.length > 0) {
      const points: Point[] = initialPolygon.map(p => ({ x: p[0], y: p[1] }))
      const polygon: Polygon = {
        id: 'main-polygon',
        points,
        closed: true
      }
      setPolygons([polygon])
      setCurrentPolygon(polygon)
      setSelectedPoint(null)
      
      const polygonArray = polygon.points.map(p => [p.x, p.y])
      onPolygonChange(polygonArray)
    }
  }, [initialPolygon, onPolygonChange])

  return (
    <div className="flex flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {/* Tool Selection */}
        <div className="flex items-center space-x-1">
          {(['select', 'draw', 'edit', 'pan'] as Tool[]).map(tool => (
            <button
              key={tool}
              onClick={() => setCurrentTool(tool)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors duration-200 ${
                currentTool === tool
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
              title={`${tool.charAt(0).toUpperCase() + tool.slice(1)} tool`}
            >
              {tool === 'select' ? '↖' : 
               tool === 'draw' ? '✏' : 
               tool === 'edit' ? '✎' : 
               tool === 'pan' ? '✋' : tool}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={smoothPolygon}
            disabled={!selectedPoint}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            title="Smooth selected polygon"
          >
            Smooth
          </button>
          <button
            onClick={addPointToPolygon}
            disabled={!selectedPoint}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            title="Add point to polygon"
          >
            Add Point
          </button>
          <button
            onClick={removePointFromPolygon}
            disabled={!selectedPoint}
            className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            title="Remove selected point"
          >
            Remove Point
          </button>
        </div>

        {/* Utility Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={clearPolygons}
            className="px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors duration-200"
            title="Clear all polygons"
          >
            Clear All
          </button>
          <button
            onClick={resetPolygon}
            className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors duration-200"
            title="Reset to original polygon"
          >
            Reset
          </button>
        </div>

        {/* Eyebrow Region Toggle */}
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={showEyebrowRegion}
              onChange={(e) => setShowEyebrowRegion(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Eyebrow Region</span>
          </label>
        </div>

        <div className="flex-1"></div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {polygons.reduce((total, polygon) => total + polygon.points.length, 0)} points
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className={`cursor-${currentTool === 'pan' ? 'grab' : currentTool === 'draw' ? 'crosshair' : 'default'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
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
          <p>• <strong>Select:</strong> Click and drag points to move them</p>
          <p>• <strong>Draw:</strong> Click to add points, double-click to close polygon</p>
          <p>• <strong>Edit:</strong> Select points and use action buttons</p>
          <p>• <strong>Pan:</strong> Click and drag to move the view</p>
          <p>• Use Smooth to reduce polygon complexity</p>
          <p>• Use Add/Remove Point to modify polygon detail</p>
        </div>
      </div>
    </div>
  )
}

export default PolygonTools

