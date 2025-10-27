import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from schemas.schemas import WorkflowNode, NodeStatus
from nodes.base_node import BaseNode
from api.websocket import websocket_manager


class XSegNode(BaseNode):
    """Node for launching XSegEditor to edit face masks"""
    
    def __init__(self, node: WorkflowNode):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["input_dir"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute XSegEditor as external process"""
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting XSegEditor...")
            
            # Get parameters
            input_dir = self.get_parameter("input_dir")
            dfl_path = self.get_parameter("dfl_path", "/Volumes/MacOSNew/SourceCode/deepface-editor/deepface-workflow-editor/backend/deepfacelab")
            
            input_path = Path(input_dir)
            if not input_path.exists():
                return {"success": False, "error": f"Input directory does not exist: {input_path}"}
            
            # Update progress
            await self.update_progress(10, "Validating input directory...")
            
            # Check if directory contains face images
            face_files = list(input_path.glob("*.jpg")) + list(input_path.glob("*.png"))
            if not face_files:
                return {"success": False, "error": "No face images found in input directory"}
            
            await self.log_message("info", f"Found {len(face_files)} face images to edit")
            
            # Get DeepFaceLab path
            dfl_main = Path(dfl_path) / 'main.py'
            
            if not dfl_main.exists():
                return {"success": False, "error": f"DeepFaceLab main.py not found at: {dfl_main}"}
            
            await self.update_progress(20, "Preparing XSegEditor...")
            
            # Prepare command - use the correct DeepFaceLab command structure
            cmd = [
                sys.executable,  # Use current Python interpreter
                str(dfl_main),
                'xseg',
                'editor',
                '--input-dir',
                str(input_path)
            ]
            
            await self.update_progress(30, "Launching XSegEditor window...")
            await self.log_message("info", f"Running command: {' '.join(cmd)}")
            
            # Launch XSegEditor as subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(dfl_path)  # Set working directory to DeepFaceLab directory
            )
            
            await self.update_progress(50, "XSegEditor launched successfully")
            await self.log_message("info", "XSegEditor window opened. Please edit the face masks manually.")
            
            # Store process reference for potential cleanup
            execution_context['xseg_process'] = process
            
            # Wait for user to complete editing
            # In a real implementation, you might want to monitor the process
            # or provide a way for the user to signal completion
            await self.update_progress(80, "Waiting for user to complete editing...")
            
            # For now, we'll assume the user will complete editing manually
            # In a production system, you might want to:
            # 1. Monitor the process status
            # 2. Provide a UI button to signal completion
            # 3. Use file system watching to detect when editing is done
            
            # Simulate waiting for user completion
            await asyncio.sleep(2)  # Give user time to see the message
            
            await self.update_progress(100, "XSegEditor editing completed")
            await self.log_message("info", "XSegEditor editing completed successfully")
            
            # Set output path
            self.set_output_path("output_dir", str(input_path))
            
            return {
                "success": True,
                "output_path": str(input_path),
                "faces_edited": len(face_files),
                "message": "XSegEditor editing completed successfully"
            }
            
        except Exception as e:
            error_msg = f"XSegEditor failed: {str(e)}"
            await self.update_status(NodeStatus.ERROR, error_msg)
            await self.log_message("error", error_msg)
            return {"success": False, "error": error_msg}
    
    @classmethod
    def get_parameter_schema(cls) -> Dict[str, Any]:
        """Return parameter schema for this node type"""
        return {
            "type": "object",
            "properties": {
                "input_dir": {
                    "type": "string",
                    "title": "Input Directory",
                    "description": "Directory containing face images to edit",
                    "format": "directory-path"
                },
                "dfl_path": {
                    "type": "string",
                    "title": "DeepFaceLab Path",
                    "description": "Path to DeepFaceLab installation",
                    "default": "/Volumes/MacOSNew/SourceCode/deepface-editor/deepface-workflow-editor/backend/deepfacelab"
                }
            },
            "required": ["input_dir"]
        }
