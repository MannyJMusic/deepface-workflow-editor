/**
 * Segmentation Editor Component
 * Canvas-based editor for face segmentation polygons using fabric.js
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, Image, Polygon, IEvent } from 'fabric'
import {
  createCanvas,
  addImageToCanvas,
  createPolygon,
  updatePolygonPoints,
  getNormalizedPolygonPoints,
  setPolygonFromNormalized,
  enablePolygonEditing,
  expandEyebrowRegion,
  PolygonPoint
} from '../../services/fabricCanvas'

interface SegmentationEditorProps {
  imagePath: string
  initialPolygon?: number[][][] | number[][]
  landmarks?: number[][]
  eyebrowExpandMod?: number
  onPolygonChange?: (polygon: number[][]) => void
  onSave?: (polygon: number[][]) => void
  readOnly?: boolean
  width?: number
  height?: number
  showSegmentation?: boolean
  showLandmarks?: boolean
  opacity?: number
  brushSize?: number
  selectedTool?: 'select' | 'draw' | 'erase' | 'pan' | 'zoom'
  showGrid?: boolean
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
  height = 600,
  showSegmentation = true,
  showLandmarks = true,
  opacity = 1,
  brushSize = 5,
  selectedTool = 'select',
  showGrid = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const polygonRef = useRef<Polygon | null>(null)
  const imageRef = useRef<Image | null>(null)

  const [drawPoints, setDrawPoints] = useState<PolygonPoint[]>([])
  const [tool, setTool] = useState<'select' | 'draw' | 'add' | 'remove' | 'pan' | 'zoom'>(selectedTool || 'select')
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null)
  
  // Eyebrow region visualization
  const [showEyebrowPreview, setShowEyebrowPreview] = useState(false)
  const [currentEyebrowExpandMod, setCurrentEyebrowExpandMod] = useState(eyebrowExpandMod)

  // Load image onto canvas
  const loadImage = useCallback(async () => {
    if (!fabricCanvasRef.current) return

    console.log('SegmentationEditor loading image:', imagePath)
    
    // Test if the image URL is accessible
    try {
      const response = await fetch(imagePath, { method: 'HEAD' })
      console.log('Image URL accessibility test:', {
        url: imagePath,
        status: response.status,
        ok: response.ok
      })
    } catch (error) {
      console.error('Image URL accessibility test failed:', error)
    }
    
    try {
      console.log('SegmentationEditor calling addImageToCanvas...')
      const img = await addImageToCanvas(fabricCanvasRef.current, imagePath, {
        crossOrigin: 'anonymous'
      })
      console.log('SegmentationEditor image loaded successfully:', img)
      imageRef.current = img

      // Load initial polygon if provided
      console.log('SegmentationEditor polygon loading check:', {
        hasInitialPolygon: !!initialPolygon,
        polygonLength: initialPolygon?.length,
        showSegmentation,
        polygonData: initialPolygon
      })
      
      // Note: Segmentation overlays are now handled by SVG overlays in the JSX
      // This matches the approach used in OptimizedFaceGrid.tsx
      console.log('SegmentationEditor - segmentation data available:', {
        hasInitialPolygon: !!initialPolygon,
        polygonLength: initialPolygon?.length,
        showSegmentation,
        polygonData: initialPolygon
      })

      // Note: Landmarks are now handled by SVG overlays in the JSX
      // This matches the approach used in OptimizedFaceGrid.tsx
    } catch (error) {
      console.error('Failed to load image:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        imagePath,
        canvasExists: !!fabricCanvasRef.current,
        canvasDimensions: fabricCanvasRef.current ? {
          width: fabricCanvasRef.current.width,
          height: fabricCanvasRef.current.height
        } : null
      })
    }
  }, [imagePath, initialPolygon, landmarks, readOnly])

  // Initialize fabric canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return

    console.log('SegmentationEditor initializing canvas with dimensions:', { width, height })
    
    const canvas = createCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#1e1e1e'
    })

    fabricCanvasRef.current = canvas
    console.log('SegmentationEditor canvas created:', canvas)

    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [])

  // Load image when imagePath changes
  useEffect(() => {
    if (imagePath && fabricCanvasRef.current) {
      console.log('SegmentationEditor loadImage effect triggered, canvas dimensions:', {
        width: fabricCanvasRef.current.width,
        height: fabricCanvasRef.current.height
      })
      loadImage()
    }
  }, [imagePath, loadImage])

  // Render segmentation polygons on fabric.js canvas
  const renderSegmentationPolygons = useCallback(() => {
    if (!fabricCanvasRef.current || !imageRef.current || !initialPolygon || !showSegmentation) {
      console.log('Segmentation rendering skipped:', {
        hasCanvas: !!fabricCanvasRef.current,
        hasImage: !!imageRef.current,
        hasPolygon: !!initialPolygon,
        showSegmentation
      })
      return
    }

    console.log('Rendering segmentation polygons on fabric.js canvas:', {
      polygonCount: Array.isArray(initialPolygon) ? initialPolygon.length : 1
    })

    // Remove existing segmentation polygons
    const existingPolygons = fabricCanvasRef.current.getObjects().filter(obj => 
      (obj as any).isSegmentationPolygon
    )
    existingPolygons.forEach(poly => fabricCanvasRef.current!.remove(poly))

    if (!Array.isArray(initialPolygon) || initialPolygon.length === 0) return

    // Get image dimensions and position
    const imageWidth = imageRef.current.width! * imageRef.current.scaleX!
    const imageHeight = imageRef.current.height! * imageRef.current.scaleY!
    const imageLeft = imageRef.current.left!
    const imageTop = imageRef.current.top!
    const scale = imageWidth / 640 // Convert from 640x640 to actual image size

    console.log('Creating segmentation polygons with:', {
      imageWidth,
      imageHeight,
      imageLeft,
      imageTop,
      scale,
      polygonCount: initialPolygon.length
    })

    // Render each polygon
    initialPolygon.forEach((polygon, polygonIndex) => {
      if (!polygon || polygon.length === 0) return

      let points: { x: number; y: number }[]

      if (Array.isArray(polygon[0])) {
        // Standard format: [[x, y], [x, y], ...]
        points = (polygon as number[][]).map(point => ({
          x: imageLeft + (point[0] * scale),
          y: imageTop + (point[1] * scale)
        }))
      } else {
        // Flat format: [x, y, x, y, ...]
        points = []
        for (let i = 0; i < polygon.length; i += 2) {
          points.push({
            x: imageLeft + ((polygon as number[])[i] * scale),
            y: imageTop + ((polygon as number[])[i + 1] * scale)
          })
        }
      }

      if (points.length < 3) return // Need at least 3 points for a polygon

      const fabricPolygon = new Polygon(points, {
        fill: 'rgba(0, 255, 0, 0.2)',
        stroke: '#00ff00',
        strokeWidth: 2,
        opacity: opacity,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
        moveCursor: 'default'
      })

      ;(fabricPolygon as any).isSegmentationPolygon = true

      console.log(`Added segmentation polygon ${polygonIndex}:`, {
        pointsCount: points.length,
        firstPoint: points[0],
        lastPoint: points[points.length - 1]
      })

      fabricCanvasRef.current!.add(fabricPolygon)
    })

    fabricCanvasRef.current!.renderAll()
  }, [initialPolygon, showSegmentation, opacity])

  // Trigger polygon rendering when data changes or after a delay to ensure image is loaded
  useEffect(() => {
    renderSegmentationPolygons()
  }, [renderSegmentationPolygons])

  // Also try to render after a delay to catch image loading
  useEffect(() => {
    const timer = setTimeout(() => {
      renderSegmentationPolygons()
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Note: Landmarks are now handled by SVG overlays in the JSX
  // No need for fabric.js landmark drawing

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

  // Handle canvas interactions
  const handleCanvasClick = useCallback((event: IEvent) => {
    if (!fabricCanvasRef.current || readOnly) return

    const pointer = fabricCanvasRef.current.getPointer(event.e)

    if (tool === 'draw') {
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
    } else if (tool === 'pan') {
      setIsPanning(true)
      setLastPanPoint({ x: pointer.x, y: pointer.y })
    }
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

  // Handle mouse move for panning
  const handleMouseMove = useCallback((event: IEvent) => {
    if (!fabricCanvasRef.current || !isPanning || !lastPanPoint) return

    const pointer = fabricCanvasRef.current.getPointer(event.e)
    const deltaX = pointer.x - lastPanPoint.x
    const deltaY = pointer.y - lastPanPoint.y

    fabricCanvasRef.current.viewportTransform![4] += deltaX
    fabricCanvasRef.current.viewportTransform![5] += deltaY
    fabricCanvasRef.current.requestRenderAll()

    setLastPanPoint({ x: pointer.x, y: pointer.y })
  }, [isPanning, lastPanPoint])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      setLastPanPoint(null)
    }
  }, [isPanning])

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    if (!fabricCanvasRef.current) return

    const canvas = fabricCanvasRef.current
    const zoom = canvas.getZoom()
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta))
    
    canvas.setZoom(newZoom)
    canvas.requestRenderAll()
  }, [])

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
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)

    return () => {
      canvas.off('mouse:down', handleCanvasClick)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
    }
  }, [handleCanvasClick, handleMouseMove, handleMouseUp])

  // Note: Landmarks visibility is now handled by SVG overlays in the JSX

  // Update tool when selectedTool prop changes
  useEffect(() => {
    if (selectedTool) {
      setTool(selectedTool)
    }
  }, [selectedTool])

  // Handle keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === '=' || event.key === '+') {
          event.preventDefault()
          handleZoom(0.1)
        } else if (event.key === '-') {
          event.preventDefault()
          handleZoom(-0.1)
        } else if (event.key === '0') {
          event.preventDefault()
          if (fabricCanvasRef.current) {
            fabricCanvasRef.current.setZoom(1)
            fabricCanvasRef.current.requestRenderAll()
          }
        }
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [handleZoom])

  // Update polygon visibility when showSegmentation changes
  useEffect(() => {
    if (polygonRef.current) {
      polygonRef.current.set({ visible: showSegmentation, opacity: opacity })
      fabricCanvasRef.current?.renderAll()
    }
  }, [showSegmentation, opacity])

  // Update brush size when it changes
  useEffect(() => {
    if (polygonRef.current) {
      polygonRef.current.set({ strokeWidth: brushSize })
      fabricCanvasRef.current?.renderAll()
    }
  }, [brushSize])

  return (
    <div className="segmentation-editor">

      <div className="canvas-container bg-gray-900 flex items-center justify-center relative" style={{ height: height + 40 }}>
        <canvas 
          ref={canvasRef} 
          style={{ 
            border: '1px solid #444',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
        
        {/* SVG Overlays for Landmarks Only - Segmentation is now rendered on fabric.js canvas */}

        {/* Landmarks Overlay */}
        {(() => {
          console.log('Landmarks overlay render check:', {
            showLandmarks,
            hasLandmarks: !!landmarks,
            landmarksLength: landmarks?.length,
            hasImageRef: !!imageRef.current
          })
          return showLandmarks && landmarks && landmarks.length > 0
        })() && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10
            }}
          >
            {landmarks.map((landmark, index) => {
              console.log(`Rendering landmark ${index}:`, {
                landmark,
                x: landmark[0],
                y: landmark[1]
              })
              
              // Use the same simple scaling as OptimizedFaceGrid.tsx
              // For DeepFaceLab aligned images, landmarks are in a 640x640 coordinate system
              // Map them to 0-100 SVG coordinates
              const imageSize = 640
              const scale = 100 / imageSize
              
              return (
                <circle
                  key={index}
                  cx={landmark[0] * scale}
                  cy={landmark[1] * scale}
                  r="0.6"
                  fill="#ff0000"
                  opacity={opacity}
                />
              )
            })}
            
            {/* Connect landmarks with lines for facial features */}
            {landmarks.length >= 5 && (() => {
              // Use the same simple scaling as OptimizedFaceGrid.tsx
              const imageSize = 640
              const scale = 100 / imageSize
              
              const convertToSVG = (landmark: number[]) => ({
                x: landmark[0] * scale,
                y: landmark[1] * scale
              })
              
              return (
                <>
                  {/* Left eye */}
                  <line
                    x1={convertToSVG(landmarks[36]).x}
                    y1={convertToSVG(landmarks[36]).y}
                    x2={convertToSVG(landmarks[39]).x}
                    y2={convertToSVG(landmarks[39]).y}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity={opacity * 0.7}
                  />
                  {/* Right eye */}
                  <line
                    x1={convertToSVG(landmarks[42]).x}
                    y1={convertToSVG(landmarks[42]).y}
                    x2={convertToSVG(landmarks[45]).x}
                    y2={convertToSVG(landmarks[45]).y}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity={opacity * 0.7}
                  />
                  {/* Nose bridge */}
                  <line
                    x1={convertToSVG(landmarks[27]).x}
                    y1={convertToSVG(landmarks[27]).y}
                    x2={convertToSVG(landmarks[30]).x}
                    y2={convertToSVG(landmarks[30]).y}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity={opacity * 0.7}
                  />
                  {/* Mouth */}
                  <line
                    x1={convertToSVG(landmarks[48]).x}
                    y1={convertToSVG(landmarks[48]).y}
                    x2={convertToSVG(landmarks[54]).x}
                    y2={convertToSVG(landmarks[54]).y}
                    stroke="#ff0000"
                    strokeWidth="0.2"
                    opacity={opacity * 0.7}
                  />
                </>
              )
            })()}
          </svg>
        )}
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
