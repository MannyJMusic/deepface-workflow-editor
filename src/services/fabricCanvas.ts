/**
 * Fabric Canvas Utilities
 * Helper functions for fabric.js canvas operations
 */

import { Canvas, Image, Polygon, Circle, Group, Control, util, ICanvasOptions, IImageOptions, IPolygonOptions, IEvent, Point } from 'fabric'

export interface PolygonPoint {
  x: number
  y: number
}

export interface SegmentationPolygon {
  id: string
  points: PolygonPoint[]
  color: string
  opacity: number
}

/**
 * Create a fabric canvas instance
 */
export function createCanvas(canvasElement: HTMLCanvasElement, options?: ICanvasOptions): Canvas {
  return new Canvas(canvasElement, {
    selection: true,
    preserveObjectStacking: true,
    ...options
  })
}

/**
 * Add an image to the canvas
 */
export async function addImageToCanvas(
  canvas: Canvas,
  imageUrl: string,
  options?: IImageOptions
): Promise<Image> {
  console.log('addImageToCanvas called with URL:', imageUrl)
  console.log('Canvas dimensions:', { width: canvas.width, height: canvas.height })
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Loading image using native Image API...')
      
      // Use native Image API first
      const nativeImg = new window.Image()
      nativeImg.crossOrigin = 'anonymous'
      
      // Load the image using native API
      await new Promise((imgResolve, imgReject) => {
        nativeImg.onload = () => {
          console.log('Native image loaded successfully:', {
            width: nativeImg.width,
            height: nativeImg.height,
            naturalWidth: nativeImg.naturalWidth,
            naturalHeight: nativeImg.naturalHeight
          })
          imgResolve(nativeImg)
        }
        
        nativeImg.onerror = (error) => {
          console.error('Native image loading error:', error)
          imgReject(new Error('Failed to load image with native API'))
        }
        
        nativeImg.src = imageUrl
      })
      
      console.log('Converting native image to fabric.js Image...')
      
      // Convert to fabric.js Image
      const fabricImg = new Image(nativeImg, {
        crossOrigin: 'anonymous',
        ...options
      })
      
      console.log('Fabric image created:', {
        width: fabricImg.width,
        height: fabricImg.height
      })

      // Scale image to fit canvas while maintaining aspect ratio (show full image)
      const scale = Math.min(
        canvas.width! / fabricImg.width!,
        canvas.height! / fabricImg.height!
      )

      console.log('Calculated scale:', scale)

      // Center the image in the canvas
      const scaledWidth = fabricImg.width! * scale
      const scaledHeight = fabricImg.height! * scale
      const left = (canvas.width! - scaledWidth) / 2
      const top = (canvas.height! - scaledHeight) / 2

      fabricImg.set({
        scaleX: scale,
        scaleY: scale,
        left: left,
        top: top,
        selectable: false,
        evented: false,
        ...options
      })

      console.log('Adding image to canvas...', {
        originalSize: { width: fabricImg.width, height: fabricImg.height },
        scaledSize: { width: scaledWidth, height: scaledHeight },
        position: { left, top },
        scale
      })
      
      canvas.add(fabricImg)
      canvas.renderAll()
      console.log('Image added to canvas successfully')
      resolve(fabricImg)
      
    } catch (error) {
      console.error('Error in addImageToCanvas:', error)
      reject(error)
    }
  })
}

/**
 * Create a polygon on the canvas
 */
export function createPolygon(
  canvas: Canvas,
  points: PolygonPoint[],
  options?: Partial<IPolygonOptions>
): Polygon {
  const polygon = new Polygon(points, {
    fill: 'rgba(0, 123, 255, 0.3)',
    stroke: 'rgba(0, 123, 255, 0.8)',
    strokeWidth: 2,
    objectCaching: false,
    transparentCorners: false,
    cornerColor: 'rgba(0, 123, 255, 1)',
    cornerSize: 8,
    hasControls: true,
    hasBorders: true,
    lockRotation: true,
    lockScalingFlip: true,
    ...options
  })

  console.log('createPolygon adding polygon to canvas:', {
    polygon,
    points: polygon.points,
    visible: polygon.visible,
    opacity: polygon.opacity,
    fill: polygon.fill,
    stroke: polygon.stroke,
    canvasObjects: canvas.getObjects().length,
    canvasDimensions: { width: canvas.width, height: canvas.height }
  })

  canvas.add(polygon)
  canvas.setActiveObject(polygon)
  canvas.renderAll()

  console.log('createPolygon polygon added successfully:', {
    canvasObjects: canvas.getObjects().length,
    polygonVisible: polygon.visible,
    polygonOpacity: polygon.opacity,
    polygonPosition: { left: polygon.left, top: polygon.top },
    polygonSize: { width: polygon.width, height: polygon.height }
  })

  return polygon
}

/**
 * Update polygon points
 */
export function updatePolygonPoints(polygon: Polygon, points: PolygonPoint[]): void {
  polygon.set({ points })
  polygon.setCoords()
}

/**
 * Add a point to a polygon
 */
export function addPointToPolygon(polygon: Polygon, point: PolygonPoint, index?: number): void {
  const points = polygon.points || []

  if (index !== undefined && index >= 0 && index < points.length) {
    points.splice(index + 1, 0, point)
  } else {
    points.push(point)
  }

  updatePolygonPoints(polygon, points)
}

