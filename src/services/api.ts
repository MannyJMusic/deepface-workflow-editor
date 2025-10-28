import axios, { AxiosInstance } from 'axios'
import { 
  Workflow, 
  WorkflowNode, 
  WorkflowEdge, 
  NodeDefinition, 
  WorkflowExecution,
  GPUInfo,
  NodePreset
} from '../types'

class ApiClient {
  private http: AxiosInstance
  private baseUrl: string

  constructor() {
    this.baseUrl = 'http://localhost:8001/api'
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minutes for long-running operations like face data import
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupHttpInterceptors()
  }

  private setupHttpInterceptors() {
    this.http.interceptors.request.use(
      (config) => {
        console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`)
        return config
      },
      (error) => {
        console.error('Request error:', error)
        return Promise.reject(error)
      }
    )

    this.http.interceptors.response.use(
      (response) => {
        console.log(`Response from ${response.config.url}:`, response.status)
        return response
      },
      (error) => {
        console.error('Response error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  // Workflow API
  async getWorkflows(): Promise<Workflow[]> {
    const response = await this.http.get('/workflow/')
    return response.data
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const response = await this.http.get(`/workflow/${id}`)
    return response.data
  }

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow> {
    const response = await this.http.post('/workflow/', workflow)
    return response.data
  }

  async updateWorkflow(id: string, workflow: Workflow): Promise<Workflow> {
    const response = await this.http.put(`/workflow/${id}`, workflow)
    return response.data
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.http.delete(`/workflow/${id}`)
  }

  async exportWorkflow(id: string): Promise<any> {
    const response = await this.http.post(`/workflow/${id}/export`)
    return response.data
  }

  async importWorkflow(workflowData: any): Promise<Workflow> {
    const response = await this.http.post('/workflow/import', workflowData)
    return response.data
  }

  // Node API
  async getNodeDefinitions(): Promise<NodeDefinition[]> {
    const response = await this.http.get('/nodes/definitions')
    return response.data
  }

  async getNodeDefinition(nodeType: string): Promise<NodeDefinition> {
    const response = await this.http.get(`/nodes/definitions/${nodeType}`)
    return response.data
  }

  async getNodeCategories(): Promise<string[]> {
    const response = await this.http.get('/nodes/categories')
    return response.data
  }

  async getNodesByCategory(category: string): Promise<NodeDefinition[]> {
    const response = await this.http.get(`/nodes/by-category/${category}`)
    return response.data
  }

  async validateConnection(
    sourceNodeType: string,
    targetNodeType: string,
    sourcePort: string,
    targetPort: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const response = await this.http.post('/nodes/validate-connection', {
      source_node_type: sourceNodeType,
      target_node_type: targetNodeType,
      source_port: sourcePort,
      target_port: targetPort,
    })
    return response.data
  }

  // Execution API
  async startExecution(workflowId: string): Promise<WorkflowExecution> {
    const response = await this.http.post(`/execution/start/${workflowId}`)
    return response.data
  }

  async stopExecution(executionId: string): Promise<void> {
    await this.http.post(`/execution/stop/${executionId}`)
  }

  async getExecution(executionId: string): Promise<WorkflowExecution> {
    const response = await this.http.get(`/execution/${executionId}`)
    return response.data
  }

  async listExecutions(): Promise<WorkflowExecution[]> {
    const response = await this.http.get('/execution/')
    return response.data
  }

  async resumeExecution(executionId: string): Promise<void> {
    await this.http.post(`/execution/${executionId}/resume`)
  }

  async startNodeExecution(nodeId: string, inputDir?: string): Promise<WorkflowExecution> {
    const url = inputDir 
      ? `/execution/start-node/${nodeId}?input_dir=${encodeURIComponent(inputDir)}`
      : `/execution/start-node/${nodeId}`
    const response = await this.http.post(url)
    return response.data
  }

  // GPU API
  async listGPUs(): Promise<{ gpus: Array<{ id: number; name: string; memory_total: number; available: boolean }> }> {
    const response = await this.http.get('/gpu/list')
    return response.data
  }

  async assignGPUToNode(gpuId: number, nodeId: string): Promise<any> {
    const response = await this.http.post(`/gpu/assign/${gpuId}`, { node_id: nodeId })
    return response.data
  }

  async getGPUMemoryInfo(gpuId: number): Promise<any> {
    const response = await this.http.get(`/gpu/memory/${gpuId}`)
    return response.data
  }

  async resetGPU(gpuId: number): Promise<any> {
    const response = await this.http.post(`/gpu/reset/${gpuId}`)
    return response.data
  }

  async getGPUProcesses(): Promise<any> {
    const response = await this.http.get('/gpu/processes')
    return response.data
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.http.get('/health')
    return response.data
  }

  // GPU Management
  async getGPUs(): Promise<GPUInfo[]> {
    const response = await this.http.get('/gpu/gpus')
    return response.data
  }

  async getGPUStatus(): Promise<{ gpus: GPUInfo[], timestamp: number }> {
    const response = await this.http.get('/gpu/gpus/status')
    return response.data
  }

  async getGPU(gpuId: number): Promise<GPUInfo> {
    const response = await this.http.get(`/gpu/gpus/${gpuId}`)
    return response.data
  }

  async getGPUsByType(type: string): Promise<GPUInfo[]> {
    const response = await this.http.get(`/gpu/gpus/type/${type}`)
    return response.data
  }

  async getAvailableGPUs(): Promise<GPUInfo[]> {
    const response = await this.http.get('/gpu/gpus/available')
    return response.data
  }

  async reserveGPU(gpuId: number, nodeId: string): Promise<{ gpu_id: number, node_id: string, reserved: boolean, message: string }> {
    const response = await this.http.post(`/gpu/gpus/${gpuId}/reserve`, { node_id: nodeId })
    return response.data
  }

  async releaseGPU(gpuId: number, nodeId: string): Promise<{ gpu_id: number, node_id: string, released: boolean, message: string }> {
    const response = await this.http.post(`/gpu/gpus/${gpuId}/release`, { node_id: nodeId })
    return response.data
  }

  async getSystemInfo(): Promise<{
    platform: string,
    system: string,
    processor: string,
    cpu_count: number,
    memory_total: number,
    memory_available: number,
    python_version: string
  }> {
    const response = await this.http.get('/gpu/gpus/system/info')
    return response.data
  }

  // Error Management
  async getErrors(params?: {
    severity?: string,
    category?: string,
    node_id?: string,
    workflow_id?: string,
    limit?: number
  }): Promise<any[]> {
    const response = await this.http.get('/errors/errors', { params })
    return response.data
  }

  async getErrorSummary(): Promise<{
    total_errors: number,
    errors_by_severity: Record<string, number>,
    errors_by_category: Record<string, number>,
    recent_errors: number
  }> {
    const response = await this.http.get('/errors/errors/summary')
    return response.data
  }

  async getError(errorId: string): Promise<any> {
    const response = await this.http.get(`/errors/errors/${errorId}`)
    return response.data
  }

  async retryError(errorId: string): Promise<{
    error_id: string,
    retry_count: number,
    max_retries: number,
    message: string
  }> {
    const response = await this.http.post(`/errors/errors/${errorId}/retry`)
    return response.data
  }

  async clearErrors(olderThanHours: number = 24): Promise<{ message: string }> {
    const response = await this.http.delete('/errors/errors', { 
      params: { older_than_hours: olderThanHours } 
    })
    return response.data
  }

  async getNodeErrors(nodeId: string, limit: number = 50): Promise<{
    node_id: string,
    error_count: number,
    errors: any[]
  }> {
    const response = await this.http.get(`/errors/errors/node/${nodeId}`, {
      params: { limit }
    })
    return response.data
  }

  async getWorkflowErrors(workflowId: string, limit: number = 100): Promise<{
    workflow_id: string,
    error_count: number,
    errors: any[]
  }> {
    const response = await this.http.get(`/errors/errors/workflow/${workflowId}`, {
      params: { limit }
    })
    return response.data
  }

  async getRecentErrors(hours: number = 1): Promise<{
    hours: number,
    error_count: number,
    errors: any[]
  }> {
    const response = await this.http.get('/errors/errors/recent', {
      params: { hours }
    })
    return response.data
  }

  async getErrorStats(): Promise<{
    total_errors: number,
    recoverable_errors: number,
    non_recoverable_errors: number,
    errors_by_severity: Record<string, number>,
    errors_by_category: Record<string, number>,
    errors_by_hour: Record<string, number>,
    average_errors_per_hour: number
  }> {
    const response = await this.http.get('/errors/errors/stats')
    return response.data
  }

  // WebSocket connection
  private ws: WebSocket | null = null
  private wsCallbacks: Map<string, (data: any) => void> = new Map()

  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `ws://localhost:8001/ws`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleWebSocketMessage(data)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason)
          this.ws = null
          // Don't reject here as this is normal behavior
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          // Only reject if this is the initial connection attempt
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            reject(error)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private handleWebSocketMessage(data: any): void {
    const { type } = data

    switch (type) {
      case 'node_update':
        const nodeCallback = this.wsCallbacks.get('node_update')
        if (nodeCallback) {
          nodeCallback(data)
        }
        break

      case 'execution_update':
        const executionCallback = this.wsCallbacks.get('execution_update')
        if (executionCallback) {
          executionCallback(data)
        }
        break

      case 'log_message':
        const logCallback = this.wsCallbacks.get('log_message')
        if (logCallback) {
          logCallback(data)
        }
        break

      case 'import_progress':
        const importProgressCallback = this.wsCallbacks.get('import_progress')
        if (importProgressCallback) {
          importProgressCallback(data)
        }
        break

      case 'import_complete':
        const importCompleteCallback = this.wsCallbacks.get('import_complete')
        if (importCompleteCallback) {
          importCompleteCallback(data)
        }
        break

      default:
        // Silently ignore unknown message types - they may be handled by other components
        break
    }
  }

  onWebSocketMessage(type: string, callback: (data: any) => void): void {
    this.wsCallbacks.set(type, callback)
  }

  offWebSocketMessage(type: string): void {
    this.wsCallbacks.delete(type)
  }

  isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  // Preset API
  async saveNodePreset(preset: NodePreset): Promise<NodePreset> {
    const response = await this.http.post('/presets/', preset)
    return response.data
  }

  async listNodePresets(): Promise<NodePreset[]> {
    const response = await this.http.get('/presets/')
    return response.data
  }

  async getNodePreset(presetId: string): Promise<NodePreset> {
    const response = await this.http.get(`/presets/${presetId}`)
    return response.data
  }

  async updateNodePreset(presetId: string, preset: Partial<NodePreset>): Promise<NodePreset> {
    const response = await this.http.put(`/presets/${presetId}`, preset)
    return response.data
  }

  async deleteNodePreset(presetId: string): Promise<void> {
    await this.http.delete(`/presets/${presetId}`)
  }

  async getPresetsByType(nodeType: string): Promise<NodePreset[]> {
    const response = await this.http.get(`/presets/by-type/${nodeType}`)
    return response.data
  }

  async loadPresetIntoWorkflow(presetId: string, position: { x: number; y: number }): Promise<WorkflowNode> {
    const response = await this.http.post(`/presets/${presetId}/load-into-workflow`, { position })
    return response.data
  }

  // Face Editor API methods
  async detectFaces(nodeId: string, request: {
    input_dir: string
    face_type?: string
    detection_model?: string
    similarity_threshold?: number
  }): Promise<{
    success: boolean
    face_images: any[]
    message: string
  }> {
    const response = await this.http.post(`/nodes/${nodeId}/detect-faces`, request)
    return response.data
  }

  async loadSegmentationModel(nodeId: string): Promise<{
    success: boolean
    message: string
    model_type?: string
    error?: string
  }> {
    const response = await this.http.post(`/nodes/${nodeId}/load-segmentation-model`)
    return response.data
  }

  async generateMasks(nodeId: string, request: {
    face_images: any[]
    eyebrow_expand_mod?: number
  }): Promise<{
    success: boolean
    processed_count: number
    face_data: Record<string, any>
    message: string
    error?: string
  }> {
    const response = await this.http.post(`/nodes/${nodeId}/generate-masks`, request)
    return response.data
  }

  async embedPolygons(nodeId: string, request: {
    face_images: any[]
    eyebrow_expand_mod?: number
  }): Promise<{
    success: boolean
    processed_count: number
    message: string
    error?: string
  }> {
    const response = await this.http.post(`/nodes/${nodeId}/embed-polygons`, request)
    return response.data
  }

  async getFaceImages(nodeId: string, inputDir: string): Promise<{
    success: boolean
    face_images: any[]
    count: number
  }> {
    const response = await this.http.get(`/nodes/${nodeId}/face-images`, {
      params: { input_dir: inputDir }
    })
    return response.data
  }

  // Detection Profile Management
  async createDetectionProfile(nodeId: string, name: string, settings: any): Promise<{ success: boolean; profile_name: string; message: string }> {
    const response = await this.http.post(`/nodes/${nodeId}/detection-profiles`, { name, settings })
    return response.data
  }

  async listDetectionProfiles(nodeId: string): Promise<{ success: boolean; profiles: string[]; count: number }> {
    const response = await this.http.get(`/nodes/${nodeId}/detection-profiles`)
    return response.data
  }

  async deleteDetectionProfile(nodeId: string, profileName: string): Promise<{ success: boolean; profile_name: string; message: string }> {
    const response = await this.http.delete(`/nodes/${nodeId}/detection-profiles/${profileName}`)
    return response.data
  }

  async resetDetectionProfile(nodeId: string, profileName: string): Promise<{ success: boolean; profile_name: string; message: string }> {
    const response = await this.http.put(`/nodes/${nodeId}/detection-profiles/${profileName}/reset`)
    return response.data
  }

  // Face Data Operations
  async updateParentFrames(nodeId: string, inputDir: string, parentFrameFolder: string): Promise<{ success: boolean; message: string; files_updated: number }> {
    const response = await this.http.post(`/nodes/${nodeId}/update-parent-frames`, { input_dir: inputDir, parent_frame_folder: parentFrameFolder })
    return response.data
  }

  async getFaceData(nodeId: string, faceId: string, inputDir: string): Promise<{ success: boolean; message: string; landmarks?: number[][]; segmentation?: number[][][]; face_type?: string; source_filename?: string }> {
    const response = await this.http.get(`/nodes/${nodeId}/face-data/${faceId}?input_dir=${encodeURIComponent(inputDir)}`)
    return response.data
  }

  async getFaceDataBatch(nodeId: string, faceIds: string[], inputDir: string): Promise<{ success: boolean; message: string; results: Record<string, { success: boolean; message: string; landmarks?: number[][]; segmentation?: number[][][]; face_type?: string; source_filename?: string }> }> {
    const response = await this.http.post(`/nodes/${nodeId}/face-data-batch`, {
      face_ids: faceIds,
      input_dir: inputDir
    })
    return response.data
  }

  async importAllFaceData(nodeId: string, inputDir: string): Promise<{ success: boolean; message: string; face_data: Record<string, { landmarks?: number[][]; segmentation?: number[][][]; face_type?: string; source_filename?: string }>; processed_count: number; total_count: number }> {
    const response = await this.http.post(`/nodes/${nodeId}/import-all-face-data`, {
      input_dir: inputDir
    })
    return response.data
  }

  async getNodeProgress(nodeId: string): Promise<{ success: boolean; progress?: number; message?: string }> {
    const response = await this.http.get(`/nodes/${nodeId}/progress`)
    return response.data
  }

  async importFaceData(nodeId: string, inputDir: string): Promise<{ success: boolean; message: string; faces_imported: number; faces_with_data?: number; faces_with_landmarks?: number; faces_with_segmentation?: number; total_images?: number }> {
    const response = await this.http.post(`/nodes/${nodeId}/import-face-data`, { input_dir: inputDir })
    return response.data
  }

  async copyEmbeddedData(nodeId: string, inputDir: string, facesFolder: string, onlyParentData: boolean, recalculate: boolean): Promise<{ success: boolean; message: string; files_copied: number }> {
    const response = await this.http.post(`/nodes/${nodeId}/copy-embedded-data`, { 
      input_dir: inputDir, 
      faces_folder: facesFolder,
      only_parent_data: onlyParentData,
      recalculate: recalculate
    })
    return response.data
  }

  // XSeg Operations
  async trainXSeg(nodeId: string, inputDir: string, xsegModelPath: string): Promise<{ success: boolean; message: string; model_path: string }> {
    const response = await this.http.post(`/nodes/${nodeId}/xseg/train`, { input_dir: inputDir, xseg_model_path: xsegModelPath })
    return response.data
  }

  async applyXSeg(nodeId: string, inputDir: string, xsegModelPath: string): Promise<{ success: boolean; message: string; masks_generated: number }> {
    const response = await this.http.post(`/nodes/${nodeId}/xseg/apply`, { input_dir: inputDir, xseg_model_path: xsegModelPath })
    return response.data
  }

  async getXSegStatus(nodeId: string): Promise<{ success: boolean; status: string; progress: number; epoch: number; loss: number | null; message: string }> {
    const response = await this.http.get(`/nodes/${nodeId}/xseg/status`)
    return response.data
  }

  // Stream face images progressively
  // Save segmentation polygons for a face
  async saveSegmentation(nodeId: string, faceId: string, inputDir: string, segmentationPolygons: number[][][]): Promise<{ success: boolean; message: string }> {
    const response = await this.http.post('/face-editor/save-segmentation', {
      face_id: faceId,
      input_dir: inputDir,
      segmentation_polygons: segmentationPolygons
    })
    return response.data
  }

  // Import face data from DFL images
  async importDFLFaceData(nodeId: string, inputDir: string): Promise<{
    success: boolean
    message: string
    faces_imported: number
    faces_with_data: number
    faces_with_landmarks: number
    faces_with_segmentation: number
    total_images: number
  }> {
    const response = await this.http.post('/face-editor/import-face-data', {
      node_id: nodeId,
      input_dir: inputDir
    })
    return response.data
  }

  // Embed mask polygons into images
  async embedMasks(nodeId: string, inputDir: string, eyebrowExpandMod: number = 1, faceIds?: string[]): Promise<{
    success: boolean
    message: string
    processed_count: number
    success_count: number
    failure_count: number
  }> {
    const response = await this.http.post('/face-editor/embed-masks', {
      node_id: nodeId,
      input_dir: inputDir,
      eyebrow_expand_mod: eyebrowExpandMod,
      face_ids: faceIds
    })
    return response.data
  }

  async streamFaceImages(nodeId: string, inputDir: string, onFaceReceived: (face: any) => void, onComplete: () => void, onError: (error: string) => void): Promise<void> {
    try {
      const url = `${this.baseUrl}/nodes/${nodeId}/face-images-stream?input_dir=${encodeURIComponent(inputDir)}`
      
      console.log('Starting streaming from:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }
      
      const decoder = new TextDecoder()
      let buffer = ''
      let faceCount = 0
      
      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.warn('Streaming timeout reached, calling onComplete')
        onComplete()
      }, 30000) // 30 second timeout
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('Streaming completed normally')
          clearTimeout(timeoutId)
          break
        }
        
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'face') {
                console.log('Received face data:', data.data.filename)
                faceCount++
                onFaceReceived(data.data)
              } else if (data.type === 'count') {
                console.log(`Total faces to load: ${data.total}`)
              } else if (data.type === 'complete') {
                console.log('Streaming completed')
                clearTimeout(timeoutId)
                onComplete()
                return
              } else if (data.type === 'error') {
                console.error('Streaming error:', data.message)
                clearTimeout(timeoutId)
                onError(data.message)
                return
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e)
            }
          }
        }
      }
      
      // If we exit the loop without a complete signal, call onComplete
      if (faceCount > 0) {
        console.log('Streaming ended with', faceCount, 'faces loaded')
        onComplete()
      }
      
    } catch (error) {
      console.error('Streaming API error:', error)
      onError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Workspace validation
  async validateWorkspace(workspacePath: string): Promise<{
    success: boolean
    isValid: boolean
    message: string
    missingDirs: string[]
    faceCount: number
    hasVideoFiles: boolean
    hasAlignedDir: boolean
  }> {
    const response = await this.http.post('/face-editor/validate-workspace', workspacePath)
    return response.data
  }
}

export const apiClient = new ApiClient()
export default apiClient
