import asyncio
from typing import Dict, Any, List
from pathlib import Path
import shutil

# Optional OpenCV import
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    print("Warning: OpenCV not available. Face filtering will use fallback mode.")

from nodes.base_node import BaseNode
from schemas.schemas import WorkflowNode, NodeStatus
from api.websocket import websocket_manager


class FaceFilterNode(BaseNode):
    """Face filter node for filtering faces based on quality, blur, and resolution"""
    
    def __init__(self, node: WorkflowNode):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["input_dir", "output_dir"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute face filtering"""
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting face filtering...")
            
            # Get parameters
            input_dir = self.get_parameter("input_dir")
            output_dir = self.get_parameter("output_dir")
            min_quality = self.get_parameter("min_quality", 0.5)
            max_blur = self.get_parameter("max_blur", 0.3)
            min_resolution = self.get_parameter("min_resolution", 64)
            
            input_path = Path(input_dir)
            output_path = Path(output_dir)
            
            if not input_path.exists():
                return {"success": False, "error": f"Input directory does not exist: {input_path}"}
            
            # Create output directory
            output_path.mkdir(parents=True, exist_ok=True)
            
            await self.update_progress(10, "Scanning for face images...")
            
            # Find all image files
            image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
            image_files = []
            for ext in image_extensions:
                image_files.extend(input_path.glob(f"*{ext}"))
                image_files.extend(input_path.glob(f"*{ext.upper()}"))
            
            if not image_files:
                return {"success": False, "error": "No image files found in input directory"}
            
            await self.log_message("info", f"Found {len(image_files)} face images to filter")
            await self.update_progress(20, f"Filtering {len(image_files)} face images...")
            
            # Filter images
            passed_count = 0
            failed_count = 0
            
            for i, image_file in enumerate(image_files):
                try:
                    if CV2_AVAILABLE:
                        # Use OpenCV for advanced filtering
                        img = cv2.imread(str(image_file))
                        if img is None:
                            await self.log_message("warning", f"Could not load image: {image_file.name}")
                            failed_count += 1
                            continue
                        
                        # Check resolution
                        height, width = img.shape[:2]
                        if width < min_resolution or height < min_resolution:
                            await self.log_message("info", f"Rejected {image_file.name}: resolution too low ({width}x{height})")
                            failed_count += 1
                            continue
                        
                        # Check blur (using Laplacian variance)
                        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
                        
                        if blur_score < max_blur * 100:  # Scale blur threshold
                            await self.log_message("info", f"Rejected {image_file.name}: too blurry (score: {blur_score:.2f})")
                            failed_count += 1
                            continue
                        
                        # Check quality (simplified - using image sharpness)
                        quality_score = self._calculate_image_quality(img)
                        
                        if quality_score < min_quality:
                            await self.log_message("info", f"Rejected {image_file.name}: quality too low (score: {quality_score:.2f})")
                            failed_count += 1
                            continue
                        
                        await self.log_message("info", f"Accepted {image_file.name} (quality: {quality_score:.2f}, blur: {blur_score:.2f})")
                    else:
                        # Fallback mode - basic file size and extension filtering
                        file_size = image_file.stat().st_size
                        if file_size < 1024:  # Less than 1KB
                            await self.log_message("info", f"Rejected {image_file.name}: file too small ({file_size} bytes)")
                            failed_count += 1
                            continue
                        
                        await self.log_message("info", f"Accepted {image_file.name} (fallback mode)")
                    
                    # Copy image to output directory
                    output_file = output_path / image_file.name
                    shutil.copy2(image_file, output_file)
                    
                    passed_count += 1
                    
                    # Update progress
                    progress = 20 + (i + 1) / len(image_files) * 70
                    await self.update_progress(progress, f"Filtered {i + 1}/{len(image_files)} images")
                    
                except Exception as e:
                    await self.log_message("error", f"Failed to process {image_file.name}: {str(e)}")
                    failed_count += 1
                    continue
            
            await self.update_progress(100, "Face filtering completed")
            await self.log_message("info", f"Filtering complete: {passed_count} passed, {failed_count} rejected")
            
            # Set output path
            self.set_output_path("output_dir", str(output_path))
            
            return {
                "success": True,
                "output_path": str(output_path),
                "faces_passed": passed_count,
                "faces_rejected": failed_count,
                "total_faces": len(image_files),
                "message": f"Filtered {len(image_files)} faces: {passed_count} passed, {failed_count} rejected"
            }
            
        except Exception as e:
            error_msg = f"Face filtering failed: {str(e)}"
            await self.update_status(NodeStatus.ERROR, error_msg)
            await self.log_message("error", error_msg)
            return {"success": False, "error": error_msg}
    
    def _calculate_image_quality(self, img) -> float:
        """Calculate image quality score (simplified implementation)"""
        if not CV2_AVAILABLE:
            return 0.7  # Default quality score for fallback mode
            
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Calculate gradient magnitude
            grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
            
            # Quality score based on gradient variance
            quality_score = np.var(gradient_magnitude) / 10000.0  # Normalize
            
            return min(quality_score, 1.0)  # Cap at 1.0
            
        except Exception:
            return 0.5  # Default quality score
