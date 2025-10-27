from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import asyncio
from pathlib import Path

from schemas.schemas import WorkflowNode, NodeStatus
from api.websocket import websocket_manager

class BaseNode(ABC):
    def __init__(self, node: WorkflowNode):
        self.node = node
        self.status = NodeStatus.IDLE
        self.progress = 0.0
        self.message = ""
        
    @abstractmethod
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the node's operation"""
        pass
    
    async def update_progress(self, progress: float, message: str = ""):
        """Update node progress and send WebSocket update"""
        self.progress = progress
        self.message = message
        
        await websocket_manager.send_node_update(self.node.id, {
            "status": self.status,
            "progress": progress,
            "message": message
        })
    
    async def update_status(self, status: NodeStatus, message: str = ""):
        """Update node status and send WebSocket update"""
        self.status = status
        self.message = message
        
        await websocket_manager.send_node_update(self.node.id, {
            "status": status,
            "progress": self.progress,
            "message": message
        })
    
    def get_parameter(self, key: str, default: Any = None) -> Any:
        """Get a parameter value from the node configuration"""
        return self.node.parameters.get(key, default)
    
    def get_input_path(self, port_id: str) -> Optional[str]:
        """Get input path for a specific port"""
        if port_id in self.node.inputs:
            return self.node.inputs[port_id]
        return None
    
    def set_output_path(self, port_id: str, path: str):
        """Set output path for a specific port"""
        self.node.outputs[port_id] = path
    
    def validate_inputs(self) -> Dict[str, Any]:
        """Validate that all required inputs are present"""
        errors = []
        
        # This would be implemented based on node type
        # For now, return empty errors
        return {"valid": len(errors) == 0, "errors": errors}
    
    def validate_parameters(self) -> Dict[str, Any]:
        """Validate node parameters"""
        errors = []
        
        # Basic validation - check required parameters
        required_params = self.get_required_parameters()
        for param in required_params:
            if param not in self.node.parameters:
                errors.append(f"Required parameter '{param}' is missing")
        
        return {"valid": len(errors) == 0, "errors": errors}
    
    def get_required_parameters(self) -> list:
        """Get list of required parameters for this node type"""
        # Override in subclasses
        return []
    
    async def log_message(self, level: str, message: str):
        """Send log message via WebSocket"""
        await websocket_manager.send_log_message(self.node.id, level, message)
    
    def create_output_directory(self, base_path: str, node_id: str) -> Path:
        """Create output directory for this node"""
        output_dir = Path(base_path) / "outputs" / node_id
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir
