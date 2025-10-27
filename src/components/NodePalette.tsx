import React, { useState, useEffect } from 'react'
import { NodeDefinition } from '../types'
import { apiClient } from '../services/api'

const NodePalette: React.FC = () => {
  const [nodeDefinitions, setNodeDefinitions] = useState<NodeDefinition[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNodeDefinitions()
  }, [])

  const loadNodeDefinitions = async () => {
    try {
      setLoading(true)
      const definitions = await apiClient.getNodeDefinitions()
      const cats = await apiClient.getNodeCategories()
      
      setNodeDefinitions(definitions)
      setCategories(['All', ...cats])
    } catch (error) {
      console.error('Failed to load node definitions:', error)
    } finally {
      setLoading(false)
    }
  }

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const filteredNodes = selectedCategory === 'All' 
    ? nodeDefinitions 
    : nodeDefinitions.filter(node => node.category === selectedCategory)

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

  const getNodeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'video_input':
      case 'image_input':
        return 'bg-blue-100 border-blue-300'
      case 'extract_faces':
      case 'train_model':
      case 'merge_faces':
        return 'bg-green-100 border-green-300'
      case 'video_output':
      case 'image_output':
        return 'bg-purple-100 border-purple-300'
      case 'xseg_editor':
      case 'denoise':
      case 'enhance_faces':
        return 'bg-yellow-100 border-yellow-300'
      default:
        return 'bg-gray-100 border-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading nodes...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Category Filter */}
      <div className="p-4 border-b border-gray-200">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredNodes.map((node) => (
          <div
            key={node.id}
            className={`p-3 rounded-lg border-2 cursor-move hover:shadow-md transition-shadow ${getNodeColor(node.type)}`}
            draggable
            onDragStart={(event) => onDragStart(event, node.type)}
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getNodeIcon(node.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-800 truncate">
                  {node.name}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {node.description}
                </div>
              </div>
            </div>
            
            {/* Port indicators */}
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>{node.inputs.length} inputs</span>
              <span>{node.outputs.length} outputs</span>
            </div>
          </div>
        ))}
        
        {filteredNodes.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No nodes found in this category
          </div>
        )}
      </div>
    </div>
  )
}

export default NodePalette
