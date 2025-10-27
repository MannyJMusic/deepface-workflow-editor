import React from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkflowNode, NodeStatus } from '../types'

const CustomNode: React.FC<NodeProps<WorkflowNode>> = ({ data, selected }) => {
  const getStatusColor = (status: NodeStatus) => {
    switch (status) {
      case 'idle':
        return 'border-gray-300 bg-gray-50'
      case 'running':
        return 'border-blue-400 bg-blue-50'
      case 'completed':
        return 'border-green-400 bg-green-50'
      case 'error':
        return 'border-red-400 bg-red-50'
      case 'paused':
        return 'border-yellow-400 bg-yellow-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case 'idle':
        return '⏸️'
      case 'running':
        return '▶️'
      case 'completed':
        return '✅'
      case 'error':
        return '❌'
      case 'paused':
        return '⏸️'
      default:
        return '⏸️'
    }
  }

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'video_input':
        return '🎥'
      case 'image_input':
        return '🖼️'
      case 'extract_faces':
        return '👤'
      case 'train_model':
        return '🧠'
      case 'merge_faces':
        return '🔄'
      case 'video_output':
        return '📹'
      case 'image_output':
        return '🖼️'
      case 'xseg_editor':
        return '✂️'
      case 'denoise':
        return '🔧'
      case 'enhance_faces':
        return '✨'
      default:
        return '📦'
    }
  }

  const getNodeTitle = (nodeType: string) => {
    switch (nodeType) {
      case 'video_input':
        return 'Video Input'
      case 'image_input':
        return 'Image Input'
      case 'extract_faces':
        return 'Extract Faces'
      case 'train_model':
        return 'Train Model'
      case 'merge_faces':
        return 'Merge Faces'
      case 'video_output':
        return 'Video Output'
      case 'image_output':
        return 'Image Output'
      case 'xseg_editor':
        return 'XSeg Editor'
      case 'denoise':
        return 'Denoise'
      case 'enhance_faces':
        return 'Enhance Faces'
      default:
        return 'Unknown Node'
    }
  }

  return (
    <div
      className={`min-w-[200px] rounded-lg border-2 p-3 shadow-sm transition-all ${
        selected ? 'ring-2 ring-blue-500' : ''
      } ${getStatusColor(data.status)}`}
      onClick={() => data.onSelect?.()}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getNodeIcon(data.type)}</span>
          <span className="font-medium text-sm">{getNodeTitle(data.type)}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-xs">{getStatusIcon(data.status)}</span>
          {data.progress > 0 && (
            <span className="text-xs text-gray-600">{Math.round(data.progress)}%</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {data.status === 'running' && data.progress > 0 && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Message */}
      {data.message && (
        <div className="text-xs text-gray-600 mb-2 truncate" title={data.message}>
          {data.message}
        </div>
      )}

      {/* Input Handles */}
      {data.type !== 'video_input' && data.type !== 'image_input' && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      )}

      {/* Output Handles */}
      {data.type !== 'video_output' && data.type !== 'image_output' && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="w-3 h-3 bg-green-500 border-2 border-white"
        />
      )}

      {/* Multiple handles for complex nodes */}
      {data.type === 'extract_faces' && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="video"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '30%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="images"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '70%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="faces"
            className="w-3 h-3 bg-green-500 border-2 border-white"
          />
        </>
      )}

      {data.type === 'train_model' && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="src_faces"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '30%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="dst_faces"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '70%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="model"
            className="w-3 h-3 bg-green-500 border-2 border-white"
          />
        </>
      )}

      {data.type === 'merge_faces' && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="model"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '20%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="dst_video"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '40%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="dst_faces"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '60%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="mask"
            className="w-3 h-3 bg-blue-500 border-2 border-white"
            style={{ top: '80%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="merged_video"
            className="w-3 h-3 bg-green-500 border-2 border-white"
            style={{ top: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="merged_images"
            className="w-3 h-3 bg-green-500 border-2 border-white"
            style={{ top: '70%' }}
          />
        </>
      )}
    </div>
  )
}

export default CustomNode
