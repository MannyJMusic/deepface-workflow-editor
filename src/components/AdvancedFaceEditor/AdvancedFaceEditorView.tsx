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
    setImportMessage('Starting import...')
    addConsoleLog('Importing face data...')
    addConsoleLog('This may take several minutes for large datasets...')
    
    // Start progress polling
    const progressInterval = setInterval(async () => {
      try {
        const progressResponse = await apiClient.getNodeProgress(currentNode.id)
        if (progressResponse.success && progressResponse.progress !== undefined) {
          setImportProgress(progressResponse.progress)
          setImportMessage(progressResponse.message || 'Processing images...')
        }
      } catch (error) {
        // Ignore progress polling errors
      }
    }, 1000) // Poll every second
    
    try {
      const response = await apiClient.importFaceData(currentNode.id, currentNode.parameters?.input_dir || '')
      clearInterval(progressInterval) // Stop polling
      
      if (response.success) {
        setImportProgress(100)
        setImportMessage('Import completed!')
        addConsoleLog(`Imported ${response.faces_imported} faces (${response.faces_with_data} had embedded data)`)
        addConsoleLog(`Landmarks found: ${response.faces_with_landmarks || 0}`)
        addConsoleLog(`Segmentation polygons found: ${response.faces_with_segmentation || 0}`)
        addConsoleLog(`Total images processed: ${response.total_images}`)
        
        // Mark all face images as having face data (they now have imported metadata)
        setFaceImages(prev => prev.map(face => ({
          ...face,
          hasFaceData: true
        })))
        
        addConsoleLog('Face thumbnails now show blue outline indicating imported face data')
      } else {
        setImportMessage('Import failed')
        addConsoleLog(`Error: ${response.message}`)
      }
    } catch (error) {
      clearInterval(progressInterval) // Stop polling
      setImportMessage('Import failed')
      addConsoleLog(`Error: ${error}`)
    } finally {
      setLoading(false)
      // Keep progress bar visible for a moment to show completion
      setTimeout(() => {
        setIsImporting(false)
        setImportProgress(0)
        setImportMessage('')
      }, 2000)
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
            
            {/* Overlay Toggle Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSegmentation(!showSegmentation)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                  showSegmentation
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {showSegmentation ? 'Hide' : 'Show'} Segmentation
              </button>
              <button
                onClick={() => setShowAlignments(!showAlignments)}
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Face Grid */}
        <div className="flex-1 overflow-hidden">
          <OptimizedFaceGrid
            faceImages={faceImages}
            showSegmentation={showSegmentation}
            showAlignments={showAlignments}
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
