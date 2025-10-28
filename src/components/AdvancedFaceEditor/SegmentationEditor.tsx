/**
 * Segmentation Editor Component
 * Canvas-based editor for face segmentation polygons using fabric.js
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, Image, Polygon, Group, IEvent } from 'fabric'
import {
  createCanvas,
  addImageToCanvas,
  createPolygon,
  updatePolygonPoints,
  addPointToPolygon,
  removePointFromPolygon,
  getNormalizedPolygonPoints,
  setPolygonFromNormalized,
  drawLandmarks,
  clearCanvas,
  enablePolygonEditing,
  expandEyebrowRegion,
  PolygonPoint
} from '../../services/fabricCanvas'

interface SegmentationEditorProps {
  imagePath: string
  initialPolygon?: number[][]
  landmarks?: number[][]
  eyebrowExpandMod?: number
  onPolygonChange?: (polygon: number[][]) => void
  onSave?: (polygon: number[][]) => void
  readOnly?: boolean
  width?: number
  height?: number
}

export const SegmentationEditor: React.FC<SegmentationEditorProps> = ({
  imagePath,
  initialPolygon,
  landmarks,
  eyebrowExpandMod = 1,
  onPolygonChange,
  onSave,
  readOnly = false,
  width = 800,
  height = 600
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const polygonRef = useRef<Polygon | null>(null)
  const imageRef = useRef<Image | null>(null)
  const landmarkGroupRef = useRef<Group | null>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<PolygonPoint[]>([])
  const [tool, setTool] = useState<'select' | 'draw' | 'add' | 'remove'>('select')
  const [showLandmarks, setShowLandmarks] = useState(false)
  
  // Eyebrow region visualization
  const [showEyebrowPreview, setShowEyebrowPreview] = useState(false)
  const [currentEyebrowExpandMod, setCurrentEyebrowExpandMod] = useState(eyebrowExpandMod)
  
  // Tool palette state
  const [showGrid, setShowGrid] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [gridSize, setGridSize] = useState(20)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isPanning, setIsPanning] = useState(false)

  // Initialize fabric canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return

    const canvas = createCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#1e1e1e'
    })

    fabricCanvasRef.current = canvas

    // Load image
    if (imagePath) {
      loadImage()
    }

    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [])

  // Load image onto canvas
  const loadImage = useCallback(async () => {
    if (!fabricCanvasRef.current) return

    try {
      const img = await addImageToCanvas(fabricCanvasRef.current, imagePath, {
        crossOrigin: 'anonymous'
      })
      imageRef.current = img

      // Load initial polygon if provided
      if (initialPolygon && initialPolygon.length > 0) {
        const imageWidth = img.width! * img.scaleX!
        const imageHeight = img.height! * img.scaleY!

        const polygon = setPolygonFromNormalized(
          fabricCanvasRef.current,
          initialPolygon,
          imageWidth,
          imageHeight,
          { selectable: !readOnly, evented: !readOnly }
        )

        polygonRef.current = polygon

        if (!readOnly) {
          enablePolygonEditing(polygon)
        }

        // Listen for polygon modifications
        polygon.on('modified', () => {
          handlePolygonModified()
        })
      }

      // Draw landmarks if provided
      if (landmarks && landmarks.length > 0) {
        drawLandmarksOnCanvas()
      }
    } catch (error) {
      console.error('Failed to load image:', error)
    }
  }, [imagePath, initialPolygon, landmarks, readOnly])

  // Draw landmarks on canvas
  const drawLandmarksOnCanvas = useCallback(() => {
    if (!fabricCanvasRef.current || !imageRef.current || !landmarks) return

    const imageWidth = imageRef.current.width! * imageRef.current.scaleX!
    const imageHeight = imageRef.current.height! * imageRef.current.scaleY!

    if (landmarkGroupRef.current) {
      fabricCanvasRef.current.remove(landmarkGroupRef.current)
    }

    if (showLandmarks) {
      const group = drawLandmarks(fabricCanvasRef.current, landmarks, imageWidth, imageHeight, {
        color: '#FF5722',
        radius: 2
      })
      landmarkGroupRef.current = group
    }
  }, [landmarks, showLandmarks])

  // Handle polygon modification
  const handlePolygonModified = useCallback(() => {
    if (!polygonRef.current || !imageRef.current) return

    const imageWidth = imageRef.current.width! * imageRef.current.scaleX!
    const imageHeight = imageRef.current.height! * imageRef.current.scaleY!

    const normalizedPoints = getNormalizedPolygonPoints(
      polygonRef.current,
      imageWidth,
      imageHeight
    )

    if (onPolygonChange) {
      onPolygonChange(normalizedPoints)
    }
  }, [onPolygonChange])

  // Handle canvas click for drawing mode
  const handleCanvasClick = useCallback((event: IEvent) => {
    if (tool !== 'draw' || !fabricCanvasRef.current || readOnly) return

    const pointer = fabricCanvasRef.current.getPointer(event.e)
    const newPoint: PolygonPoint = { x: pointer.x, y: pointer.y }

    setDrawPoints(prev => {
      const updated = [...prev, newPoint]

      // If we have at least 3 points, create/update polygon
      if (updated.length >= 3) {
        if (polygonRef.current) {
          fabricCanvasRef.current!.remove(polygonRef.current)
        }

        const polygon = createPolygon(fabricCanvasRef.current!, updated, {
          selectable: false,
          evented: false
        })

        polygonRef.current = polygon
      }

      return updated
    })
  }, [tool, readOnly])

  // Complete drawing
  const completeDrawing = useCallback(() => {
    if (!polygonRef.current || drawPoints.length < 3) return

    // Make polygon editable
    polygonRef.current.set({ selectable: true, evented: true })
    enablePolygonEditing(polygonRef.current)

    // Listen for modifications
    polygonRef.current.on('modified', () => {
      handlePolygonModified()
    })

    setIsDrawing(false)
    setDrawPoints([])
    setTool('select')
    handlePolygonModified()
  }, [drawPoints, handlePolygonModified])

  // Apply eyebrow expansion
  const applyEyebrowExpansion = useCallback(() => {
    if (!polygonRef.current || !imageRef.current || eyebrowExpandMod <= 1) return

    const points = polygonRef.current.points || []
    const imageWidth = imageRef.current.width! * imageRef.current.scaleX!
    const imageHeight = imageRef.current.height! * imageRef.current.scaleY!

    const expandedPoints = expandEyebrowRegion(points, eyebrowExpandMod, imageWidth, imageHeight)
    updatePolygonPoints(polygonRef.current, expandedPoints)
    fabricCanvasRef.current?.renderAll()
    handlePolygonModified()
  }, [eyebrowExpandMod, handlePolygonModified])

  // Handle eyebrow region expansion preview
  const handleEyebrowExpand = useCallback((expandMod: number) => {
    if (!fabricCanvasRef.current || !landmarks || landmarks.length < 68) return
    
    setCurrentEyebrowExpandMod(expandMod)
    
    // Find eyebrow landmarks (typically points 17-26 for left eyebrow, 22-26 for right eyebrow)
    const leftEyebrow = landmarks.slice(17, 22) // Left eyebrow
    const rightEyebrow = landmarks.slice(22, 27) // Right eyebrow
    
    // Create expanded eyebrow region
    const expandedRegion = expandEyebrowRegion(leftEyebrow.concat(rightEyebrow), expandMod)
    
    // Create preview polygon for eyebrow region
    if (fabricCanvasRef.current) {
      const imageWidth = imageRef.current?.width! * imageRef.current?.scaleX!
      const imageHeight = imageRef.current?.height! * imageRef.current?.scaleY!
      
      const eyebrowPolygon = createPolygon(fabricCanvasRef.current, expandedRegion, {
        fill: 'rgba(255, 255, 0, 0.3)',
        stroke: '#ffff00',
        strokeWidth: 2,
        selectable: false,
        evented: false
      })
      
      // Remove existing eyebrow preview
      const existingPreview = fabricCanvasRef.current.getObjects().find(obj => 
        obj.name === 'eyebrow-preview'
      )
      if (existingPreview) {
        fabricCanvasRef.current.remove(existingPreview)
      }
      
      // Add new preview
      eyebrowPolygon.name = 'eyebrow-preview'
      fabricCanvasRef.current.add(eyebrowPolygon)
      fabricCanvasRef.current.renderAll()
    }
  }, [landmarks])

  // Toggle eyebrow preview
  const toggleEyebrowPreview = useCallback(() => {
    if (!showEyebrowPreview) {
      handleEyebrowExpand(currentEyebrowExpandMod)
    } else {
      // Remove eyebrow preview
      if (fabricCanvasRef.current) {
        const existingPreview = fabricCanvasRef.current.getObjects().find(obj => 
          obj.name === 'eyebrow-preview'
        )
        if (existingPreview) {
          fabricCanvasRef.current.remove(existingPreview)
          fabricCanvasRef.current.renderAll()
        }
      }
    }
    setShowEyebrowPreview(!showEyebrowPreview)
  }, [showEyebrowPreview, currentEyebrowExpandMod, handleEyebrowExpand])

  // Reset polygon to initial
  const resetPolygon = useCallback(() => {
    if (!fabricCanvasRef.current || !imageRef.current || !initialPolygon) return

    if (polygonRef.current) {
      fabricCanvasRef.current.remove(polygonRef.current)
    }

    const imageWidth = imageRef.current.width! * imageRef.current.scaleX!
    const imageHeight = imageRef.current.height! * imageRef.current.scaleY!

    const polygon = setPolygonFromNormalized(
      fabricCanvasRef.current,
      initialPolygon,
      imageWidth,
      imageHeight,
      { selectable: !readOnly, evented: !readOnly }
    )

    polygonRef.current = polygon

    if (!readOnly) {
      enablePolygonEditing(polygon)
    }

    polygon.on('modified', () => {
      handlePolygonModified()
    })

    handlePolygonModified()
  }, [initialPolygon, readOnly, handlePolygonModified])

  // Save current polygon
  const handleSave = useCallback(() => {
    if (!polygonRef.current || !imageRef.current || !onSave) return

    const imageWidth = imageRef.current.width! * imageRef.current.scaleX!
    const imageHeight = imageRef.current.height! * imageRef.current.scaleY!

    const normalizedPoints = getNormalizedPolygonPoints(
      polygonRef.current,
      imageWidth,
      imageHeight
    )

    onSave(normalizedPoints)
  }, [onSave])

  // Set up canvas event listeners
  useEffect(() => {
    if (!fabricCanvasRef.current) return

    const canvas = fabricCanvasRef.current

    canvas.on('mouse:down', handleCanvasClick)

    return () => {
      canvas.off('mouse:down', handleCanvasClick)
    }
  }, [handleCanvasClick])

  // Update landmarks visibility
  useEffect(() => {
    drawLandmarksOnCanvas()
  }, [showLandmarks, drawLandmarksOnCanvas])

  return (
    <div className="segmentation-editor">
      <div className="editor-toolbar bg-gray-800 p-2 flex gap-2 items-center">
        <button
          className={`px-3 py-1 rounded ${tool === 'select' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setTool('select')}
          disabled={readOnly}
        >
          Select
        </button>
        <button
          className={`px-3 py-1 rounded ${tool === 'draw' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setTool('draw')}
          disabled={readOnly}
        >
          Draw
        </button>
        {tool === 'draw' && drawPoints.length >= 3 && (
          <button
            className="px-3 py-1 rounded bg-green-600"
            onClick={completeDrawing}
          >
            Complete
          </button>
        )}
        <div className="border-l border-gray-600 h-6 mx-2" />
        <button
          className="px-3 py-1 rounded bg-gray-700"
          onClick={resetPolygon}
          disabled={readOnly || !initialPolygon}
        >
          Reset
        </button>
        <button
          className="px-3 py-1 rounded bg-purple-600"
          onClick={applyEyebrowExpansion}
          disabled={readOnly || eyebrowExpandMod <= 1}
        >
          Apply Eyebrow Expansion ({eyebrowExpandMod}x)
        </button>
        
        {/* Eyebrow Preview Controls */}
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 rounded ${showEyebrowPreview ? 'bg-yellow-600' : 'bg-gray-700'}`}
            onClick={toggleEyebrowPreview}
            disabled={!landmarks || landmarks.length < 68}
          >
            {showEyebrowPreview ? 'Hide' : 'Show'} Eyebrow Preview
          </button>
          {showEyebrowPreview && (
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Expand:</label>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={currentEyebrowExpandMod}
                onChange={(e) => handleEyebrowExpand(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-white text-sm">{currentEyebrowExpandMod.toFixed(1)}x</span>
            </div>
          )}
        </div>
        
        <div className="border-l border-gray-600 h-6 mx-2" />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLandmarks}
            onChange={(e) => setShowLandmarks(e.target.checked)}
          />
          <span className="text-sm">Show Landmarks</span>
        </label>
        
        {/* Tool Palette Controls */}
        <div className="border-l border-gray-600 h-6 mx-2" />
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 rounded ${isPanning ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setIsPanning(!isPanning)}
          >
            Pan
          </button>
          <div className="flex items-center gap-2">
            <label className="text-white text-sm">Zoom:</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-white text-sm">{Math.round(zoomLevel * 100)}%</span>
          </div>
        </div>
        
        <div className="border-l border-gray-600 h-6 mx-2" />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            <span className="text-white text-sm">Grid</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              disabled={!showGrid}
            />
            <span className="text-white text-sm">Snap</span>
          </label>
          {showGrid && (
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Size:</label>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="w-16"
              />
              <span className="text-white text-sm">{gridSize}px</span>
            </div>
          )}
        </div>
        
        <div className="ml-auto flex gap-2">
          <button
            className="px-4 py-1 rounded bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={readOnly}
          >
            Save
          </button>
        </div>
      </div>

      <div className="canvas-container bg-gray-900 flex items-center justify-center" style={{ height: height + 40 }}>
        <canvas ref={canvasRef} />
      </div>

      {tool === 'draw' && (
        <div className="editor-help bg-gray-800 p-2 text-sm text-gray-300">
          Click to add points. Need at least 3 points to create a polygon. Click "Complete" when done.
        </div>
      )}
    </div>
  )
}

export default SegmentationEditor