/**
 * Remove a point from a polygon
 */
export function removePointFromPolygon(polygon: Polygon, index: number): void {
  const points = polygon.points || []

  if (points.length > 3 && index >= 0 && index < points.length) {
    points.splice(index, 1)
    updatePolygonPoints(polygon, points)
  }
}

/**
 * Get polygon points in normalized coordinates (0-1)
 */
export function getNormalizedPolygonPoints(
  polygon: Polygon,
  imageWidth: number,
  imageHeight: number
): number[][] {
  const points = polygon.points || []
  const matrix = polygon.calcTransformMatrix()

  return points.map(point => {
    const transformed = util.transformPoint(point, matrix)
    return [
      transformed.x / imageWidth,
      transformed.y / imageHeight
    ]
  })
}

/**
 * Set polygon points from normalized coordinates
 */
export function setPolygonFromNormalized(
  canvas: Canvas,
  normalizedPoints: number[][],
  imageWidth: number,
  imageHeight: number,
  imageLeft: number = 0,
  imageTop: number = 0,
  options?: Partial<IPolygonOptions>
): Polygon {
  const points: PolygonPoint[] = normalizedPoints.map(([x, y]) => ({
    x: imageLeft + (x * imageWidth),
    y: imageTop + (y * imageHeight)
  }))

  console.log('setPolygonFromNormalized creating polygon with points:', {
    normalizedPoints: normalizedPoints.slice(0, 3),
    imageWidth,
    imageHeight,
    imageLeft,
    imageTop,
    calculatedPoints: points.slice(0, 3),
    totalPoints: points.length,
    canvasBounds: { width: canvas.width, height: canvas.height },
    pointsInBounds: points.every(p => p.x >= 0 && p.x <= canvas.width! && p.y >= 0 && p.y <= canvas.height!)
  })

  return createPolygon(canvas, points, options)
}

/**
 * Draw landmarks on canvas
 */
export function drawLandmarks(
  canvas: Canvas,
  landmarks: number[][],
  imageWidth: number,
  imageHeight: number,
  options?: { color?: string; radius?: number }
): Group {
  const { color = '#FF5722', radius = 3 } = options || {}

  const circles = landmarks.map(([x, y]) => {
    return new Circle({
      left: x * imageWidth,
      top: y * imageHeight,
      radius,
      fill: color,
      stroke: color,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center'
    })
  })

  const group = new Group(circles, {
    selectable: false,
    evented: false
  })

  canvas.add(group)
  canvas.renderAll()

  return group
}

/**
 * Clear all objects from canvas except background image
 */
export function clearCanvas(canvas: Canvas, keepBackground: boolean = true): void {
  const objects = canvas.getObjects()

  objects.forEach(obj => {
    if (!keepBackground || obj.type !== 'image') {
      canvas.remove(obj)
    }
  })

  canvas.renderAll()
}

/**
 * Export canvas as data URL
 */
export function exportCanvasAsDataURL(canvas: Canvas, format: string = 'png'): string {
  return canvas.toDataURL({ format })
}

/**
 * Add polygon editing controls
 */
export function enablePolygonEditing(polygon: Polygon): void {
  // Add control points for each vertex
  const points = polygon.points || []

  const controls: { [key: string]: Control } = {}

  points.forEach((point, index) => {
    controls[`p${index}`] = new Control({
      positionHandler: (dim, finalMatrix, fabricObject) => {
        const poly = fabricObject as Polygon
        const points = poly.points || []
        if (index < points.length) {
          const x = points[index].x - poly.pathOffset!.x
          const y = points[index].y - poly.pathOffset!.y
          return util.transformPoint(
            { x, y } as Point,
            util.multiplyTransformMatrices(
              poly.canvas!.viewportTransform!,
              poly.calcTransformMatrix()
            )
          )
        }
        return { x: 0, y: 0 } as Point
      },
      actionHandler: (eventData, transform, x, y) => {
        const poly = transform.target as Polygon
        const points = poly.points || []
        const matrix = poly.calcTransformMatrix()
        const inv = util.invertTransform(matrix)
        const localPoint = util.transformPoint({ x, y } as Point, inv)

        if (index < points.length) {
          points[index].x = localPoint.x + poly.pathOffset!.x
          points[index].y = localPoint.y + poly.pathOffset!.y
        }

        return true
      },
      cursorStyle: 'pointer',
      actionName: 'modifyPolygon',
      render: (ctx, left, top, styleOverride, fabricObject) => {
        ctx.save()
        ctx.fillStyle = '#007bff'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(left, top, 5, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    })
  })

  polygon.controls = controls
  polygon.hasControls = true
  polygon.setCoords()
}

/**
 * Expand eyebrow region of a polygon
 */
export function expandEyebrowRegion(
  points: PolygonPoint[],
  expandMod: number,
  imageWidth: number,
  imageHeight: number
): PolygonPoint[] {
  if (expandMod <= 1) {
    return points
  }

  const eyebrowThreshold = imageHeight * 0.3 // Top 30% is eyebrow region
  const expansionAmount = expandMod * imageHeight * 0.02

  return points.map(point => {
    if (point.y < eyebrowThreshold) {
      return {
        x: point.x,
        y: Math.max(0, point.y - expansionAmount)
      }
    }
    return point
  })
}