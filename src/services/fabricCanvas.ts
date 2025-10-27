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
  return new Promise((resolve, reject) => {
    Image.fromURL(
      imageUrl,
      (img) => {
        if (!img) {
          reject(new Error('Failed to load image'))
          return
        }

        // Scale image to fit canvas
        const scale = Math.min(
          canvas.width! / img.width!,
          canvas.height! / img.height!
        )

        img.set({
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          ...options
        })

        canvas.add(img)
        canvas.sendToBack(img)
        canvas.renderAll()
        resolve(img)
      },
      { crossOrigin: 'anonymous' }
    )
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

  canvas.add(polygon)
  canvas.setActiveObject(polygon)
  canvas.renderAll()

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
  options?: Partial<IPolygonOptions>
): Polygon {
  const points: PolygonPoint[] = normalizedPoints.map(([x, y]) => ({
    x: x * imageWidth,
    y: y * imageHeight
  }))

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