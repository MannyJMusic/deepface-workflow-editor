import React, { useState, useEffect, useCallback } from 'react'
import { useWorkflowStore } from '../../stores/workflowStore'
import { apiClient } from '../../services/api'
import OptimizedFaceGrid from './OptimizedFaceGrid'
import DetectionPanelNew from './DetectionPanelNew'
import ConsolePanel from './ConsolePanel'
import FaceEditorModal from './FaceEditorModal'

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
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])

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

  // Add console log message
  const addConsoleLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setConsoleLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }, [])

  // WebSocket connection for real-time progress updates
  useEffect(() => {
    if (!currentNode?.id) return

    let ws: WebSocket | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 3
    const reconnectDelay = 2000

    const connectWebSocket = () => {
      try {
        ws = new WebSocket('ws://localhost:8001/ws')
        
        ws.onopen = () => {
          console.log('WebSocket connected for import progress')
          reconnectAttempts = 0 // Reset on successful connection
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            // Handle import progress messages
            if (data.type === 'import_progress' && data.node_id === currentNode.id) {
              setImportProgress(data.progress)
              setCurrentImage(data.current_image)
              setProcessedCount(data.processed)
              setTotalCount(data.total)
              setImportMessage(data.message)
              addConsoleLog(data.message)
            }
            
            if (data.type === 'import_image_success' && data.node_id === currentNode.id) {
              addConsoleLog(`✓ ${data.filename}: landmarks=${data.has_landmarks}, segmentation=${data.has_segmentation}`)
            }
            
            if (data.type === 'import_image_failed' && data.node_id === currentNode.id) {
              addConsoleLog(`✗ ${data.filename}: ${data.reason}`)
            }
            
            if (data.type === 'import_image_error' && data.node_id === currentNode.id) {
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
          console.warn('WebSocket connection error - server may not be running')
          // Don't spam the console with errors when server is down
        }
        
        ws.onclose = (event) => {
          console.log('WebSocket disconnected')
          
          // Attempt to reconnect if it wasn't a clean close and we haven't exceeded max attempts
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++
            console.log(`Attempting to reconnect WebSocket (${reconnectAttempts}/${maxReconnectAttempts})...`)
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
      if (ws) {
        ws.close(1000, 'Component unmounting') // Clean close
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
    
    try {
      // Use the optimized batch import process
      const importResponse = await apiClient.importAllFaceData(currentNode.id, currentNode.parameters?.input_dir || '')
      
      if (importResponse.success) {
        setImportProgress(100)
        setImportMessage('Import completed!')
        console.log('Import response face_data:', importResponse.face_data)
        console.log('Number of faces with data:', Object.keys(importResponse.face_data).length)
        console.log('First 5 face_data keys:', Object.keys(importResponse.face_data).slice(0, 5))
        console.log('Sample face_data entry:', Object.keys(importResponse.face_data).slice(0, 1).map(key => ({ key, data: importResponse.face_data[key] })))
        setAllFaceData(importResponse.face_data)
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

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-300">
              Advanced Face Editor
            </h2>
            
            {/* Import Status Indicator */}
            {isImporting && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                <div className="flex flex-col">
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {importMessage || 'Importing face data...'}
                  </span>
                  {currentImage && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      Processing: {currentImage}
                    </span>
                  )}
                </div>
              </div>
            )}
            
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

      {/* Progress Bar */}
      {isImporting && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 transition-colors duration-300">
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {importMessage || 'Importing face data...'}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {processedCount}/{totalCount} ({Math.round(importProgress)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${importProgress}%` }}
              ></div>
            </div>
            {currentImage && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                Processing: {currentImage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
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
          onClearLogs={clearConsoleLogs}
        />
      )}

      {/* Face Editor Modal */}
      {selectedFaceId && currentNode && (
        <FaceEditorModal
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
