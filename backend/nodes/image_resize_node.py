import asyncio
from typing import Dict, Any, List
from pathlib import Path
from PIL import Image
import os

from nodes.base_node import BaseNode
from schemas.schemas import WorkflowNode, NodeStatus
from api.websocket import websocket_manager


class ImageResizeNode(BaseNode):
    """Image resize node for resizing images to specified dimensions"""
    
    def __init__(self, node: WorkflowNode):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["input_dir", "output_dir", "width", "height"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute image resizing"""
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting image resize...")
            
            # Get parameters
            input_dir = self.get_parameter("input_dir")
            output_dir = self.get_parameter("output_dir")
            width = self.get_parameter("width", 512)
            height = self.get_parameter("height", 512)
            maintain_aspect = self.get_parameter("maintain_aspect", True)
            
            input_path = Path(input_dir)
            output_path = Path(output_dir)
            
            if not input_path.exists():
                return {"success": False, "error": f"Input directory does not exist: {input_path}"}
            
            # Create output directory
            output_path.mkdir(parents=True, exist_ok=True)
            
            await self.update_progress(10, "Scanning for images...")
            
            # Find all image files
            image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']
            image_files = []
            for ext in image_extensions:
                image_files.extend(input_path.glob(f"*{ext}"))
                image_files.extend(input_path.glob(f"*{ext.upper()}"))
            
            if not image_files:
                return {"success": False, "error": "No image files found in input directory"}
            
            await self.log_message("info", f"Found {len(image_files)} images to resize")
            await self.update_progress(20, f"Resizing {len(image_files)} images...")
            
            # Resize images
            resized_count = 0
            for i, image_file in enumerate(image_files):
                try:
                    # Load image
                    with Image.open(image_file) as img:
                        # Calculate new dimensions
                        if maintain_aspect:
                            img.thumbnail((width, height), Image.Resampling.LANCZOS)
                            _, _ = img.size  # Get dimensions but don't use them
                        else:
                            img = img.resize((width, height), Image.Resampling.LANCZOS)
                        
                        # Save resized image
                        output_file = output_path / f"resized_{image_file.name}"
                        img.save(output_file, quality=95)
                        
                        resized_count += 1
                        
                        # Update progress
                        progress = 20 + (i + 1) / len(image_files) * 70
                        await self.update_progress(progress, f"Resized {i + 1}/{len(image_files)} images")
                        
                        await self.log_message("info", f"Resized {image_file.name} -> {output_file.name}")
                        
                except Exception as e:
                    await self.log_message("error", f"Failed to resize {image_file.name}: {str(e)}")
                    continue
            
            await self.update_progress(100, "Image resize completed")
            await self.log_message("info", f"Successfully resized {resized_count} images")
            
            # Set output path
            self.set_output_path("output_dir", str(output_path))
            
            return {
                "success": True,
                "output_path": str(output_path),
                "images_processed": resized_count,
                "total_images": len(image_files),
                "message": f"Successfully resized {resized_count} images"
            }
            
        except Exception as e:
            error_msg = f"Image resize failed: {str(e)}"
            await self.update_status(NodeStatus.ERROR, error_msg)
            await self.log_message("error", error_msg)
            return {"success": False, "error": error_msg}
