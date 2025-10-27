from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum
from datetime import datetime

class NodeStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    PAUSED = "paused"

class NodeType(str, Enum):
    VIDEO_INPUT = "video_input"
    IMAGE_INPUT = "image_input"
    EXTRACT_FACES = "extract_faces"
    TRAIN_MODEL = "train_model"
    MERGE_FACES = "merge_faces"
    VIDEO_OUTPUT = "video_output"
    IMAGE_OUTPUT = "image_output"
    XSEG_EDITOR = "xseg_editor"
    DENOISE = "denoise"
    ENHANCE_FACES = "enhance_faces"
    UTILITY = "utility"

class PortType(str, Enum):
    VIDEO = "video"
    IMAGES = "images"
    FACES = "faces"
    MODEL = "model"
    MASK = "mask"
    FILES = "files"

class GPUType(str, Enum):
    NVIDIA = "nvidia"
    AMD = "amd"
    INTEL = "intel"
    CPU = "cpu"
    UNKNOWN = "unknown"

class ErrorSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(str, Enum):
    VALIDATION = "validation"
    EXECUTION = "execution"
    RESOURCE = "resource"
    NETWORK = "network"
    PERMISSION = "permission"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"
    UNKNOWN = "unknown"

class GPUInfo(BaseModel):
    id: int
    name: str
    type: GPUType
    memory_total: int  # MB
    memory_used: int   # MB
    memory_free: int   # MB
    utilization: int   # Percentage
    temperature: Optional[int] = None  # Celsius
    power_usage: Optional[int] = None  # Watts
    driver_version: Optional[str] = None
    cuda_version: Optional[str] = None
    is_available: bool = True

class ErrorInfo(BaseModel):
    id: str
    timestamp: datetime
    severity: ErrorSeverity
    category: ErrorCategory
    message: str
    details: Dict[str, Any]
    node_id: Optional[str] = None
    workflow_id: Optional[str] = None
    execution_id: Optional[str] = None
    stack_trace: Optional[str] = None
    recoverable: bool = True
    retry_count: int = 0
    max_retries: int = 3

class NodePort(BaseModel):
    id: str
    type: PortType
    label: str
    required: bool = False

class NodeDefinition(BaseModel):
    id: str
    type: NodeType
    name: str
    description: str
    inputs: List[NodePort]
    outputs: List[NodePort]
    parameters: Dict[str, Any]
    category: str

class WorkflowNode(BaseModel):
    id: str
    type: NodeType
    position: Dict[str, float]
    parameters: Dict[str, Any]
    status: NodeStatus = NodeStatus.IDLE
    progress: float = 0.0
    message: str = ""
    inputs: Dict[str, str] = {}  # port_id -> source_node_id.port_id
    outputs: Dict[str, str] = {}  # port_id -> output_path

class WorkflowEdge(BaseModel):
    id: str
    source: str  # source_node_id
    target: str  # target_node_id
    sourceHandle: str  # source_port_id
    targetHandle: str  # target_port_id

class Workflow(BaseModel):
    id: str
    name: str
    description: str
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]
    created_at: str
    updated_at: str
    version: str = "1.0"

class ExecutionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    PAUSED = "paused"

class WorkflowExecution(BaseModel):
    workflow_id: str
    status: ExecutionStatus
    current_node: Optional[str] = None
    progress: float = 0.0
    message: str = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None

class ProgressUpdate(BaseModel):
    node_id: str
    progress: float
    status: NodeStatus
    message: str
    current_iter: Optional[int] = None
    eta: Optional[str] = None

class NodePreset(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    nodeType: NodeType
    parameters: Dict[str, Any]
    created_at: str
    updated_at: str
