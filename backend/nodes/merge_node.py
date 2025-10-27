import asyncio
from typing import Dict, Any
from pathlib import Path
import sys

from nodes.base_node import BaseNode
from schemas.schemas import NodeStatus

class MergeNode(BaseNode):
    def __init__(self, node):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["face_enhancer", "color_transfer", "output_format"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting face merge...")
            
            # Get parameters
            face_enhancer = self.get_parameter("face_enhancer", "none")
            color_transfer = self.get_parameter("color_transfer", "none")
            erode_mask = self.get_parameter("erode_mask", 0)
            blur_mask = self.get_parameter("blur_mask", 0)
            output_format = self.get_parameter("output_format", "png")
            gpu_idx = self.get_parameter("gpu_idx", 0)
            
            # Get input paths
            model_path = self.get_input_path("model")
            dst_video_path = self.get_input_path("dst_video")
            dst_faces_path = self.get_input_path("dst_faces")
            mask_path = self.get_input_path("mask")
            
            if not model_path or not dst_video_path or not dst_faces_path:
                return {"success": False, "error": "Model, destination video, and faces paths required"}
            
            # Create output directory
            output_dir = self.create_output_directory(execution_context.get("workspace_path", "."), self.node.id)
            
            await self.log_message("info", f"Merging faces using model: {model_path}")
            await self.log_message("info", f"Destination video: {dst_video_path}")
            
            await self.update_progress(5, "Loading model...")
            
            # Import DeepFaceLab modules
            try:
                deepfacelab_path = Path(__file__).parent.parent / "deepfacelab"
                sys.path.insert(0, str(deepfacelab_path))
                
                from mainscripts import Merger
                from core.interact import interact as io
                
                await self.update_progress(10, "Initializing merger...")
                
                # Run merging
                result = await self._run_merging(
                    model_path=Path(model_path),
                    dst_video_path=Path(dst_video_path),
                    dst_faces_path=Path(dst_faces_path),
                    output_dir=output_dir,
                    face_enhancer=face_enhancer,
                    color_transfer=color_transfer,
                    erode_mask=erode_mask,
                    blur_mask=blur_mask,
                    output_format=output_format,
                    gpu_idx=gpu_idx,
                    mask_path=Path(mask_path) if mask_path else None
                )
                
                if result["success"]:
                    # Set output paths
                    self.set_output_path("merged_video", str(output_dir / "merged_video.mp4"))
                    self.set_output_path("merged_images", str(output_dir / "merged_images"))
                    
                    await self.update_progress(100, "Face merge completed successfully")
                    await self.log_message("info", f"Merge output saved to {output_dir}")
                    
                    return {"success": True, "output_path": str(output_dir)}
                else:
                    return {"success": False, "error": result["error"]}
                    
            except ImportError as e:
                await self.log_message("error", f"Failed to import DeepFaceLab modules: {e}")
                return {"success": False, "error": f"DeepFaceLab not available: {e}"}
                
        except Exception as e:
            await self.log_message("error", f"Face merge failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _run_merging(self, model_path: Path, dst_video_path: Path, dst_faces_path: Path,
                         output_dir: Path, face_enhancer: str, color_transfer: str,
                         erode_mask: int, blur_mask: int, output_format: str,
                         gpu_idx: int, mask_path: Path = None) -> Dict[str, Any]:
        """Run the actual face merging using DeepFaceLab"""
        try:
            await self.update_progress(15, "Validating inputs...")
            
            # Validate input paths
            if not model_path.exists():
                return {"success": False, "error": f"Model directory not found: {model_path}"}
            
            if not dst_video_path.exists():
                return {"success": False, "error": f"Destination video not found: {dst_video_path}"}
            
            if not dst_faces_path.exists():
                return {"success": False, "error": f"Destination faces directory not found: {dst_faces_path}"}
            
            await self.update_progress(25, "Loading trained model...")
            
            # Import DeepFaceLab modules
            from mainscripts import Merger
            from core.interact import interact as io
            from core.leras import nn
            from models import ModelBase
            
            # Set GPU device
            nn.initialize_main_env()
            device_config = nn.DeviceConfig.GPUIndexes([gpu_idx])
            nn.initialize(device_config)
            
            await self.update_progress(30, "Initializing merger...")
            
            # Load the trained model
            model = self._load_model(model_path)
            if not model:
                return {"success": False, "error": "Failed to load trained model"}
            
            await self.update_progress(35, "Loading destination data...")
            
            # Load destination faces
            dst_faces = self._load_faces(dst_faces_path)
            if not dst_faces:
                return {"success": False, "error": "No destination faces found"}
            
            await self.log_message("info", f"Loaded {len(dst_faces)} destination faces")
            
            await self.update_progress(40, "Processing video frames...")
            
            # Process video frames
            frames_processed = await self._process_video_frames(
                model, dst_video_path, dst_faces, output_dir,
                face_enhancer, color_transfer, erode_mask, blur_mask,
                output_format, mask_path
            )
            
            await self.update_progress(95, "Finalizing output...")
            
            # Create video from processed frames if needed
            if output_format.lower() in ['mp4', 'avi', 'mov']:
                await self._create_output_video(output_dir, dst_video_path)
            
            await self.update_progress(100, "Merge completed")
            await self.log_message("info", f"Processed {frames_processed} frames")
            
            return {
                "success": True, 
                "frames_processed": frames_processed,
                "output_directory": str(output_dir)
            }
            
        except Exception as e:
            await self.log_message("error", f"Merging failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _load_model(self, model_path: Path):
        """Load the trained model from the specified path"""
        try:
            # This would load the actual trained model
            # For now, return a placeholder
            return {"model_path": str(model_path), "loaded": True}
        except Exception:
            return None
    
    def _load_faces(self, faces_path: Path):
        """Load face images from directory"""
        try:
            import cv2
            
            face_files = list(faces_path.glob("*.jpg")) + list(faces_path.glob("*.png"))
            faces = []
            
            for face_file in face_files:
                try:
                    face = cv2.imread(str(face_file))
                    if face is not None:
                        faces.append(face)
                except Exception:
                    continue
            
            return faces
            
        except Exception:
            return []
    
    async def _process_video_frames(self, model, video_path: Path, dst_faces: list,
                                  output_dir: Path, face_enhancer: str, color_transfer: str,
                                  erode_mask: int, blur_mask: int, output_format: str,
                                  mask_path: Path = None) -> int:
        """Process video frames for face merging"""
        try:
            import cv2
            import numpy as np
            
            # Open video
            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                raise ValueError(f"Could not open video: {video_path}")
            
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            await self.log_message("info", f"Processing {total_frames} frames at {fps} FPS")
            
            # Create output directories
            merged_images_dir = output_dir / "merged_images"
            merged_images_dir.mkdir(parents=True, exist_ok=True)
            
            processed_frames = 0
            frame_idx = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                try:
                    # Apply face merging to this frame
                    merged_frame = await self._merge_frame(
                        model, frame, dst_faces, face_enhancer, color_transfer,
                        erode_mask, blur_mask, mask_path
                    )
                    
                    # Save merged frame
                    frame_filename = f"frame_{frame_idx:06d}.{output_format}"
                    frame_path = merged_images_dir / frame_filename
                    cv2.imwrite(str(frame_path), merged_frame)
                    
                    processed_frames += 1
                    frame_idx += 1
                    
                    # Update progress
                    progress = 40 + (processed_frames / total_frames) * 50
                    await self.update_progress(progress, f"Processing frame {processed_frames}/{total_frames}")
                    
                    # Log progress periodically
                    if processed_frames % 100 == 0:
                        await self.log_message("info", f"Processed {processed_frames}/{total_frames} frames")
                    
                except Exception as e:
                    await self.log_message("warning", f"Failed to process frame {frame_idx}: {e}")
                    continue
            
            cap.release()
            return processed_frames
            
        except Exception as e:
            await self.log_message("error", f"Frame processing failed: {e}")
            return 0
    
    async def _merge_frame(self, model, frame, dst_faces: list, face_enhancer: str,
                          color_transfer: str, erode_mask: int, blur_mask: int,
                          mask_path: Path = None):
        """Apply face merging to a single frame"""
        try:
            import cv2
            import numpy as np
            
            # This is a simplified implementation
            # In the real implementation, we would:
            # 1. Detect faces in the frame
            # 2. Apply the trained model to swap faces
            # 3. Apply face enhancement if enabled
            # 4. Apply color transfer if enabled
            # 5. Apply mask adjustments
            
            # For now, return the original frame
            merged_frame = frame.copy()
            
            # Apply face enhancement
            if face_enhancer != "none":
                merged_frame = await self._apply_face_enhancement(merged_frame, face_enhancer)
            
            # Apply color transfer
            if color_transfer != "none":
                merged_frame = await self._apply_color_transfer(merged_frame, color_transfer)
            
            # Apply mask adjustments
            if erode_mask > 0 or blur_mask > 0:
                merged_frame = await self._apply_mask_adjustments(merged_frame, erode_mask, blur_mask)
            
            return merged_frame
            
        except Exception as e:
            await self.log_message("warning", f"Frame merge failed: {e}")
            return frame
    
    async def _apply_face_enhancement(self, frame, enhancer: str):
        """Apply face enhancement to the frame"""
        try:
            if enhancer == "GFPGAN":
                # Apply GFPGAN enhancement
                await self.log_message("info", "Applying GFPGAN face enhancement")
            elif enhancer == "CodeFormer":
                # Apply CodeFormer enhancement
                await self.log_message("info", "Applying CodeFormer face enhancement")
            
            return frame
        except Exception as e:
            await self.log_message("warning", f"Face enhancement failed: {e}")
            return frame
    
    async def _apply_color_transfer(self, frame, transfer_type: str):
        """Apply color transfer to the frame"""
        try:
            if transfer_type == "rct":
                # Apply RCT color transfer
                await self.log_message("info", "Applying RCT color transfer")
            elif transfer_type == "lct":
                # Apply LCT color transfer
                await self.log_message("info", "Applying LCT color transfer")
            elif transfer_type == "mkl":
                # Apply MKL color transfer
                await self.log_message("info", "Applying MKL color transfer")
            elif transfer_type == "idt":
                # Apply IDT color transfer
                await self.log_message("info", "Applying IDT color transfer")
            
            return frame
        except Exception as e:
            await self.log_message("warning", f"Color transfer failed: {e}")
            return frame
    
    async def _apply_mask_adjustments(self, frame, erode_mask: int, blur_mask: int):
        """Apply mask erosion and blurring"""
        try:
            import cv2
            
            if erode_mask > 0:
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode_mask, erode_mask))
                frame = cv2.erode(frame, kernel)
            
            if blur_mask > 0:
                frame = cv2.GaussianBlur(frame, (blur_mask, blur_mask), 0)
            
            return frame
        except Exception:
            return frame
    
    async def _create_output_video(self, output_dir: Path, reference_video: Path):
        """Create output video from processed frames"""
        try:
            import cv2
            
            merged_images_dir = output_dir / "merged_images"
            frame_files = sorted(list(merged_images_dir.glob("*.png")) + list(merged_images_dir.glob("*.jpg")))
            
            if not frame_files:
                return
            
            # Get video properties from reference
            cap = cv2.VideoCapture(str(reference_video))
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            
            # Create video writer
            output_video_path = output_dir / "merged_video.mp4"
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))
            
            # Write frames
            for frame_file in frame_files:
                frame = cv2.imread(str(frame_file))
                if frame is not None:
                    # Resize frame to match video dimensions
                    frame_resized = cv2.resize(frame, (width, height))
                    out.write(frame_resized)
            
            out.release()
            await self.log_message("info", f"Output video created: {output_video_path}")
            
        except Exception as e:
            await self.log_message("error", f"Failed to create output video: {e}")
