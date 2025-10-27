import os
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from nodes.base_node import BaseNode
from schemas.schemas import NodeStatus, WorkflowNode
from api.websocket import websocket_manager

class VideoInputNode(BaseNode):
    """Node for extracting frames from video files using DeepFaceLab's VideoEd.py"""
    
    def __init__(self, node: WorkflowNode):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["input_file", "output_dir"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute video extraction"""
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting video extraction...")
            
            # Get parameters
            input_file = self.get_parameter("input_file")
            output_dir = self.get_parameter("output_dir")
            fps = self.get_parameter("fps", 0)  # 0 = full fps
            output_ext = self.get_parameter("output_ext", "png")
            
            # Create output directory
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Update progress
            await self.update_progress(10, "Preparing extraction...")
            
            # Call DeepFaceLab's VideoEd.extract_video function
            # We'll use subprocess to call the main.py script
            dfl_path = Path(__file__).parent.parent.parent.parent / "DeepFaceLab_Linux" / "DeepFaceLab"
            main_script = dfl_path / "main.py"
            
            if not main_script.exists():
                raise FileNotFoundError(f"DeepFaceLab main.py not found at {main_script}")
            
            # Build command
            cmd = [
                "python3", str(main_script),
                "videoed", "extract-video",
                "--input-file", str(input_file),
                "--output-dir", str(output_dir),
                "--output-ext", output_ext,
                "--fps", str(fps)
            ]
            
            await self.update_progress(20, "Extracting video frames...")
            
            # Execute command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(dfl_path)
            )
            
            # Monitor progress (simplified - in real implementation, you'd parse ffmpeg output)
            _, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise RuntimeError(f"Video extraction failed: {stderr.decode()}")
            
            # Count extracted frames
            frame_count = len(list(output_path.glob(f"*.{output_ext}")))
            
            await self.update_progress(100, f"Extracted {frame_count} frames")
            
            # Send WebSocket update
            await websocket_manager.send_log_message(
                node_id=self.node.id,
                level="info",
                message=f"Video extraction completed: {frame_count} frames extracted"
            )
            
            # Set output path
            self.set_output_path("video_frames", str(output_dir))
            
            return {
                "success": True,
                "output_path": str(output_dir),
                "frame_count": frame_count,
                "format": output_ext,
                "fps": fps
            }
            
        except Exception as e:
            error_msg = f"Video extraction failed: {str(e)}"
            await self.update_status(NodeStatus.ERROR, error_msg)
            
            await websocket_manager.send_log_message(
                node_id=self.node.id,
                level="error",
                message=error_msg
            )
            
            return {"success": False, "error": error_msg}
    
    @classmethod
    def get_parameter_schema(cls) -> Dict[str, Any]:
        """Return parameter schema for this node type"""
        return {
            "type": "object",
            "properties": {
                "input_file": {
                    "type": "string",
                    "title": "Input Video File",
                    "description": "Path to the input video file",
                    "format": "file-path"
                },
                "output_dir": {
                    "type": "string",
                    "title": "Output Directory",
                    "description": "Directory to save extracted frames",
                    "format": "directory-path"
                },
                "fps": {
                    "type": "integer",
                    "title": "FPS",
                    "description": "Frames per second to extract (0 = full fps)",
                    "minimum": 0,
                    "default": 0
                },
                "output_ext": {
                    "type": "string",
                    "title": "Output Format",
                    "description": "Image format for extracted frames",
                    "enum": ["png", "jpg"],
                    "default": "png"
                }
            },
            "required": ["input_file", "output_dir"]
        }
