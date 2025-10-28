import React, { useState, useCallback, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, File, FolderOpen, AlertTriangle, CheckCircle, Upload } from 'lucide-react'
import { apiClient } from '../../services/api'

interface FileTreeNode {
  id: string
  name: string
  type: 'folder' | 'file'
  children?: FileTreeNode[]
  expanded?: boolean
  path: string
  faceCount?: number
  isValid?: boolean
  isDFLWorkspace?: boolean
}

interface FileTreePanelProps {
  inputDir?: string
  faceCount: number
  onOpenImages: (path: string) => void
  onOpenSlideshow: () => void
  onRefresh: () => void
  onWorkspaceSelect: (workspacePath: string, faceCount?: number) => void
}

const FileTreePanel: React.FC<FileTreePanelProps> = ({
  inputDir,
  faceCount = 0,
  onOpenImages,
  onOpenSlideshow,
  onRefresh,
  onWorkspaceSelect
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['workspace', 'data_src', 'aligned']))
  const [workspacePath, setWorkspacePath] = useState<string>('')
  const [isDFLWorkspace, setIsDFLWorkspace] = useState<boolean>(false)
  const [workspaceValidation, setWorkspaceValidation] = useState<{
    isValid: boolean
    message: string
    missingDirs: string[]
  }>({ isValid: false, message: '', missingDirs: [] })
  const [showPathInput, setShowPathInput] = useState<boolean>(false)
  const [pathInput, setPathInput] = useState<string>('')
  const [detectedFaceCount, setDetectedFaceCount] = useState<number>(0)

  // Check if directory is a valid DFL workspace
  const validateDFLWorkspace = useCallback(async (path: string) => {
    try {
      console.log('Validating workspace at path:', path)
      const response = await apiClient.validateWorkspace(path)
      console.log('Validation API response:', response)
      
      if (response.success) {
        setWorkspaceValidation({ 
          isValid: response.isValid, 
          message: response.message, 
          missingDirs: response.missingDirs 
        })
        setIsDFLWorkspace(response.isValid)
        setDetectedFaceCount(response.faceCount || 0)
        
        console.log('Workspace validation state updated:', {
          isValid: response.isValid,
          message: response.message,
          faceCount: response.faceCount
        })
        
        return response.isValid
      } else {
        setWorkspaceValidation({ 
          isValid: false, 
          message: response.message || 'Error validating workspace', 
          missingDirs: [] 
        })
        setIsDFLWorkspace(false)
        return false
      }
    } catch (error) {
      console.error('Error validating workspace:', error)
      setWorkspaceValidation({ 
        isValid: false, 
        message: 'Error validating workspace', 
        missingDirs: [] 
      })
      setIsDFLWorkspace(false)
      return false
    }
  }, [])

  // Handle workspace selection via Electron dialog
  const handleWorkspaceSelect = useCallback(async () => {
    try {
      // Check if we're running in Electron
      if (window.electronAPI?.showOpenDialog) {
        // Use Electron's native dialog
        const result = await window.electronAPI.showOpenDialog({
          title: 'Select DeepFaceLab Workspace Directory',
          properties: ['openDirectory'],
          filters: [{ name: 'All Files', extensions: ['*'] }]
        })
        
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0]
          console.log('Electron dialog selected path:', selectedPath)
          setWorkspacePath(selectedPath)
          
          // Validate the workspace
          await validateDFLWorkspace(selectedPath)
          console.log('Workspace validation completed')
          
          // Get face count from validation response
          const response = await apiClient.validateWorkspace(selectedPath)
          console.log('Workspace validation response:', response)
          
          // Just notify about workspace selection - don't update detection panel
          onWorkspaceSelect(selectedPath, response.faceCount)
        } else {
          console.log('User canceled directory selection')
        }
      } else {
        // Fallback to web-based directory picker
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true
        input.directory = true
        input.multiple = true
        input.style.display = 'none'
        
        // Add to DOM temporarily
        document.body.appendChild(input)
        
        input.onchange = async (e) => {
          const target = e.target as HTMLInputElement
          const files = target.files
          
          if (files && files.length > 0) {
            // Get the directory path from the first file
            const firstFile = files[0]
            const relativePath = firstFile.webkitRelativePath
            
            if (relativePath) {
              // Extract the directory name from the relative path
              const directoryName = relativePath.split('/')[0]
              
              // For web mode, we can only get the directory name, not full path
              const selectedPath = directoryName
              
              setWorkspacePath(selectedPath)
              await validateDFLWorkspace(selectedPath)
              
              // Get face count from validation response
              const response = await apiClient.validateWorkspace(selectedPath)
              
              // Just notify about workspace selection - don't update detection panel
              onWorkspaceSelect(selectedPath, response.faceCount)
            }
          }
          
          // Clean up
          input.remove()
        }
        
        input.oncancel = () => {
          // Clean up if user cancels
          input.remove()
        }
        
        // Trigger the file picker
        input.click()
      }
    } catch (error) {
      console.error('Error selecting workspace:', error)
    }
  }, [validateDFLWorkspace, onWorkspaceSelect])

  // Handle manual path input
  const handlePathInput = useCallback(async () => {
    if (pathInput.trim()) {
        const trimmedPath = pathInput.trim()
        setWorkspacePath(trimmedPath)
        await validateDFLWorkspace(trimmedPath)
      
      // Get face count from validation response
      const response = await apiClient.validateWorkspace(trimmedPath)
      
      // Just notify about workspace selection - don't update detection panel
      onWorkspaceSelect(trimmedPath, response.faceCount)
      
      setShowPathInput(false)
      setPathInput('')
    }
  }, [pathInput, validateDFLWorkspace, onWorkspaceSelect])

  // Handle path input cancel
  const handlePathInputCancel = useCallback(() => {
    setShowPathInput(false)
    setPathInput('')
  }, [])


  // Build project tree structure based on workspace
  const buildProjectTree = useCallback((): FileTreeNode[] => {
    if (!workspacePath) {
      return []
    }

    // Check if the selected path already contains 'workspace' in it
    const isWorkspacePath = workspacePath.includes('/workspace')
    
    // Create a simple structure that shows the workspace
    const tree: FileTreeNode[] = [
      {
        id: 'project',
        name: workspacePath.split('/').pop() || 'Workspace',
        type: 'folder',
        path: workspacePath,
        isDFLWorkspace: isDFLWorkspace,
        children: [
          // Only add DFL structure if we're not already in a workspace directory
          ...(isDFLWorkspace && !isWorkspacePath ? [
            {
              id: 'workspace',
              name: 'workspace',
              type: 'folder',
              path: `${workspacePath}/workspace`,
              children: [
                {
                  id: 'data_src',
                  name: 'data_src',
                  type: 'folder',
                  path: `${workspacePath}/workspace/data_src`,
                  children: [
                    {
                      id: 'aligned',
                      name: 'aligned',
                      type: 'folder',
                      path: `${workspacePath}/workspace/data_src/aligned`,
                      faceCount: detectedFaceCount,
                      children: [
                        {
                          id: 'aligned_images',
                          name: `Open images (${detectedFaceCount})`,
                          type: 'file',
                          path: `${workspacePath}/workspace/data_src/aligned`,
                          isValid: true
                        }
                      ]
                    }
                  ]
                },
                {
                  id: 'data_dst',
                  name: 'data_dst',
                  type: 'folder',
                  path: `${workspacePath}/workspace/data_dst`
                }
              ]
            }
          ] : []),
          // If we're already in a workspace directory, show the subdirectories directly
          ...(isDFLWorkspace && isWorkspacePath ? [
            {
              id: 'data_src',
              name: 'data_src',
              type: 'folder',
              path: `${workspacePath}/data_src`,
              children: [
                {
                  id: 'aligned',
                  name: 'aligned',
                  type: 'folder',
                  path: `${workspacePath}/data_src/aligned`,
                  faceCount: detectedFaceCount,
                  children: [
                    {
                      id: 'aligned_images',
                      name: `Open images (${detectedFaceCount})`,
                      type: 'file',
                      path: `${workspacePath}/data_src/aligned`,
                      isValid: true
                    }
                  ]
                }
              ]
            },
            {
              id: 'data_dst',
              name: 'data_dst',
              type: 'folder',
              path: `${workspacePath}/data_dst`
            }
          ] : [])
        ]
      }
    ]
    return tree
  }, [workspacePath, isDFLWorkspace, detectedFaceCount])

  // Handle node click
  const handleNodeClick = useCallback((node: FileTreeNode) => {
    console.log('Node clicked:', node)
    
    if (node.type === 'folder') {
      // Toggle expansion
      console.log('Toggling folder expansion for:', node.name)
      setExpandedNodes(prev => {
        const newSet = new Set(prev)
        if (newSet.has(node.id)) {
          newSet.delete(node.id)
        } else {
          newSet.add(node.id)
        }
        return newSet
      })
    } else if (node.type === 'file' && (node.name.includes('Open images') || node.name.includes('Face Images'))) {
      // Open images in this directory
      console.log('Opening images from path:', node.path)
      onOpenImages(node.path)
    } else {
      console.log('Node click ignored - not a folder or image file:', node)
    }
  }, [onOpenImages])

  // Initialize with inputDir if provided
  useEffect(() => {
    if (inputDir && inputDir !== workspacePath) {
      console.log('Initializing workspace from inputDir:', inputDir)
      setWorkspacePath(inputDir)
      validateDFLWorkspace(inputDir)
    }
  }, [inputDir, validateDFLWorkspace]) // Remove workspacePath from dependencies to prevent infinite loop

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  const renderTree = (node: FileTreeNode, level: number) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id}>
        <button
          className={`flex items-center py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded transition-colors duration-200 w-full text-left ${
            level > 0 ? `ml-${level * 4}` : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleNodeClick(node)}
          onKeyDown={(e) => {
            if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              toggleNode(node.id)
            }
          }}
          type="button"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-label={hasChildren ? `Toggle ${node.name}` : node.name}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <div className="w-4 h-4 mr-1 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
            </div>
          )}
          {!hasChildren && <div className="w-4 h-4 mr-1 flex-shrink-0"></div>}

          {/* Node Icon */}
          <div className="w-4 h-4 mr-2 flex-shrink-0">
            {node.type === 'folder' && isExpanded && (
              <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            )}
            {node.type === 'folder' && !isExpanded && (
              <Folder className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            )}
            {node.type !== 'folder' && (
              <File className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </div>

          {/* Node Name */}
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">
            {node.name}
          </span>

          {/* Validation Status */}
          {node.isDFLWorkspace && (
            <div className="ml-2">
              {workspaceValidation.isValid ? (
                <CheckCircle className="w-4 h-4 text-green-500" title={workspaceValidation.message} />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500" title={workspaceValidation.message} />
              )}
            </div>
          )}

          {/* Face Count */}
          {node.faceCount !== undefined && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              ({node.faceCount})
            </span>
          )}
        </button>

        {/* Render Children if Expanded */}
        {isExpanded && hasChildren && (
          <div className="pl-4">
            {node.children?.map(child => renderTree(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const projectTree = buildProjectTree()

  return (
    <div className="h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">
          Project Explorer
        </h3>
        
        {/* Workspace Selection */}
        <div className="mt-3">
          {workspacePath ? (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleWorkspaceSelect}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Upload className="w-4 h-4" />
                <span>Change Directory</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorkspacePath('')
                  setIsDFLWorkspace(false)
                  setWorkspaceValidation({ isValid: false, message: '', missingDirs: [] })
                  setDetectedFaceCount(0)
                }}
                className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                No workspace selected
              </p>
                
              {showPathInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    placeholder="Enter full directory path..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePathInput()
                      } else if (e.key === 'Escape') {
                        handlePathInputCancel()
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={handlePathInput}
                      className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Use Path
                    </button>
                    <button
                      type="button"
                      onClick={handlePathInputCancel}
                      className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleWorkspaceSelect}
                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 mx-auto"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Browse Directory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPathInput(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Or enter path manually
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {workspacePath && (
          <>
            {projectTree.map(node => renderTree(node, 0))}
            {!isDFLWorkspace && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                    Non-standard workspace
                  </p>
                </div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  {workspaceValidation.message}
                </p>
              </div>
            )}
          </>
        )}
        {workspacePath === '' && (
          <div className="text-center py-8">
            <Folder className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select a workspace to view files
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <button
          type="button"
          onClick={() => onOpenImages(workspacePath)}
          disabled={!workspacePath}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
        >
          Open Images
        </button>
        <button
          type="button"
          onClick={onOpenSlideshow}
          disabled={!workspacePath}
          className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors duration-200"
        >
          Open Slideshow
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}

export default FileTreePanel