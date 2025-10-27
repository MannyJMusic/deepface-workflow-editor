import os
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from nodes.base_node import BaseNode
from schemas.schemas import NodeStatus, WorkflowNode
from api.websocket import websocket_manager

class VideoOutputNode(BaseNode):
    """Node for creating video from image sequences using DeepFaceLab's VideoEd.py"""
    
    def __init__(self, node: WorkflowNode):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["input_dir", "output_file"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute video composition"""
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting video composition...")
            
            # Get parameters
            input_dir = self.get_parameter("input_dir")
            output_file = self.get_parameter("output_file")
            reference_file = self.get_parameter("reference_file", "")
            ext = self.get_parameter("ext", "png")
            fps = self.get_parameter("fps", None)
            bitrate = self.get_parameter("bitrate", None)
            include_audio = self.get_parameter("include_audio", False)
            lossless = self.get_parameter("lossless", False)
            
            # Create output directory if needed
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Update progress
            await self.update_progress(10, "Preparing composition...")
            
            # Call DeepFaceLab's VideoEd.video_from_sequence function
            dfl_path = Path(__file__).parent.parent.parent.parent / "DeepFaceLab_Linux" / "DeepFaceLab"
            main_script = dfl_path / "main.py"
            
            if not main_script.exists():
                raise FileNotFoundError(f"DeepFaceLab main.py not found at {main_script}")
            
            # Build command
            cmd = [
                "python3", str(main_script),
                "videoed", "video-from-sequence",
                "--input-dir", str(input_dir),
                "--output-file", str(output_file),
                "--ext", ext
            ]
            
            # Add optional parameters
            if reference_file:
                cmd.extend(["--reference-file", str(reference_file)])
            if fps is not None:
                cmd.extend(["--fps", str(fps)])
            if bitrate is not None:
                cmd.extend(["--bitrate", str(bitrate)])
            if include_audio:
                cmd.append("--include-audio")
            if lossless:
                cmd.append("--lossless")
            
            await self.update_progress(20, "Composing video...")
            
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
                raise RuntimeError(f"Video composition failed: {stderr.decode()}")
            
            # Verify output file was created
            if not output_path.exists():
                raise RuntimeError("Output video file was not created")
            
            file_size = output_path.stat().st_size
            
            await self.update_progress(100, "Video composed successfully")
            
            # Send WebSocket update
            await websocket_manager.send_log_message(
                node_id=self.node.id,
                level="info",
                message=f"Video composition completed: {output_file} ({file_size} bytes)"
            )
            
            # Set output path
            self.set_output_path("output_video", str(output_file))
            
            return {
                "success": True,
                "output_path": str(output_file),
                "file_size": file_size,
                "format": output_path.suffix[1:],  # Remove the dot
                "fps": fps,
                "bitrate": bitrate
            }
            
        except Exception as e:
            error_msg = f"Video composition failed: {str(e)}"
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
                "input_dir": {
                    "type": "string",
                    "title": "Input Directory",
                    "description": "Directory containing image sequence",
                    "format": "directory-path"
                },
                "output_file": {
                    "type": "string",
                    "title": "Output Video File",
                    "description": "Path for the output video file",
                    "format": "file-path"
                },
                "reference_file": {
                    "type": "string",
                    "title": "Reference File",
                    "description": "Reference video file for FPS and audio (optional)",
                    "format": "file-path"
                },
                "ext": {
                    "type": "string",
                    "title": "Image Format",
                    "description": "Format of input images",
                    "enum": ["png", "jpg"],
                    "default": "png"
                },
                "fps": {
                    "type": "integer",
                    "title": "FPS",
                    "description": "Output video FPS (overridden by reference file)",
                    "minimum": 1
                },
                "bitrate": {
                    "type": "integer",
                    "title": "Bitrate",
                    "description": "Output video bitrate in Megabits",
                    "minimum": 1
                },
                "include_audio": {
                    "type": "boolean",
                    "title": "Include Audio",
                    "description": "Include audio from reference file",
                    "default": False
                },
                "lossless": {
                    "type": "boolean",
                    "title": "Lossless",
                    "description": "Use lossless codec (PNG)",
                    "default": False
                }
            },
            "required": ["input_dir", "output_file"]
        }
