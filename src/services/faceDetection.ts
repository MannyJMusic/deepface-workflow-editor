/**
 * Face Detection Service
 * Handles TensorFlow.js model loading and face detection operations
 */

import * as faceapi from '@vladmandic/face-api'

export interface FaceLandmarks {
  points: Array<[number, number]>
}

export interface FaceDetectionResult {
  landmarks: FaceLandmarks
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
}

class FaceDetectionService {
  private modelsLoaded: boolean = false
  private modelsPath: string = '/models'
  private loadingPromise: Promise<void> | null = null

  /**
   * Initialize and load all required models
   */
  async initialize(): Promise<void> {
    if (this.modelsLoaded) {
      return
    }

    if (this.loadingPromise) {
      return this.loadingPromise
    }

    this.loadingPromise = this._loadModels()
    return this.loadingPromise
  }

  private async _loadModels(): Promise<void> {
    try {
      console.log('Loading face detection models...')

      // Load models from public/models directory
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelsPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.modelsPath)
      ])

      this.modelsLoaded = true
      console.log('Face detection models loaded successfully')
    } catch (error) {
      console.error('Failed to load face detection models:', error)
      throw new Error('Failed to load face detection models')
    }
  }

  /**
   * Detect faces in an image element
   */
  async detectFaces(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<FaceDetectionResult[]> {
    if (!this.modelsLoaded) {
      await this.initialize()
    }

    try {
      const detections = await faceapi
        .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()

      return detections.map(detection => ({
        landmarks: {
          points: detection.landmarks.positions.map(p => [p.x, p.y] as [number, number])
        },
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height
        },
        confidence: detection.detection.score
      }))
    } catch (error) {
      console.error('Face detection error:', error)
      return []
    }
  }

  /**
   * Detect landmarks for a single face image
   */
  async detectLandmarks(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<Array<[number, number]> | null> {
    if (!this.modelsLoaded) {
      await this.initialize()
    }

    try {
      const detection = await faceapi
        .detectSingleFace(imageElement, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()

      if (!detection) {
        return null
      }

      return detection.landmarks.positions.map(p => [p.x, p.y] as [number, number])
    } catch (error) {
      console.error('Landmark detection error:', error)
      return null
    }
  }

  /**
   * Generate face embedding for similarity comparison
   */
  async getFaceEmbedding(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<Float32Array | null> {
    if (!this.modelsLoaded) {
      await this.initialize()
    }

    try {
      const detection = await faceapi
        .detectSingleFace(imageElement, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        return null
      }

      return detection.descriptor
    } catch (error) {
      console.error('Face embedding error:', error)
      return null
    }
  }

  /**
   * Calculate cosine similarity between two face embeddings
   */
  calculateSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  /**
   * Group faces by similarity using embeddings
   */
  async groupFacesBySimilarity(
    images: HTMLImageElement[],
    threshold: number = 0.6,
    onProgress?: (current: number, total: number) => void
  ): Promise<number[][]> {
    if (!this.modelsLoaded) {
      await this.initialize()
    }

    // Get embeddings for all images
    const embeddings: (Float32Array | null)[] = []
    for (let i = 0; i < images.length; i++) {
      const embedding = await this.getFaceEmbedding(images[i])
      embeddings.push(embedding)
      if (onProgress) {
        onProgress(i + 1, images.length)
      }
    }

    // Group faces using simple clustering
    const groups: number[][] = []
    const assigned: boolean[] = new Array(images.length).fill(false)

    for (let i = 0; i < embeddings.length; i++) {
      if (assigned[i] || !embeddings[i]) continue

      const group: number[] = [i]
      assigned[i] = true

      for (let j = i + 1; j < embeddings.length; j++) {
        if (assigned[j] || !embeddings[j]) continue

        const similarity = this.calculateSimilarity(embeddings[i]!, embeddings[j]!)
        if (similarity >= threshold) {
          group.push(j)
          assigned[j] = true
        }
      }

      groups.push(group)
    }

    return groups
  }

  /**
   * Check if models are loaded
   */
  isReady(): boolean {
    return this.modelsLoaded
  }
}

// Export singleton instance
export const faceDetectionService = new FaceDetectionService()

export default faceDetectionService
