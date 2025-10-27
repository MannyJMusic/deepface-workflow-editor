import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  Workflow, 
  WorkflowNode, 
  WorkflowEdge, 
  NodeDefinition, 
  WorkflowExecution,
  NodeStatus,
  NodeType,
  ViewMode
} from '../types'

interface WorkflowStore {
  // Workflow state
  currentWorkflow: Workflow | null
  workflows: Workflow[]
  
  // Node state
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNode: WorkflowNode | null
  
  // Execution state
  execution: WorkflowExecution | null
  isExecuting: boolean
  
  // Node definitions
  nodeDefinitions: NodeDefinition[]
  
  // View mode state
  viewMode: ViewMode
  activeNodeInSingleMode: WorkflowNode | null
  
  // Actions
  setCurrentWorkflow: (workflow: Workflow | null) => void
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: WorkflowEdge[]) => void
  addNode: (node: WorkflowNode) => void
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  removeNode: (nodeId: string) => void
  addEdge: (edge: WorkflowEdge) => void
  removeEdge: (edgeId: string) => void
  setSelectedNode: (node: WorkflowNode | null) => void
  
  // Execution actions
  setExecution: (execution: WorkflowExecution | null) => void
  setIsExecuting: (isExecuting: boolean) => void
  updateNodeStatus: (nodeId: string, status: NodeStatus, progress?: number, message?: string) => void
  
  // Node definitions
  setNodeDefinitions: (definitions: NodeDefinition[]) => void
  
  // Workflow management
  saveWorkflow: () => Promise<void>
  loadWorkflow: (workflowId: string) => Promise<void>
  createNewWorkflow: () => void
  
  // File operations
  saveWorkflowToFile: () => Promise<void>
  loadWorkflowFromFile: () => Promise<void>
  exportWorkflow: () => Promise<string>
  importWorkflow: (workflowData: string) => Promise<void>
  
  // Templates
  loadTemplate: (templateName: string) => Promise<void>
  saveAsTemplate: (templateName: string) => Promise<void>
  
  // View mode actions
  setViewMode: (mode: ViewMode) => void
  setActiveNodeInSingleMode: (node: WorkflowNode | null) => void
  createNodeForSingleMode: (nodeType: NodeType) => void
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentWorkflow: null,
      workflows: [],
      nodes: [],
      edges: [],
      selectedNode: null,
      execution: null,
      isExecuting: false,
      nodeDefinitions: [],
      viewMode: 'single-node',
      activeNodeInSingleMode: null,
      
      // Workflow actions
      setCurrentWorkflow: (workflow) => {
        set({ currentWorkflow: workflow })
        if (workflow) {
          set({ nodes: workflow.nodes, edges: workflow.edges })
        }
      },
      
      setNodes: (nodes) => {
        set({ nodes })
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              nodes,
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      setEdges: (edges) => {
        set({ edges })
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              edges,
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      addNode: (node) => {
        const { nodes } = get()
        set({ nodes: [...nodes, node] })
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              nodes: [...nodes, node],
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      updateNode: (nodeId, updates) => {
        const { nodes } = get()
        const updatedNodes = nodes.map(node => 
          node.id === nodeId ? { ...node, ...updates } : node
        )
        set({ nodes: updatedNodes })
        
        // Update selected node if it's the one being updated
        const { selectedNode } = get()
        if (selectedNode && selectedNode.id === nodeId) {
          set({ selectedNode: { ...selectedNode, ...updates } })
        }
        
        // Update activeNodeInSingleMode if it's the one being updated
        const { activeNodeInSingleMode } = get()
        if (activeNodeInSingleMode && activeNodeInSingleMode.id === nodeId) {
          set({ activeNodeInSingleMode: { ...activeNodeInSingleMode, ...updates } })
        }
        
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              nodes: updatedNodes,
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      removeNode: (nodeId) => {
        const { nodes, edges } = get()
        const updatedNodes = nodes.filter(node => node.id !== nodeId)
        const updatedEdges = edges.filter(edge => 
          edge.source !== nodeId && edge.target !== nodeId
        )
        
        set({ nodes: updatedNodes, edges: updatedEdges })
        
        // Clear selection if selected node was removed
        const { selectedNode } = get()
        if (selectedNode && selectedNode.id === nodeId) {
          set({ selectedNode: null })
        }
        
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              nodes: updatedNodes,
              edges: updatedEdges,
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      addEdge: (edge) => {
        const { edges } = get()
        set({ edges: [...edges, edge] })
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              edges: [...edges, edge],
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      removeEdge: (edgeId) => {
        const { edges } = get()
        const updatedEdges = edges.filter(edge => edge.id !== edgeId)
        set({ edges: updatedEdges })
        
        const { currentWorkflow } = get()
        if (currentWorkflow) {
          set({ 
            currentWorkflow: { 
              ...currentWorkflow, 
              edges: updatedEdges,
              updated_at: new Date().toISOString()
            }
          })
        }
      },
      
      setSelectedNode: (node) => {
        set({ selectedNode: node })
      },
      
      // Execution actions
      setExecution: (execution) => {
        set({ execution })
      },
      
      setIsExecuting: (isExecuting) => {
        set({ isExecuting })
      },
      
      updateNodeStatus: (nodeId, status, progress = 0, message = '') => {
        const { nodes } = get()
        const updatedNodes = nodes.map(node => 
          node.id === nodeId 
            ? { ...node, status, progress, message }
            : node
        )
        set({ nodes: updatedNodes })
        
        // Update selected node if it's the one being updated
        const { selectedNode } = get()
        if (selectedNode && selectedNode.id === nodeId) {
          set({ selectedNode: { ...selectedNode, status, progress, message } })
        }
      },
      
      // Node definitions
      setNodeDefinitions: (definitions) => {
        set({ nodeDefinitions: definitions })
      },
      
      // Workflow management
      saveWorkflow: async () => {
        const { currentWorkflow } = get()
        if (!currentWorkflow) return
        
        try {
          // This would call the API to save the workflow
          console.log('Saving workflow:', currentWorkflow)
          // await api.saveWorkflow(currentWorkflow)
        } catch (error) {
          console.error('Failed to save workflow:', error)
        }
      },
      
      loadWorkflow: async (workflowId) => {
        try {
          // This would call the API to load the workflow
          console.log('Loading workflow:', workflowId)
          // const workflow = await api.loadWorkflow(workflowId)
          // set({ currentWorkflow: workflow, nodes: workflow.nodes, edges: workflow.edges })
        } catch (error) {
          console.error('Failed to load workflow:', error)
        }
      },
      
      createNewWorkflow: () => {
        const newWorkflow: Workflow = {
          id: '',
          name: 'New Workflow',
          description: '',
          nodes: [],
          edges: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '1.0'
        }
        
        set({ 
          currentWorkflow: newWorkflow,
          nodes: [],
          edges: [],
          selectedNode: null
        })
      },
      
      // File operations
      saveWorkflowToFile: async () => {
        const { currentWorkflow } = get()
        if (!currentWorkflow) return
        
        try {
          const workflowData = JSON.stringify(currentWorkflow, null, 2)
          
          // Use Electron's file dialog if available
          if (globalThis.electronAPI) {
            const result = await globalThis.electronAPI.showSaveDialog({
              title: 'Save Workflow',
              defaultPath: `${currentWorkflow.name || 'workflow'}.json`,
              filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            })
            
            if (!result.canceled && result.filePath) {
              await globalThis.electronAPI.writeFile(result.filePath, workflowData)
              console.log('Workflow saved to:', result.filePath)
            }
          } else {
            // Fallback for web version - download file
            const blob = new Blob([workflowData], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${currentWorkflow.name || 'workflow'}.json`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
          }
        } catch (error) {
          console.error('Failed to save workflow to file:', error)
        }
      },
      
      loadWorkflowFromFile: async () => {
        try {
          let workflowData: string
          
          // Use Electron's file dialog if available
          if (globalThis.electronAPI) {
            const result = await globalThis.electronAPI.showOpenDialog({
              title: 'Load Workflow',
              filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              properties: ['openFile']
            })
            
            if (!result.canceled && result.filePaths.length > 0) {
              workflowData = await globalThis.electronAPI.readFile(result.filePaths[0])
            } else {
              return
            }
          } else {
            // Fallback for web version - file input
            return new Promise((resolve) => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.json'
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) {
                  workflowData = await file.text()
                  resolve(workflowData)
                }
              }
              input.click()
            })
          }
          
          if (workflowData) {
            const workflow: Workflow = JSON.parse(workflowData)
            set({ 
              currentWorkflow: workflow,
              nodes: workflow.nodes,
              edges: workflow.edges,
              selectedNode: null
            })
            console.log('Workflow loaded from file')
          }
        } catch (error) {
          console.error('Failed to load workflow from file:', error)
        }
      },
      
      exportWorkflow: async () => {
        const { currentWorkflow } = get()
        if (!currentWorkflow) return ''
        
        return JSON.stringify(currentWorkflow, null, 2)
      },
      
      importWorkflow: async (workflowData: string) => {
        try {
          const workflow: Workflow = JSON.parse(workflowData)
          set({ 
            currentWorkflow: workflow,
            nodes: workflow.nodes,
            edges: workflow.edges,
            selectedNode: null
          })
          console.log('Workflow imported successfully')
        } catch (error) {
          console.error('Failed to import workflow:', error)
          throw error
        }
      },
      
      // Templates
      loadTemplate: async (templateName: string) => {
        try {
          // Load from predefined templates
          const templates = {
            'basic-face-swap': {
              id: '',
              name: 'Basic Face Swap',
              description: 'A simple face swap workflow with video input, face extraction, training, and output',
              nodes: [
                {
                  id: 'video-input-1',
                  type: 'video_input' as NodeType,
                  position: { x: 100, y: 100 },
                  parameters: { input_file: '', output_dir: '', fps: 0, output_ext: 'png' },
                  status: 'idle' as NodeStatus,
                  progress: 0,
                  message: '',
                  inputs: {},
                  outputs: { video_frames: null }
                },
                {
                  id: 'extract-faces-1',
                  type: 'extract_faces' as NodeType,
                  position: { x: 300, y: 100 },
                  parameters: { detector: 's3fd', face_type: 'full_face', image_size: 512 },
                  status: 'idle' as NodeStatus,
                  progress: 0,
                  message: '',
                  inputs: { video: null },
                  outputs: { faces: null }
                },
                {
                  id: 'train-model-1',
                  type: 'train_model' as NodeType,
                  position: { x: 500, y: 100 },
                  parameters: { model_type: 'SAEHD', batch_size: 4, resolution: 256 },
                  status: 'idle' as NodeStatus,
                  progress: 0,
                  message: '',
                  inputs: { src_faces: null, dst_faces: null },
                  outputs: { model: null }
                },
                {
                  id: 'merge-faces-1',
                  type: 'merge_faces' as NodeType,
                  position: { x: 700, y: 100 },
                  parameters: { face_enhancer: 'none', color_transfer: 'none' },
                  status: 'idle' as NodeStatus,
                  progress: 0,
                  message: '',
                  inputs: { model: null, dst_video: null, dst_faces: null },
                  outputs: { merged_video: null }
                },
                {
                  id: 'video-output-1',
                  type: 'video_output' as NodeType,
                  position: { x: 900, y: 100 },
                  parameters: { input_dir: '', output_file: '', ext: 'png', include_audio: true },
                  status: 'idle' as NodeStatus,
                  progress: 0,
                  message: '',
                  inputs: { image_sequence: null },
                  outputs: { output_video: null }
                }
              ],
              edges: [
                {
                  id: 'edge-1',
                  source: 'video-input-1',
                  target: 'extract-faces-1',
                  sourceHandle: 'video_frames',
                  targetHandle: 'images'
                },
                {
                  id: 'edge-2',
                  source: 'extract-faces-1',
                  target: 'train-model-1',
                  sourceHandle: 'faces',
                  targetHandle: 'src_faces'
                },
                {
                  id: 'edge-3',
                  source: 'train-model-1',
                  target: 'merge-faces-1',
                  sourceHandle: 'model',
                  targetHandle: 'model'
                },
                {
                  id: 'edge-4',
                  source: 'merge-faces-1',
                  target: 'video-output-1',
                  sourceHandle: 'merged_images',
                  targetHandle: 'image_sequence'
                }
              ],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              version: '1.0'
            }
          }
          
          const template = templates[templateName as keyof typeof templates]
          if (template) {
            set({ 
              currentWorkflow: template,
              nodes: template.nodes,
              edges: template.edges,
              selectedNode: null
            })
            console.log(`Template '${templateName}' loaded successfully`)
          } else {
            throw new Error(`Template '${templateName}' not found`)
          }
        } catch (error) {
          console.error('Failed to load template:', error)
          throw error
        }
      },
      
      saveAsTemplate: async (templateName: string) => {
        const { currentWorkflow } = get()
        if (!currentWorkflow) return
        
        try {
          // Save template to localStorage for now
          const templates = JSON.parse(localStorage.getItem('workflow-templates') || '{}')
          templates[templateName] = {
            ...currentWorkflow,
            name: templateName,
            id: `template-${templateName}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          localStorage.setItem('workflow-templates', JSON.stringify(templates))
          console.log(`Template '${templateName}' saved successfully`)
        } catch (error) {
          console.error('Failed to save template:', error)
          throw error
        }
      },
      
      // View mode actions
      setViewMode: (mode) => {
        set({ viewMode: mode })
      },
      
      setActiveNodeInSingleMode: (node) => {
        set({ activeNodeInSingleMode: node })
      },
      
      createNodeForSingleMode: (nodeType) => {
        const nodeId = `single-node-${Date.now()}`
        
        // Set default parameters based on node type
        let defaultParameters: Record<string, any> = {}
        
        if (nodeType === 'xseg_editor') {
          defaultParameters = {
            input_dir: '/Volumes/MacOSNew/DFL/DeepFaceLab_MacOS/workspace/data_src/aligned', // Default to user's DFL directory
            face_type: 'full_face',
            detection_model: 'VGGFace2',
            similarity_threshold: 0.6
          }
        }
        
        const newNode: WorkflowNode = {
          id: nodeId,
          type: nodeType,
          position: { x: 0, y: 0 },
          parameters: defaultParameters,
          status: NodeStatus.IDLE,
          progress: 0,
          message: '',
          inputs: {},
          outputs: {}
        }
        set({ activeNodeInSingleMode: newNode })
      }
    }),
    {
      name: 'workflow-store',
      partialize: (state) => ({
        workflows: state.workflows,
        nodeDefinitions: state.nodeDefinitions
      })
    }
  )
)
