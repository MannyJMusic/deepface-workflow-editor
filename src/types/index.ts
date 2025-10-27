export enum NodeStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  ERROR = 'error',
  PAUSED = 'paused'
}

export enum NodeType {
  VIDEO_INPUT = 'video_input',
  IMAGE_INPUT = 'image_input',
  EXTRACT_FACES = 'extract_faces',
  TRAIN_MODEL = 'train_model',
  MERGE_FACES = 'merge_faces',
  VIDEO_OUTPUT = 'video_output',
  IMAGE_OUTPUT = 'image_output',
  XSEG_EDITOR = 'xseg_editor',
  DENOISE = 'denoise',
  ENHANCE_FACES = 'enhance_faces'
}

export enum PortType {
  VIDEO = 'video',
  IMAGES = 'images',
  FACES = 'faces',
  MODEL = 'model',
  MASK = 'mask'
}

export enum GPUType {
  NVIDIA = 'nvidia',
  AMD = 'amd',
  INTEL = 'intel',
  CPU = 'cpu',
  UNKNOWN = 'unknown'
}

export interface GPUInfo {
  id: number
  name: string
  type: GPUType
  memory_total: number  // MB
  memory_used: number   // MB
  memory_free: number   // MB
  utilization: number   // Percentage
  temperature?: number  // Celsius
  power_usage?: number  // Watts
  driver_version?: string
  cuda_version?: string
  is_available: boolean
}

export interface NodePort {
  id: string
  type: PortType
  label: string
  required?: boolean
}

export interface NodeDefinition {
  id: string
  type: NodeType
  name: string
  description: string
  inputs: NodePort[]
  outputs: NodePort[]
  parameters: Record<string, any>
  category: string
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  parameters: Record<string, any>
  status: NodeStatus
  progress: number
  message: string
  inputs: Record<string, string>
  outputs: Record<string, string>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  created_at: string
  updated_at: string
  version: string
}

export interface ExecutionStatus {
  IDLE: 'idle'
  RUNNING: 'running'
  COMPLETED: 'completed'
  ERROR: 'error'
  PAUSED: 'paused'
}

export interface WorkflowExecution {
  workflow_id: string
  status: keyof ExecutionStatus
  current_node?: string
  progress: number
  message: string
  started_at?: string
  completed_at?: string
  error?: string
}

export interface ProgressUpdate {
  node_id: string
  progress: number
  status: NodeStatus
  message: string
  current_iter?: number
  eta?: string
}

export interface GPUInfo {
  id: number
  name: string
  memory_total: number
  memory_used: number
  memory_free: number
  utilization: number
  temperature?: number
  memory_percent: number
}

export interface NodePreset {
  id: string
  name: string
  description?: string
  nodeType: NodeType
  parameters: Record<string, any>
  created_at: string
  updated_at: string
}

export type ViewMode = 'workflow' | 'single-node'
