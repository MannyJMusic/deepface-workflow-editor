import React, { useState, useEffect, useCallback } from 'react'
import { useWorkflowStore } from '../../stores/workflowStore'
import { apiClient } from '../../services/api'
import OptimizedFaceGrid from './OptimizedFaceGrid'
import DetectionPanelNew from './DetectionPanelNew'
import ConsolePanel, { ProcessInfo, LogEntry } from './ConsolePanel'
import FaceEditorModalNew from './FaceEditorModalNew'
import FileTreePanel from './FileTreePanel'

interface FaceImage {
  id: string
  filename: string
  filePath: string
  thumbnailUrl?: string
  segmentationPolygon?: number[][]
  landmarks?: number[][]
  selected?: boolean
  active?: boolean
  hasFaceData?: boolean  // Track if face data has been imported
}

interface DetectionSettings {
  faceType: string
  detectionModel: string
  similarityThreshold: number
  eyebrowExpandMod: number
}

const AdvancedFaceEditorView: React.FC = () => {
  const { activeNodeInSingleMode, selectedNode, updateNode } = useWorkflowStore()
  
  // Use activeNodeInSingleMode if in single-node mode, otherwise selectedNode
  const currentNode = activeNodeInSingleMode || selectedNode
  
  // State management
  const [faceImages, setFaceImages] = useState<FaceImage[]>([])
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettings>({
    faceType: 'full_face',
    detectionModel: 'VGGFace2',
    similarityThreshold: 0.6,
    eyebrowExpandMod: 1
  })
  const [showSegmentation, setShowSegmentation] = useState(false)
  const [showAlignments, setShowAlignments] = useState(false)
  const [allFaceData, setAllFaceData] = useState<Record<string, { landmarks?: number[][]; segmentation?: number[][][]; face_type?: string; source_filename?: string }>>({})
  const [faceDataImported, setFaceDataImported] = useState(false)
  const [showConsole, setShowConsole] = useState(false)
  const [showDetectionPanel, setShowDetectionPanel] = useState(true)
  const [showFileTree, setShowFileTree] = useState(true)
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([])
  const [processes, setProcesses] = useState<ProcessInfo[]>([])

  // Faces Editor State Management
  const [detectionProfiles, setDetectionProfiles] = useState<string[]>(['default'])
  const [selectedProfile, setSelectedProfile] = useState<string>('default')
  const [parentFrameFolder, setParentFrameFolder] = useState<string>('')
  const [facesFolder, setFacesFolder] = useState<string>('')
  const [xsegModelPath, setXsegModelPath] = useState<string>('')
  const [onlyParentData, setOnlyParentData] = useState<boolean>(false)
  const [recalculateFaceData, setRecalculateFaceData] = useState<boolean>(false)
  const [setFacesToParent, setSetFacesToParent] = useState<boolean>(false)

  // Import progress tracking
  const [importProgress, setImportProgress] = useState<number>(0)
  const [importMessage, setImportMessage] = useState<string>('')
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [currentImage, setCurrentImage] = useState<string>('')
  const [processedCount, setProcessedCount] = useState<number>(0)
  const [totalCount, setTotalCount] = useState<number>(0)

  // Initialize settings from node parameters
  useEffect(() => {
    if (currentNode?.parameters) {
      setDetectionSettings({
        faceType: currentNode.parameters.face_type || 'full_face',
        detectionModel: currentNode.parameters.detection_model || 'VGGFace2',
        similarityThreshold: currentNode.parameters.similarity_threshold || 0.6,
        eyebrowExpandMod: currentNode.parameters.eyebrow_expand_mod || 1
      })
    }
  }, [currentNode])

  // Initialize sample processes and logs for demonstration
  useEffect(() => {
    // Add sample processes
    setProcesses([
      {
        id: 'xseg-editor',
        name: 'XSeg Editor',
        status: 'stopped',
        output: []
      },
      {
        id: 'face-detection',
        name: 'Face Detection',
        status: 'running',
        pid: 12345,
        startTime: new Date(Date.now() - 30000),
        output: []
      },
      {
        id: 'segmentation-model',
        name: 'Segmentation Model',
        status: 'completed',
        startTime: new Date(Date.now() - 120000),
        endTime: new Date(Date.now() - 60000),
        output: []
      }
    ])

    // Add sample logs
    const sampleLogs: LogEntry[] = [
      {
        id: 'log-1',
        timestamp: new Date(Date.now() - 120000),
        level: 'info',
        message: 'Advanced Face Editor initialized',
        processId: 'face-detection',
        processName: 'Face Detection'
      },
      {
        id: 'log-2',
        timestamp: new Date(Date.now() - 90000),
        level: 'success',
        message: 'Segmentation model loaded successfully',
        processId: 'segmentation-model',
        processName: 'Segmentation Model'
      },
      {
        id: 'log-3',
        timestamp: new Date(Date.now() - 60000),
        level: 'info',
        message: 'Processing face images...',
        processId: 'face-detection',
        processName: 'Face Detection'
      },
      {
        id: 'log-4',
        timestamp: new Date(Date.now() - 30000),
        level: 'warning',
        message: 'Low similarity threshold detected for some faces',
        processId: 'face-detection',
        processName: 'Face Detection'
      },
      {
        id: 'log-5',
        timestamp: new Date(Date.now() - 10000),
        level: 'info',
        message: 'Face detection completed',
        processId: 'face-detection',
        processName: 'Face Detection'
      }
    ]
    setConsoleLogs(sampleLogs)
  }, [])

  // Add console log message
  const addConsoleLog = useCallback((message: string, level: LogEntry['level'] = 'info', processId?: string, processName?: string) => {
    const logEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      processId,
      processName
    }
    setConsoleLogs(prev => [...prev, logEntry])
  }, [])

  // Store WebSocket connection in a ref so it can be accessed by other functions
  const wsRef = React.useRef<WebSocket | null>(null)

  // WebSocket connection for real-time progress updates
  useEffect(() => {
    console.log('🔌 useEffect triggered, currentNode?.id:', currentNode?.id)
    if (!currentNode?.id) {
      console.log('🔌 No currentNode.id, skipping WebSocket connection')
      return
    }

    let reconnectAttempts = 0
    const maxReconnectAttempts = 3
    const reconnectDelay = 2000

    const connectWebSocket = () => {
      console.log('🔌 connectWebSocket function called')
      try {
        console.log('🔌 Attempting to connect WebSocket to ws://localhost:8001/ws')
        const ws = new WebSocket('ws://localhost:8001/ws')
        wsRef.current = ws
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected for import progress')
          console.log('🔌 WebSocket readyState:', ws.readyState)
          console.log('🔌 WebSocket URL:', ws.url)
          reconnectAttempts = 0 // Reset on successful connection
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('🔌 WebSocket message received:', data)
            console.log('🔌 Current node ID:', currentNode.id)
            console.log('🔌 Message node ID:', data.node_id)
            
            // Handle import progress messages
            if (data.type === 'import_progress' && data.node_id === currentNode.id) {
              console.log('✅ Processing import_progress message:', data)
              console.log('✅ Setting progress to:', data.progress)
              console.log('✅ Setting current image to:', data.current_image)
              setImportProgress(data.progress)
              setCurrentImage(data.current_image)
              setProcessedCount(data.processed)
              setTotalCount(data.total)
              setImportMessage(data.message)
            } else if (data.type === 'import_progress') {
              console.log('❌ Import progress message ignored - node ID mismatch:', data.node_id, 'vs', currentNode.id)
              addConsoleLog(data.message)
            }
            
            if (data.type === 'import_image_success' && data.node_id === currentNode.id) {
              // Update progress for each successful image
              if (data.current_image && data.processed !== undefined && data.total !== undefined) {
                const progress = (data.processed / data.total) * 100
                setImportProgress(progress)
                setCurrentImage(data.current_image)
                setProcessedCount(data.processed)
                setTotalCount(data.total)
                setImportMessage(`${data.processed} with data`)
              }
              addConsoleLog(`✓ ${data.filename}: landmarks=${data.has_landmarks}, segmentation=${data.has_segmentation}`)
            }
            
            if (data.type === 'import_image_failed' && data.node_id === currentNode.id) {
              // Update progress for failed images too
              if (data.current_image && data.processed !== undefined && data.total !== undefined) {
                const progress = (data.processed / data.total) * 100
                setImportProgress(progress)
                setCurrentImage(data.current_image)
                setProcessedCount(data.processed)
                setTotalCount(data.total)
                setImportMessage(`${data.processed} with data`)
              }
              addConsoleLog(`✗ ${data.filename}: ${data.reason}`)
            }
            
            if (data.type === 'import_image_error' && data.node_id === currentNode.id) {
              // Update progress for error images too
              if (data.current_image && data.processed !== undefined && data.total !== undefined) {
                const progress = (data.processed / data.total) * 100
                setImportProgress(progress)
                setCurrentImage(data.current_image)
                setProcessedCount(data.processed)
                setTotalCount(data.total)
                setImportMessage(`${data.processed} with data`)
              }
              addConsoleLog(`✗ ${data.filename}: ${data.error}`)
            }
            
            if (data.type === 'import_complete' && data.node_id === currentNode.id) {
              // Don't update state here - let the API response handle it
              // This prevents race conditions between WebSocket and API response
              addConsoleLog(`WebSocket: ${data.message}`)
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }
        
        ws.onerror = (error) => {
          console.warn('🔌 WebSocket connection error - server may not be running:', error)
          // Don't spam the console with errors when server is down
        }
        
        ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason)
          
          // Attempt to reconnect if it wasn't a clean close and we haven't exceeded max attempts
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++
            console.log(`🔌 Attempting to reconnect WebSocket (${reconnectAttempts}/${maxReconnectAttempts})...`)
            setTimeout(connectWebSocket, reconnectDelay)
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.log('Max WebSocket reconnection attempts reached. Server may be offline.')
          }
        }
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
      }
    }

    connectWebSocket()
    
    return () => {
      console.log('🔌 useEffect cleanup - closing WebSocket')
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting') // Clean close
        wsRef.current = null
      }
    }
  }, [currentNode?.id]) // Removed addConsoleLog from dependencies

  // Auto-load existing images when input directory changes
  useEffect(() => {
    console.log('useEffect triggered with input_dir:', currentNode?.parameters?.input_dir)
    console.log('useEffect dependencies:', {
      input_dir: currentNode?.parameters?.input_dir,
      nodeId: currentNode?.id,
      detectionSettings
    })
    
    const loadExistingImages = async () => {
      if (!currentNode?.parameters?.input_dir) return
      
      const inputDir = currentNode.parameters.input_dir
      console.log('Loading existing images from:', inputDir)
      addConsoleLog(`Loading existing images from: ${inputDir}`)
      
      try {
        setLoading(true)
        // Clear existing face images before loading new ones
        setFaceImages([])
        
        // Use batch API to get all images at once
        const response = await apiClient.getFaceImages(currentNode.id, inputDir)
        
        if (response.success) {
          console.log('Received all face images:', response.face_images.length)
          addConsoleLog(`Loaded ${response.face_images.length} face images`)
          
          // Sort face images by filename for consistent ordering and add hasFaceData property
          const sortedFaceImages = (response.face_images || []).sort((a, b) => a.filename.localeCompare(b.filename)).map(face => ({
            ...face,
            hasFaceData: false  // Initially assume no face data until import
          }))
          setFaceImages(sortedFaceImages)
          
          // Clear any previous face data since we're loading a new directory
          setAllFaceData({})
          setFaceDataImported(false)
          
          addConsoleLog(`Thumbnails loaded. Click "Import Face Data" to process landmarks and segmentation.`)
          
          setLoading(false)
        } else {
          addConsoleLog(`Error loading images: ${response.message || 'Unknown error'}`)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error loading existing images:', error)
        addConsoleLog(`Error loading images: ${error}`)
        setLoading(false)
      }
    }

    // Load existing images whenever the input directory changes
    if (currentNode?.parameters?.input_dir) {
      loadExistingImages()
    }
  }, [currentNode?.parameters?.input_dir, currentNode?.id, addConsoleLog])

  // Detect faces in input directory
  const handleDetectFaces = useCallback(async () => {
    if (!currentNode) return

    setLoading(true)
    addConsoleLog('Starting face detection...')

    try {
      const inputDir = currentNode.parameters?.input_dir
      if (!inputDir) {
        addConsoleLog('Error: No input directory specified')
        return
      }

      addConsoleLog(`Scanning directory: ${inputDir}`)
      
      // Clear existing face images before loading new ones
      setFaceImages([])
      
      // Call API to detect faces
      const response = await apiClient.detectFaces(currentNode.id, {
        input_dir: inputDir,
        face_type: detectionSettings.faceType,
        detection_model: detectionSettings.detectionModel,
        similarity_threshold: detectionSettings.similarityThreshold
      })

      if (response.success) {
        // Sort face images by filename for consistent ordering and add hasFaceData property
        const sortedFaceImages = (response.face_images || []).sort((a, b) => a.filename.localeCompare(b.filename)).map(face => ({
          ...face,
          hasFaceData: false  // Initially assume no face data until import
        }))
        setFaceImages(sortedFaceImages)
        addConsoleLog(`Found ${sortedFaceImages.length} face images`)
      } else {
        addConsoleLog(`Error: ${response.message || 'Unknown error'}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, detectionSettings, addConsoleLog])

  // Load BiSeNet segmentation model
  const handleLoadSegmentationModel = useCallback(async () => {
    if (!currentNode) return

    setLoading(true)
    addConsoleLog('Loading BiSeNet segmentation model...')

    try {
      const response = await apiClient.loadSegmentationModel(currentNode.id)
      
      if (response.success) {
        addConsoleLog('BiSeNet model loaded successfully')
      } else {
        addConsoleLog(`Error loading model: ${response.error}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, addConsoleLog])

  // Generate segmentation masks
  const handleGenerateMasks = useCallback(async () => {
    if (!currentNode) return

    setLoading(true)
    addConsoleLog('Generating segmentation masks...')

    try {
      const response = await apiClient.generateMasks(currentNode.id, {
        face_images: faceImages,
        eyebrow_expand_mod: detectionSettings.eyebrowExpandMod
      })

      if (response.success) {
        addConsoleLog(`Generated masks for ${response.processed_count || 0} faces`)
        // Update face images with segmentation data
        if (response.face_data) {
          setFaceImages(prev => prev.map(face => {
            const updatedData = response.face_data[face.id]
            return updatedData ? { ...face, segmentationPolygon: updatedData.segmentation_polygon } : face
          }))
        }
      } else {
        addConsoleLog(`Error: ${response.error}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, detectionSettings.eyebrowExpandMod, addConsoleLog])

  // Embed mask polygons
  const handleEmbedPolygons = useCallback(async () => {
    if (!currentNode?.parameters?.input_dir) {
      addConsoleLog('Error: No input directory specified')
      return
    }

    const selectedFaces = faceImages.filter(f => f.selected)
    const faceIds = selectedFaces.length > 0 ? selectedFaces.map(f => f.id) : undefined

    setLoading(true)
    addConsoleLog(`Embedding mask polygons ${faceIds ? `for ${faceIds.length} selected faces` : 'for all faces'}...`)

    try {
      const response = await apiClient.embedMasks(
        currentNode.id,
        currentNode.parameters.input_dir,
        detectionSettings.eyebrowExpandMod,
        faceIds
      )

      if (response.success) {
        addConsoleLog(`Embed complete: ${response.success_count} succeeded, ${response.failure_count} failed`)
        addConsoleLog('Images ready for DFL training!')
      } else {
        addConsoleLog(`Error: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error embedding polygons: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, faceImages, detectionSettings.eyebrowExpandMod, addConsoleLog])

  // Handle face selection
  const handleFaceSelect = useCallback((faceId: string) => {
    setSelectedFaceId(faceId)
    setFaceImages(prev => prev.map(face => ({
      ...face,
      active: face.id === faceId
    })))
  }, [])

  // Handle face multi-select
  const handleFaceMultiSelect = useCallback((faceId: string, selected: boolean) => {
    setFaceImages(prev => prev.map(face => 
      face.id === faceId ? { ...face, selected } : face
    ))
  }, [])

  // Update detection settings
  const updateDetectionSettings = useCallback((updates: Partial<DetectionSettings>) => {
    setDetectionSettings(prev => ({ ...prev, ...updates }))
    
    // Update node parameters
    if (currentNode) {
      updateNode(currentNode.id, {
        parameters: {
          ...currentNode.parameters,
          ...updates
        }
      })
    }
  }, [currentNode, updateNode])

  // Clear console logs
  const clearConsoleLogs = useCallback(() => {
    setConsoleLogs([])
  }, [])

  // Process management functions
  const handleStartProcess = useCallback(async (processId: string) => {
    try {
      addConsoleLog(`Starting process: ${processId}`, 'info', processId, processId)
      
      // Update process status
      setProcesses(prev => prev.map(p => 
        p.id === processId ? { ...p, status: 'running', startTime: new Date() } : p
      ))
      
      // Here you would call the actual API to start the process
      // await apiClient.startProcess(processId)
      
    } catch (error) {
      addConsoleLog(`Failed to start process ${processId}: ${error}`, 'error', processId, processId)
    }
  }, [addConsoleLog])

  const handleStopProcess = useCallback(async (processId: string) => {
    try {
      addConsoleLog(`Stopping process: ${processId}`, 'info', processId, processId)
      
      // Update process status
      setProcesses(prev => prev.map(p => 
        p.id === processId ? { ...p, status: 'stopped', endTime: new Date() } : p
      ))
      
      // Here you would call the actual API to stop the process
      // await apiClient.stopProcess(processId)
      
    } catch (error) {
      addConsoleLog(`Failed to stop process ${processId}: ${error}`, 'error', processId, processId)
    }
  }, [addConsoleLog])

  const handleRestartProcess = useCallback(async (processId: string) => {
    try {
      addConsoleLog(`Restarting process: ${processId}`, 'info', processId, processId)
      
      // Stop first, then start
      await handleStopProcess(processId)
      setTimeout(() => handleStartProcess(processId), 1000)
      
    } catch (error) {
      addConsoleLog(`Failed to restart process ${processId}: ${error}`, 'error', processId, processId)
    }
  }, [addConsoleLog, handleStopProcess, handleStartProcess])

  const handleExportLogs = useCallback(() => {
    try {
      const logText = consoleLogs.map(log => 
        `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.processName ? `[${log.processName}] ` : ''}${log.message}`
      ).join('\n')
      
      const blob = new Blob([logText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `console-logs-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      addConsoleLog('Console logs exported successfully', 'success')
    } catch (error) {
      addConsoleLog(`Failed to export logs: ${error}`, 'error')
    }
  }, [consoleLogs, addConsoleLog])

  // Detection Profile Handlers
  const handleAddDetectionProfile = useCallback(async (name: string) => {
    if (!currentNode) return
    
    try {
      const response = await apiClient.createDetectionProfile(currentNode.id, name, detectionSettings)
      if (response.success) {
        setDetectionProfiles(prev => [...prev, name])
        addConsoleLog(`Detection profile '${name}' created`)
      } else {
        addConsoleLog(`Error creating profile: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    }
  }, [currentNode, detectionSettings, addConsoleLog])

  const handleRemoveDetectionProfile = useCallback(async (name: string) => {
    if (!currentNode) return
    
    try {
      const response = await apiClient.deleteDetectionProfile(currentNode.id, name)
      if (response.success) {
        setDetectionProfiles(prev => prev.filter(p => p !== name))
        if (selectedProfile === name) {
          setSelectedProfile('default')
        }
        addConsoleLog(`Detection profile '${name}' deleted`)
      } else {
        addConsoleLog(`Error deleting profile: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    }
  }, [currentNode, selectedProfile, addConsoleLog])

  const handleResetDetectionProfile = useCallback(async (name: string) => {
    if (!currentNode) return
    
    try {
      const response = await apiClient.resetDetectionProfile(currentNode.id, name)
      if (response.success) {
        addConsoleLog(`Detection profile '${name}' reset to defaults`)
      } else {
        addConsoleLog(`Error resetting profile: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    }
  }, [currentNode, addConsoleLog])

  // Face Data Operation Handlers
  const handleUpdateParentFrames = useCallback(async () => {
    if (!currentNode || !parentFrameFolder) return
    
    setLoading(true)
    addConsoleLog('Updating parent frame references...')
    
    try {
      const response = await apiClient.updateParentFrames(
        currentNode.id, 
        currentNode.parameters?.input_dir || '', 
        parentFrameFolder
      )
      if (response.success) {
        addConsoleLog(`Updated ${response.files_updated} files`)
      } else {
        addConsoleLog(`Error: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, parentFrameFolder, addConsoleLog])

  const handleImportFaceData = useCallback(async () => {
    if (!currentNode) return
    
    setLoading(true)
    setIsImporting(true)
    setImportProgress(0)
    setImportMessage('Starting batch import...')
    addConsoleLog('Starting batch import of face data...')
    addConsoleLog('Processing images in batches for better performance...')
    
    // Ensure WebSocket is connected before starting import
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('🔌 WebSocket not connected, waiting for connection...')
      setImportMessage('Connecting to server...')
      // Wait a bit for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('🔌 WebSocket readyState before import:', wsRef.current?.readyState)
    console.log('🔌 WebSocket connected:', wsRef.current?.readyState === WebSocket.OPEN)
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('🔌 WebSocket still not connected, proceeding anyway...')
      setImportMessage('Starting import without real-time progress...')
    }
    
    try {
      // Use the optimized batch import process
      const importResponse = await apiClient.importAllFaceData(currentNode.id, currentNode.parameters?.input_dir || '')
      console.log('Import response:', importResponse)
      
      if (importResponse.success) {
        setImportProgress(100)
        setImportMessage('Import completed!')
        console.log('Import response face_data:', importResponse.face_data)
        console.log('Number of faces with data:', Object.keys(importResponse.face_data).length)
        console.log('First 5 face_data keys:', Object.keys(importResponse.face_data).slice(0, 5))
        console.log('Sample face_data entry:', Object.keys(importResponse.face_data).slice(0, 1).map(key => ({ key, data: importResponse.face_data[key] })))
        setAllFaceData(importResponse.face_data)
        console.log('✅ allFaceData has been set with', Object.keys(importResponse.face_data).length, 'entries')
        setFaceDataImported(true)
        
        // Mark all face images as having face data
        setFaceImages(prev => prev.map(face => ({
          ...face,
          hasFaceData: true
        })))
        
        addConsoleLog(`✓ Successfully imported face data for ${importResponse.processed_count}/${importResponse.total_count} images`)
        addConsoleLog('Face thumbnails now show blue outline indicating imported face data')
      } else {
        setImportMessage('Import failed')
        addConsoleLog(`✗ Import failed: ${importResponse.message}`)
      }
    } catch (error) {
      setImportMessage('Import failed')
      addConsoleLog(`✗ Import error: ${error}`)
    } finally {
      setLoading(false)
      setIsImporting(false)
    }
  }, [currentNode, addConsoleLog])

  const handleCopyEmbeddedData = useCallback(async () => {
    if (!currentNode || !facesFolder) return
    
    setLoading(true)
    addConsoleLog('Copying embedded data...')
    
    try {
      const response = await apiClient.copyEmbeddedData(
        currentNode.id,
        currentNode.parameters?.input_dir || '',
        facesFolder,
        onlyParentData,
        recalculateFaceData
      )
      if (response.success) {
        addConsoleLog(`Copied ${response.files_copied} files`)
      } else {
        addConsoleLog(`Error: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, facesFolder, onlyParentData, recalculateFaceData, addConsoleLog])

  // XSeg Operation Handlers
  const handleTrainXSeg = useCallback(async () => {
    if (!currentNode || !xsegModelPath) return
    
    setLoading(true)
    addConsoleLog('Training XSeg model...')
    
    try {
      const response = await apiClient.trainXSeg(
        currentNode.id,
        currentNode.parameters?.input_dir || '',
        xsegModelPath
      )
      if (response.success) {
        addConsoleLog(`XSeg training started: ${response.model_path}`)
      } else {
        addConsoleLog(`Error: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, xsegModelPath, addConsoleLog])

  const handleApplyXSeg = useCallback(async () => {
    if (!currentNode || !xsegModelPath) return
    
    setLoading(true)
    addConsoleLog('Applying XSeg model...')
    
    try {
      const response = await apiClient.applyXSeg(
        currentNode.id,
        currentNode.parameters?.input_dir || '',
        xsegModelPath
      )
      if (response.success) {
        addConsoleLog(`Generated ${response.masks_generated} masks`)
      } else {
        addConsoleLog(`Error: ${response.message}`)
      }
    } catch (error) {
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [currentNode, xsegModelPath, addConsoleLog])

  const handleOpenXSegEditor = useCallback(() => {
    addConsoleLog('Opening XSeg Editor...')
    // XSeg editor opening would be implemented here
  }, [addConsoleLog])

  // File Tree Action Handlers
  const handleOpenImages = useCallback(async (path: string) => {
    console.log('Opening images from path:', path)
    addConsoleLog(`Opening images from: ${path}`)
    
    // Load faces from the specified directory
    await loadFacesFromDirectory(path)
  }, [addConsoleLog])

  const handleOpenSlideshow = useCallback(() => {
    addConsoleLog('Opening slideshow mode...')
    // TODO: Implement slideshow mode
  }, [addConsoleLog])

  const handleRefreshTree = useCallback(() => {
    addConsoleLog('Refreshing project structure...')
    // Trigger a reload of face images
    if (currentNode?.parameters?.input_dir) {
      loadFacesFromDirectory(currentNode.parameters.input_dir)
    }
  }, [addConsoleLog, currentNode])

  const handleWorkspaceSelect = useCallback((workspacePath: string, faceCount?: number) => {
    console.log('Workspace selected:', workspacePath, 'Face count:', faceCount)
    addConsoleLog(`Workspace selected: ${workspacePath}${faceCount ? ` (${faceCount} faces detected)` : ''}`)
    
    // Just log the workspace selection - don't update detection panel
    // The detection panel should be independent
  }, [addConsoleLog])

  // Load faces from a specific directory
  const loadFacesFromDirectory = useCallback(async (directoryPath: string) => {
    if (!currentNode) return

    setLoading(true)
    addConsoleLog(`Loading faces from: ${directoryPath}`, 'info')

    try {
      // Update the node parameters with the new input directory
      updateNode(currentNode.id, { 
        parameters: { 
          ...currentNode.parameters, 
          input_dir: directoryPath 
        } 
      })

      // Call the backend to get face images from the directory
      const response = await apiClient.getFaceImages(currentNode.id, directoryPath)

      if (response.success && response.face_images) {
        console.log('Face images loaded:', response.face_images.length)
        console.log('First face image:', response.face_images[0])
        setFaceImages(response.face_images)
        addConsoleLog(`Loaded ${response.face_images.length} faces from directory`, 'success')
      } else {
        console.log('Failed to load faces - response:', response)
        addConsoleLog('Failed to load faces from directory', 'error')
        setFaceImages([])
      }
    } catch (error) {
      console.error('Error loading faces:', error)
      addConsoleLog(`Error loading faces: ${error}`, 'error')
      setFaceImages([])
    } finally {
      setLoading(false)
    }
  }, [currentNode, addConsoleLog, updateNode])

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-300">
              Advanced Face Editor
            </h2>
            
         
            
            {/* Overlay Toggle Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  console.log('Segmentation button clicked, current state:', showSegmentation)
                  setShowSegmentation(!showSegmentation)
                  console.log('Segmentation state changed to:', !showSegmentation)
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                  showSegmentation
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {showSegmentation ? 'Hide' : 'Show'} Segmentation
              </button>
              <button
                onClick={() => {
                  console.log('Alignments button clicked, current state:', showAlignments)
                  setShowAlignments(!showAlignments)
                  console.log('Alignments state changed to:', !showAlignments)
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                  showAlignments
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {showAlignments ? 'Hide' : 'Show'} Alignments
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFileTree(!showFileTree)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                showFileTree
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Explorer
            </button>
            <button
              onClick={() => setShowConsole(!showConsole)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                showConsole
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Console
            </button>
            <button
              onClick={() => setShowDetectionPanel(!showDetectionPanel)}
              className="px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
            >
              {showDetectionPanel ? 'Hide' : 'Show'} Panel
            </button>
          </div>
        </div>
      </div>
   {/* Import Status Indicator */}
   {isImporting && (
              <div className="flex items-center space-x-3 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Importing Face Data
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      {Math.round(importProgress || 0)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress || 0}%` }}
                    />
                  </div>
                  {currentImage && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      {currentImage}
                    </div>
                  )}
                </div>
              </div>
            )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Tree Panel */}
        {showFileTree && (
          <div className="w-80 flex-shrink-0">
                        <FileTreePanel
                            inputDir={currentNode?.parameters?.input_dir}
                            faceCount={faceImages.length}
                            onOpenImages={handleOpenImages}
                            onOpenSlideshow={handleOpenSlideshow}
                            onRefresh={handleRefreshTree}
                            onWorkspaceSelect={handleWorkspaceSelect}
                        />
          </div>
        )}

        {/* Face Grid */}
        <div className="flex-1 overflow-hidden">
          <OptimizedFaceGrid
            faceImages={faceImages}
            showSegmentation={showSegmentation}
            showAlignments={showAlignments}
            allFaceData={allFaceData}
            faceDataImported={faceDataImported}
            onFaceSelect={handleFaceSelect}
            onFaceMultiSelect={handleFaceMultiSelect}
            loading={loading}
            nodeId={currentNode?.id || ''}
            inputDir={currentNode?.parameters?.input_dir || ''}
          />
        </div>

        {/* Detection Panel */}
        {showDetectionPanel && (
          <DetectionPanelNew
            detectionSettings={detectionSettings}
            onSettingsChange={updateDetectionSettings}
            onDetectFaces={handleDetectFaces}
            onLoadSegmentationModel={handleLoadSegmentationModel}
            onGenerateMasks={handleGenerateMasks}
            onEmbedPolygons={handleEmbedPolygons}
            faceCount={faceImages.length}
            loading={loading}
            inputDir={currentNode?.parameters?.input_dir}
            onInputDirChange={(dir) => {
              console.log('Input directory changed to:', dir)
              if (currentNode) {
                console.log('Updating node:', currentNode.id, 'with input_dir:', dir)
                updateNode(currentNode.id, { parameters: { ...currentNode.parameters, input_dir: dir } })
              }
            }}
            // Detection Profiles
            detectionProfiles={detectionProfiles}
            selectedProfile={selectedProfile}
            onProfileChange={setSelectedProfile}
            onAddProfile={handleAddDetectionProfile}
            onRemoveProfile={handleRemoveDetectionProfile}
            onResetProfile={handleResetDetectionProfile}
            // Parent Frame Folder
            parentFrameFolder={parentFrameFolder}
            onParentFrameFolderChange={setParentFrameFolder}
            // Faces Folder
            facesFolder={facesFolder}
            onFacesFolderChange={setFacesFolder}
            onlyParentData={onlyParentData}
            onOnlyParentDataChange={setOnlyParentData}
            recalculateFaceData={recalculateFaceData}
            onRecalculateFaceDataChange={setRecalculateFaceData}
            onCopyEmbeddedData={handleCopyEmbeddedData}
            onOpenXSegEditor={handleOpenXSegEditor}
            // XSeg Model
            xsegModelPath={xsegModelPath}
            onXsegModelPathChange={setXsegModelPath}
            onTrainXSeg={handleTrainXSeg}
            onApplyXSeg={handleApplyXSeg}
            // Embedded Detections
            setFacesToParent={setFacesToParent}
            onSetFacesToParentChange={setSetFacesToParent}
            onUpdateParentFrames={handleUpdateParentFrames}
            onImportFaceData={handleImportFaceData}
            // Progress tracking
            importProgress={importProgress}
            importMessage={importMessage}
            isImporting={isImporting}
            processedCount={processedCount}
            totalCount={totalCount}
          />
        )}
      </div>

            {/* Console Panel */}
            {showConsole && (
                <ConsolePanel
                    logs={consoleLogs}
                    processes={processes}
                    onClearLogs={clearConsoleLogs}
                    onStartProcess={handleStartProcess}
                    onStopProcess={handleStopProcess}
                    onRestartProcess={handleRestartProcess}
                    onExportLogs={handleExportLogs}
                />
            )}

      {/* Face Editor Modal */}
      {selectedFaceId && currentNode && (
        <FaceEditorModalNew
          faceImage={faceImages.find(f => f.id === selectedFaceId)}
          faceImages={faceImages}
          nodeId={currentNode.id}
          inputDir={currentNode.parameters?.input_dir || ''}
          eyebrowExpandMod={detectionSettings.eyebrowExpandMod}
          onClose={() => setSelectedFaceId(null)}
          onUpdateFace={(faceId, updates) => {
            setFaceImages(prev => prev.map(face =>
              face.id === faceId ? { ...face, ...updates } : face
            ))
          }}
        />
      )}
    </div>
  )
}

export default AdvancedFaceEditorView
