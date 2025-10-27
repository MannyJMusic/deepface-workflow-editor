import React, { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  useReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWorkflowStore } from '../stores/workflowStore'
import { WorkflowNode, WorkflowEdge, NodeType, NodePreset } from '../types'
import CustomNode from '../nodes/CustomNode'
import { apiClient } from '../services/api'

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

const edgeTypes: EdgeTypes = {}

const WorkflowCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    addEdge,
    removeNode,
    removeEdge,
    setSelectedNode,
  } = useWorkflowStore()

  const reactFlowInstance = useReactFlow()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    presets: NodePreset[]
  }>({
    visible: false,
    x: 0,
    y: 0,
    presets: []
  })

  // Convert our nodes to ReactFlow format
  const reactFlowNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    type: 'custom',
    position: node.position,
    data: {
      ...node,
      onSelect: () => setSelectedNode(node),
      onUpdate: (updates: Partial<WorkflowNode>) => {
        useWorkflowStore.getState().updateNode(node.id, updates)
      },
    },
  }))

  // Convert our edges to ReactFlow format
  const reactFlowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#3b82f6',
    },
    style: {
      strokeWidth: 2,
      stroke: '#3b82f6',
    },
  }))

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: WorkflowEdge = {
        id: `edge-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle!,
        targetHandle: params.targetHandle!,
      }
      addEdge(newEdge)
    },
    [addEdge]
  )

  const onNodesChange = useCallback(
    (changes: any[]) => {
      // Handle node changes (position updates, etc.)
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const nodeId = change.id
          const position = change.position
          useWorkflowStore.getState().updateNode(nodeId, { position })
        }
      })
    },
    []
  )

  const onEdgesChange = useCallback(
    (changes: any[]) => {
      // Handle edge changes
      console.log('Edge changes:', changes)
    },
    []
  )

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const workflowNode = nodes.find((n) => n.id === node.id)
      if (workflowNode) {
        setSelectedNode(workflowNode)
      }
    },
    [nodes, setSelectedNode]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const workflowNode = nodes.find((n) => n.id === node.id)
      if (workflowNode) {
        useWorkflowStore.getState().updateNode(node.id, { position: node.position })
      }
    },
    [nodes]
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!reactFlowBounds || !reactFlowInstance) return

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: type as NodeType,
        position,
        parameters: {},
        status: 'idle' as any,
        progress: 0,
        message: '',
        inputs: {},
        outputs: {},
      }

      addNode(newNode)
    },
    [reactFlowInstance, addNode]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // Context menu handlers
  const onPaneContextMenu = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault()
    
    try {
      const presets = await apiClient.listNodePresets()
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        presets
      })
    } catch (error) {
      console.error('Failed to load presets for context menu:', error)
    }
  }, [])

  const handlePresetLoad = useCallback(async (preset: NodePreset) => {
    if (!reactFlowInstance) return

    try {
      const position = reactFlowInstance.screenToFlowPosition({
        x: contextMenu.x,
        y: contextMenu.y,
      })

      const workflowNode = await apiClient.loadPresetIntoWorkflow(preset.id, position)
      addNode(workflowNode)
      setContextMenu({ ...contextMenu, visible: false })
    } catch (error) {
      console.error('Failed to load preset into workflow:', error)
    }
  }, [reactFlowInstance, contextMenu, addNode])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ ...contextMenu, visible: false })
  }, [contextMenu])

  return (
    <div className="flex-1" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.type === 'input') return '#0041d0'
            if (n.type === 'output') return '#ff0072'
            return '#1a192b'
          }}
          nodeColor={(n) => {
            if (n.type === 'input') return '#0041d0'
            if (n.type === 'output') return '#ff0072'
            return '#1a192b'
          }}
          nodeBorderRadius={2}
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-48 transition-colors duration-300"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300">
            Load Preset
          </div>
          {contextMenu.presets.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
              No presets available
            </div>
          ) : (
            contextMenu.presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetLoad(preset)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <div className="font-medium">{preset.name}</div>
                {preset.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate transition-colors duration-300">
                    {preset.description}
                  </div>
                )}
                <div className="text-xs text-gray-400 dark:text-gray-500 transition-colors duration-300">
                  {preset.nodeType}
                </div>
              </button>
            ))
          )}
        </div>
      )}
      
      {/* Overlay to close context menu */}
      {contextMenu.visible && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeContextMenu}
        />
      )}
    </div>
  )
}

export default WorkflowCanvas
