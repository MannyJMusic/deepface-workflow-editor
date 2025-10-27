import asyncio
from typing import Dict, Any
from pathlib import Path
import sys
import os

from nodes.base_node import BaseNode
from schemas.schemas import NodeStatus

class ExtractNode(BaseNode):
    def __init__(self, node):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["detector", "face_type", "image_size"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting face extraction...")
            
            # Get parameters
            detector = self.get_parameter("detector", "s3fd")
            face_type = self.get_parameter("face_type", "full_face")
            image_size = self.get_parameter("image_size", 512)
            jpeg_quality = self.get_parameter("jpeg_quality", 90)
            max_faces = self.get_parameter("max_faces_from_image", 1)
            output_debug = self.get_parameter("output_debug", False)
            gpu_idx = self.get_parameter("gpu_idx", 0)
            
            # Get input path
            input_path = self.get_input_path("video")
            if not input_path:
                return {"success": False, "error": "No input video path provided"}
            
            # Create output directory
            output_dir = self.create_output_directory(execution_context.get("workspace_path", "."), self.node.id)
            
            await self.log_message("info", f"Extracting faces from {input_path}")
            await self.update_progress(10, "Initializing face detector...")
            
            # Import DeepFaceLab modules
            try:
                # Add DeepFaceLab to path
                deepfacelab_path = Path(__file__).parent.parent / "deepfacelab"
                sys.path.insert(0, str(deepfacelab_path))
                
                from mainscripts import Extractor
                from core.interact import interact as io
                
                # Override io.input_* functions to use parameters instead
                self._setup_io_overrides()
                
                await self.update_progress(20, "Running face extraction...")
                
                # Run extraction
                result = await self._run_extraction(
                    detector=detector,
                    input_path=Path(input_path),
                    output_path=output_dir,
                    face_type=face_type,
                    image_size=image_size,
                    jpeg_quality=jpeg_quality,
                    max_faces=max_faces,
                    output_debug=output_debug,
                    gpu_idx=gpu_idx
                )
                
                if result["success"]:
                    # Set output path
                    self.set_output_path("faces", str(output_dir))
                    
                    await self.update_progress(100, "Face extraction completed successfully")
                    await self.log_message("info", f"Faces extracted to {output_dir}")
                    
                    return {"success": True, "output_path": str(output_dir)}
                else:
                    return {"success": False, "error": result["error"]}
                    
            except ImportError as e:
                await self.log_message("error", f"Failed to import DeepFaceLab modules: {e}")
                return {"success": False, "error": f"DeepFaceLab not available: {e}"}
                
        except Exception as e:
            await self.log_message("error", f"Face extraction failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _setup_io_overrides(self):
        """Override DeepFaceLab's interactive functions"""
        # This would override the io.input_* functions to use our parameters
        # For now, we'll implement a basic version
        pass
    
    async def _run_extraction(self, detector: str, input_path: Path, output_path: Path, 
                            face_type: str, image_size: int, jpeg_quality: int, 
                            max_faces: int, output_debug: bool, gpu_idx: int) -> Dict[str, Any]:
        """Run the actual face extraction using DeepFaceLab"""
        try:
            # Import DeepFaceLab modules
            from mainscripts import Extractor
            from core.interact import interact as io
            from core.leras import nn
            
            # Set GPU device
            nn.initialize_main_env()
            device_config = nn.DeviceConfig.GPUIndexes([gpu_idx])
            nn.initialize(device_config)
            
            await self.update_progress(30, "Initializing detector...")
            
            # Initialize detector
            detector_type = detector.upper()
            if detector_type == "S3FD":
                from facelib import S3FDExtractor
                extractor = S3FDExtractor()
            elif detector_type == "MANUAL":
                from facelib import ManualExtractor
                extractor = ManualExtractor()
            else:
                raise ValueError(f"Unsupported detector: {detector}")
            
            await self.update_progress(40, "Processing input files...")
            
            # Get input files
            input_files = []
            if input_path.is_file():
                # Single video file
                input_files = [input_path]
            elif input_path.is_dir():
                # Directory of images
                input_files = list(input_path.glob("*.jpg")) + list(input_path.glob("*.png"))
            
            if not input_files:
                return {"success": False, "error": "No input files found"}
            
            await self.update_progress(50, f"Processing {len(input_files)} files...")
            
            # Create output directory structure
            faces_dir = output_path / "faces"
            faces_dir.mkdir(parents=True, exist_ok=True)
            
            if output_debug:
                debug_dir = output_path / "debug"
                debug_dir.mkdir(parents=True, exist_ok=True)
            
            faces_extracted = 0
            total_files = len(input_files)
            
            # Process each file
            for i, file_path in enumerate(input_files):
                try:
                    await self.update_progress(50 + (i / total_files) * 40, f"Processing {file_path.name}...")
                    
                    # Extract faces from this file
                    result = await self._extract_faces_from_file(
                        extractor, file_path, faces_dir, 
                        face_type, image_size, jpeg_quality, max_faces,
                        debug_dir if output_debug else None
                    )
                    
                    faces_extracted += result.get("faces_count", 0)
                    
                except Exception as e:
                    await self.log_message("warning", f"Failed to process {file_path.name}: {e}")
                    continue
            
            await self.update_progress(95, "Finalizing extraction...")
            
            # Create summary
            summary = {
                "faces_extracted": faces_extracted,
                "files_processed": total_files,
                "output_directory": str(faces_dir),
                "detector": detector,
                "face_type": face_type,
                "image_size": image_size
            }
            
            await self.log_message("info", f"Extraction completed: {faces_extracted} faces from {total_files} files")
            
            return {"success": True, **summary}
            
        except Exception as e:
            await self.log_message("error", f"Extraction failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _extract_faces_from_file(self, extractor, file_path: Path, output_dir: Path,
                                     face_type: str, image_size: int, jpeg_quality: int,
                                     max_faces: int, debug_dir: Path = None) -> Dict[str, Any]:
        """Extract faces from a single file"""
        try:
            # Load image
            import cv2
            import numpy as np
            
            image = cv2.imread(str(file_path))
            if image is None:
                raise ValueError(f"Could not load image: {file_path}")
            
            # Detect faces
            faces = extractor.extract(image, face_type=face_type, image_size=image_size)
            
            faces_count = 0
            base_name = file_path.stem
            
            # Save each detected face
            for i, face in enumerate(faces[:max_faces]):
                try:
                    # Resize face to target size
                    face_resized = cv2.resize(face, (image_size, image_size))
                    
                    # Save face image
                    face_filename = f"{base_name}_{i:02d}.jpg"
                    face_path = output_dir / face_filename
                    
                    cv2.imwrite(str(face_path), face_resized, 
                              [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
                    
                    faces_count += 1
                    
                except Exception as e:
                    await self.log_message("warning", f"Failed to save face {i} from {file_path.name}: {e}")
                    continue
            
            return {"faces_count": faces_count}
            
        except Exception as e:
            await self.log_message("error", f"Failed to extract faces from {file_path.name}: {e}")
            return {"faces_count": 0, "error": str(e)}
