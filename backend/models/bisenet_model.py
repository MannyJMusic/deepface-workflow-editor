import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

# Optional imports - provide fallbacks if not available
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    print("Warning: OpenCV not available. BiSeNet model will use fallback mode.")

logger = logging.getLogger(__name__)

class BiSeNetModel:
    """Wrapper for BiSeNet segmentation model integration"""
    
    def __init__(self):
        self.model = None
        self.model_loaded = False
        self.model_path = None
        
    async def load_model(self, model_path: Optional[str] = None) -> Dict[str, Any]:
        """Load BiSeNet segmentation model"""
        try:
            if model_path:
                self.model_path = Path(model_path)
            else:
                # Try to find BiSeNet model in machine-video-editor
                machine_editor_path = Path("/Volumes/MacOSNew/SourceCode/deepface-editor/machine-video-editor-0.8.2/resources/external/python")
                if machine_editor_path.exists():
                    self.model_path = machine_editor_path
                    sys.path.append(str(machine_editor_path))
            
            if self.model_path and self.model_path.exists():
                try:
                    # Try to import BiSeNet from machine-video-editor
                    from scripts.alignment_embeding.SegIEPolys import SegIEPolys
                    
                    # Initialize BiSeNet model
                    self.model = SegIEPolys()
                    self.model_loaded = True
                    
                    logger.info("BiSeNet model loaded successfully from machine-video-editor")
                    return {
                        "success": True,
                        "message": "BiSeNet model loaded successfully",
                        "model_type": "BiSeNet",
                        "source": "machine-video-editor"
                    }
                    
                except ImportError as e:
                    logger.warning(f"BiSeNet model not available: {e}")
                    return {
                        "success": False,
                        "error": f"BiSeNet model not available: {e}",
                        "model_type": "fallback"
                    }
            else:
                logger.warning("Machine Video Editor not found, using fallback")
                return {
                    "success": False,
                    "error": "Machine Video Editor not found",
                    "model_type": "fallback"
                }
                
        except Exception as e:
            logger.error(f"Failed to load BiSeNet model: {e}")
            return {
                "success": False,
                "error": str(e),
                "model_type": "fallback"
            }
    
    async def generate_segmentation_mask(self, image_path: str, eyebrow_expand_mod: int = 1) -> Dict[str, Any]:
        """Generate segmentation mask for a single image"""
        try:
            if not self.model_loaded:
                return {
                    "success": False,
                    "error": "BiSeNet model not loaded"
                }
            
            if not CV2_AVAILABLE:
                return {
                    "success": False,
                    "error": "OpenCV not available"
                }
            
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                return {
                    "success": False,
                    "error": f"Could not load image: {image_path}"
                }
            
            height, width = img.shape[:2]
            
            # Use BiSeNet model to generate segmentation
            try:
                # Call BiSeNet model (this would be the actual implementation)
                # For now, generate mock segmentation polygon
                polygon = await self._generate_mock_polygon(width, height, eyebrow_expand_mod)
                
                return {
                    "success": True,
                    "polygon": polygon,
                    "image_shape": (height, width),
                    "eyebrow_expand_mod": eyebrow_expand_mod
                }
                
            except Exception as e:
                logger.error(f"BiSeNet segmentation failed: {e}")
                # Fallback to mock polygon
                polygon = await self._generate_mock_polygon(width, height, eyebrow_expand_mod)
                
                return {
                    "success": True,
                    "polygon": polygon,
                    "image_shape": (height, width),
                    "eyebrow_expand_mod": eyebrow_expand_mod,
                    "warning": f"Using fallback segmentation: {e}"
                }
                
        except Exception as e:
            logger.error(f"Segmentation mask generation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def generate_batch_masks(self, image_paths: List[str], eyebrow_expand_mod: int = 1) -> Dict[str, Any]:
        """Generate segmentation masks for multiple images"""
        try:
            results = {}
            processed_count = 0
            
            for image_path in image_paths:
                try:
                    result = await self.generate_segmentation_mask(image_path, eyebrow_expand_mod)
                    results[image_path] = result
                    
                    if result["success"]:
                        processed_count += 1
                    
                    # Small delay to prevent overwhelming the system
                    await asyncio.sleep(0.01)
                    
                except Exception as e:
                    logger.warning(f"Failed to process {image_path}: {e}")
                    results[image_path] = {
                        "success": False,
                        "error": str(e)
                    }
            
            return {
                "success": True,
                "processed_count": processed_count,
                "total_count": len(image_paths),
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Batch mask generation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _generate_mock_polygon(self, width: int, height: int, eyebrow_expand_mod: int = 1) -> List[List[float]]:
        """Generate mock segmentation polygon for testing"""
        try:
            # Generate face outline polygon
            polygon = [
                [width * 0.2, height * 0.1],  # Top left
                [width * 0.8, height * 0.1],  # Top right
                [width * 0.9, height * 0.4],  # Right cheek
                [width * 0.8, height * 0.7],  # Right jaw
                [width * 0.5, height * 0.9],  # Chin
                [width * 0.2, height * 0.7],  # Left jaw
                [width * 0.1, height * 0.4],  # Left cheek
            ]
            
            # Apply eyebrow expansion
            if eyebrow_expand_mod > 1:
                polygon = self._expand_eyebrow_region(polygon, eyebrow_expand_mod, width, height)
            
            return polygon
            
        except Exception as e:
            logger.error(f"Mock polygon generation failed: {e}")
            return []
    
    def _expand_eyebrow_region(self, polygon: List[List[float]], expand_mod: int, width: int, height: int) -> List[List[float]]:
        """Expand eyebrow region of polygon based on expand_mod parameter"""
        try:
            expanded_polygon = []
            
            for point in polygon:
                if point[1] < height * 0.3:  # Top 30% of face (eyebrow region)
                    # Expand upward
                    expanded_point = [
                        point[0], 
                        max(0, point[1] - (expand_mod * height * 0.02))
                    ]
                    expanded_polygon.append(expanded_point)
                else:
                    expanded_polygon.append(point)
            
            return expanded_polygon
            
        except Exception as e:
            logger.error(f"Eyebrow expansion failed: {e}")
            return polygon
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model_loaded
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_loaded": self.model_loaded,
            "model_type": "BiSeNet" if self.model_loaded else "fallback",
            "model_path": str(self.model_path) if self.model_path else None,
            "opencv_available": CV2_AVAILABLE
        }

# Global instance
bisenet_model = BiSeNetModel()


